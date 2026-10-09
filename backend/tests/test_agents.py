import json
from datetime import UTC, datetime, timedelta
from urllib.parse import parse_qs, urlsplit

import pytest
from sqlalchemy import select

from app.core.security import token_hash
from app.db.session import SessionLocal
from app.modules.agents.models import AgentAuthorization, AgentConnection
from app.modules.agents.security import SCOPES, challenge
from app.modules.channels.models import ConnectedAccount
from app.modules.channels.oauth import encrypt_token
from app.modules.content.models import PostVariant
from app.modules.workspaces.models import Workspace, WorkspaceMembership


def rpc(client, token, method, params=None, **extra_headers):
    return client.post(
        "/mcp",
        headers={
            "Host": "localhost:18000",
            "Authorization": f"Bearer {token}",
            "Accept": "application/json, text/event-stream",
            **extra_headers,
        },
        json={"jsonrpc": "2.0", "id": 1, "method": method, "params": params or {}},
    )


def call(client, token, name, arguments=None):
    response = rpc(client, token, "tools/call", {"name": name, "arguments": arguments or {}})
    assert response.status_code == 200, response.text
    return response.json()["result"]


def data(result):
    assert not result.get("isError"), result
    return result.get("structuredContent") or json.loads(result["content"][0]["text"])


@pytest.fixture
def connection(client, auth):
    response = client.post(
        "/api/v1/agents/connections",
        headers=auth,
        json={"name": "Test agent", "scopes": list(SCOPES)},
    )
    assert response.status_code == 201, response.text
    return response.json()


@pytest.fixture
def account(client, auth):
    post = client.post("/api/v1/posts", headers=auth, json={"base_text": "Reference"}).json()
    with SessionLocal.begin() as db:
        account = ConnectedAccount(
            workspace_id=post["workspace_id"],
            platform="x",
            external_account_id="x-test",
            display_name="Writer",
            status="active",
            encrypted_access_token=encrypt_token("secret-social-token"),
            granted_scopes=["tweet.read", "tweet.write", "users.read", "offline.access"],
            account_metadata={"oauth": {"access_token": "secret-social-token"}},
        )
        db.add(account)
        db.flush()
        return account.id


def oauth_request(client, scopes="postflow:read", state="test-state"):
    registered = client.post(
        "/oauth/register",
        json={
            "client_name": "Claude test",
            "redirect_uris": ["https://agent.example/callback?existing=1"],
        },
    )
    assert registered.status_code == 201, registered.text
    client_id = registered.json()["client_id"]
    verifier = "a" * 64
    start = client.get(
        "/oauth/authorize",
        params={
            "client_id": client_id,
            "redirect_uri": "https://agent.example/callback?existing=1",
            "code_challenge": challenge(verifier),
            "code_challenge_method": "S256",
            "scope": scopes,
            "state": state,
            "resource": "http://localhost:18000/mcp",
        },
        follow_redirects=False,
    )
    assert start.status_code == 302, start.text
    nonce = parse_qs(urlsplit(start.headers["location"]).query)["request"][0]
    return nonce, {
        "grant_type": "authorization_code",
        "client_id": client_id,
        "redirect_uri": "https://agent.example/callback?existing=1",
        "code_verifier": verifier,
    }


def test_discovery_initialize_and_real_sdk_tools(client, auth, connection):
    metadata = client.get("/.well-known/oauth-protected-resource/mcp").json()
    assert metadata["resource"] == "http://localhost:18000/mcp"
    assert set(metadata["scopes_supported"]) == set(SCOPES)
    issuer = client.get("/.well-known/oauth-authorization-server").json()
    assert issuer["code_challenge_methods_supported"] == ["S256"]
    unauthorized = rpc(client, "not-a-token", "tools/list")
    assert unauthorized.status_code == 401
    assert (
        'resource_metadata="http://localhost:18000/.well-known/oauth-protected-resource/mcp"'
        in unauthorized.headers["www-authenticate"]
    )
    token = connection["token"]
    initialized = rpc(
        client,
        token,
        "initialize",
        {
            "protocolVersion": "2025-11-25",
            "capabilities": {},
            "clientInfo": {"name": "postflow-test", "version": "1"},
        },
    )
    assert initialized.status_code == 200, initialized.text
    assert initialized.json()["result"]["serverInfo"]["name"] == "Postflow"
    tools = rpc(client, token, "tools/list").json()["result"]["tools"]
    names = {tool["name"] for tool in tools}
    assert {
        "get_workspace",
        "create_draft",
        "schedule_post",
        "publish_post",
        "run_ai_feature",
        "get_analytics",
    } <= names
    assert next(tool for tool in tools if tool["name"] == "publish_post")["annotations"][
        "destructiveHint"
    ]
    workspace = data(call(client, token, "get_workspace"))
    assert workspace["usage"]["ai_credits"]["limit"] == 20
    assert rpc(client, token, "tools/list", Origin="https://attacker.example").status_code == 403


def test_scoped_tokens_are_hashed_and_revocable(client, auth, connection):
    listed = client.get("/api/v1/agents/connections", headers=auth)
    assert listed.status_code == 200 and listed.headers["cache-control"] == "no-store"
    assert connection["token"] not in listed.text
    with SessionLocal() as db:
        record = db.get(AgentConnection, connection["connection"]["id"])
        assert record.token_hash == token_hash(connection["token"])
        assert record.token_hash != connection["token"]
    assert (
        client.delete(
            f"/api/v1/agents/connections/{connection['connection']['id']}", headers=auth
        ).status_code
        == 200
    )
    assert rpc(client, connection["token"], "tools/list").status_code == 401


def test_oauth_consent_pkce_resource_refresh_rotation_and_revocation(client, auth):
    nonce, exchange = oauth_request(client, " ".join(SCOPES))
    details = client.get("/api/v1/agents/authorization", params={"request": nonce}, headers=auth)
    assert details.status_code == 200 and details.json()["client_name"] == "Claude test"
    approved = client.post(
        "/api/v1/agents/authorization", headers=auth, json={"request": nonce, "approve": True}
    )
    assert approved.status_code == 200, approved.text
    redirect = parse_qs(urlsplit(approved.json()["redirect_url"]).query)
    assert redirect["state"] == ["test-state"] and redirect["existing"] == ["1"]
    exchange["code"] = redirect["code"][0]
    assert (
        client.post("/oauth/token", data={**exchange, "code_verifier": "b" * 64}).status_code == 400
    )
    assert (
        client.post(
            "/oauth/token", data={**exchange, "resource": "https://attacker.example/mcp"}
        ).status_code
        == 400
    )
    issued = client.post("/oauth/token", data=exchange)
    assert issued.status_code == 200, issued.text
    assert issued.headers["cache-control"] == "no-store"
    tokens = issued.json()
    assert rpc(client, tokens["access_token"], "tools/list").status_code == 200
    assert client.post("/oauth/token", data=exchange).status_code == 400
    refresh = {
        "grant_type": "refresh_token",
        "client_id": exchange["client_id"],
        "refresh_token": tokens["refresh_token"],
    }
    rotated = client.post("/oauth/token", data=refresh)
    assert rotated.status_code == 200, rotated.text
    assert client.post("/oauth/token", data=refresh).status_code == 400
    assert rpc(client, tokens["access_token"], "tools/list").status_code == 401
    assert (
        client.post(
            "/oauth/revoke",
            data={"client_id": exchange["client_id"], "token": rotated.json()["refresh_token"]},
        ).status_code
        == 200
    )
    assert rpc(client, rotated.json()["access_token"], "tools/list").status_code == 401


def test_oauth_deny_expiry_and_redirect_validation(client, auth):
    for uri in [
        "javascript:alert(1)",
        "http://attacker.example/callback",
        "https://user:pass@agent.example/callback",
        "https://agent.example/#fragment",
    ]:
        assert client.post("/oauth/register", json={"redirect_uris": [uri]}).status_code == 400
    nonce, exchange = oauth_request(client)
    denied = client.post(
        "/api/v1/agents/authorization", headers=auth, json={"request": nonce, "approve": False}
    )
    assert "error=access_denied" in denied.json()["redirect_url"]
    assert (
        client.post(
            "/api/v1/agents/authorization", headers=auth, json={"request": nonce, "approve": True}
        ).status_code
        == 410
    )
    nonce, _ = oauth_request(client)
    with SessionLocal.begin() as db:
        pending = db.scalar(
            select(AgentAuthorization).where(AgentAuthorization.request_hash == token_hash(nonce))
        )
        pending.expires_at = datetime.now(UTC) - timedelta(seconds=1)
    assert (
        client.get(
            "/api/v1/agents/authorization", params={"request": nonce}, headers=auth
        ).status_code
        == 410
    )
    assert (
        client.get(
            "/oauth/authorize",
            params={
                "client_id": exchange["client_id"],
                "redirect_uri": "https://attacker.example",
                "code_challenge": challenge("a" * 64),
            },
            follow_redirects=False,
        ).status_code
        == 400
    )


def test_read_only_and_removed_membership_prevent_writes(client, auth, connection, account):
    readonly = client.post(
        "/api/v1/agents/connections", headers=auth, json={"name": "Reader"}
    ).json()["token"]
    result = call(
        client,
        readonly,
        "create_draft",
        {"account_id": account, "platform": "x", "payload": {"text": "Draft"}},
    )
    assert result["isError"] and "permission" in result["content"][0]["text"]
    with SessionLocal.begin() as db:
        record = db.get(AgentConnection, connection["connection"]["id"])
        member = db.scalar(
            select(WorkspaceMembership).where(
                WorkspaceMembership.workspace_id == record.workspace_id,
                WorkspaceMembership.user_id == record.user_id,
            )
        )
        member.role = "viewer"
    result = call(
        client,
        connection["token"],
        "create_draft",
        {"account_id": account, "platform": "x", "payload": {"text": "Draft"}},
    )
    assert result["isError"] and "Editor role" in result["content"][0]["text"]
    assert (
        client.post(
            "/api/v1/agents/connections",
            headers=auth,
            json={"name": "Writer", "scopes": list(SCOPES)},
        ).status_code
        == 403
    )
    with SessionLocal.begin() as db:
        record = db.get(AgentConnection, connection["connection"]["id"])
        member = db.scalar(
            select(WorkspaceMembership).where(
                WorkspaceMembership.workspace_id == record.workspace_id,
                WorkspaceMembership.user_id == record.user_id,
            )
        )
        db.delete(member)
    assert rpc(client, connection["token"], "tools/list").status_code == 401


def test_draft_editing_validation_and_publish_confirmation(client, auth, connection, account):
    token = connection["token"]
    accounts = call(client, token, "list_accounts")
    assert "secret-social-token" not in json.dumps(accounts)
    draft = data(
        call(
            client,
            token,
            "create_draft",
            {"account_id": account, "platform": "x", "payload": {"text": "A useful thought"}},
        )
    )
    variant_id = draft["variants"][0]["id"]
    edited = data(
        call(
            client,
            token,
            "update_draft",
            {"variant_id": variant_id, "payload": {"text": "Read https://example.com"}},
        )
    )
    assert edited["status"] == "draft"
    assert data(call(client, token, "validate_post", {"variant_id": variant_id}))["valid"] is False
    publish = call(client, token, "publish_post", {"variant_id": variant_id})
    assert publish["isError"] and "confirm" in publish["content"][0]["text"]
    scheduled = call(
        client,
        token,
        "schedule_post",
        {
            "variant_id": variant_id,
            "scheduled_time": (datetime.now(UTC) + timedelta(days=1)).isoformat(),
            "confirmed": True,
        },
    )
    assert scheduled["isError"] and "Remove links" in scheduled["content"][0]["text"]
    with SessionLocal() as db:
        assert db.get(PostVariant, variant_id).status == "draft"
    features = data(call(client, token, "list_ai_features", {"platform": "x"}))
    assert features


def test_connection_scope_does_not_follow_workspace_header(client, auth, connection, account):
    with SessionLocal.begin() as db:
        owner = db.get(AgentConnection, connection["connection"]["id"]).user_id
        other = Workspace(name="Another workspace", slug="another", owner_user_id=owner)
        db.add(other)
        db.flush()
        other_id = other.id
        db.add(WorkspaceMembership(workspace_id=other_id, user_id=owner, role="owner"))
    foreign = client.post(
        "/api/v1/posts", headers={**auth, "X-Workspace-ID": other_id}, json={"base_text": "Private"}
    ).json()
    result = call(client, connection["token"], "get_post", {"post_id": foreign["id"]})
    assert result["isError"] and "not found" in result["content"][0]["text"].lower()
    assert (
        client.delete(
            f"/api/v1/agents/connections/{connection['connection']['id']}",
            headers={**auth, "X-Workspace-ID": other_id},
        ).status_code
        == 404
    )
    own = data(call(client, connection["token"], "get_workspace"))
    assert own["id"] != other_id


def test_agent_ai_is_billed_and_scheduling_requires_confirmation(client, auth, connection, account):
    from app.modules.assistant.models import AssistantRun
    from app.modules.billing.entitlements import get_plan_limits_summary

    token = connection["token"]
    generated = data(
        call(
            client,
            token,
            "run_ai_feature",
            {
                "account_id": account,
                "feature_id": "rewrite_with_tone",
                "input_data": {"text": "A useful idea", "tone": "Direct"},
            },
        )
    )
    assert generated["output"] and generated["tokens_used"] > 0
    with SessionLocal() as db:
        grant = db.get(AgentConnection, connection["connection"]["id"])
        run = db.scalar(select(AssistantRun).where(AssistantRun.workspace_id == grant.workspace_id))
        assert run and run.status == "succeeded" and run.user_id == grant.user_id
        assert get_plan_limits_summary(db, grant.workspace_id)["ai_credits"]["used"] == 1
    draft = data(
        call(
            client,
            token,
            "create_draft",
            {
                "account_id": account,
                "platform": "x",
                "payload": {"text": "A useful idea"},
            },
        )
    )
    variant = draft["variants"][0]["id"]
    args = {
        "variant_id": variant,
        "scheduled_time": (datetime.now(UTC) + timedelta(days=1)).isoformat(),
    }
    assert call(client, token, "schedule_post", args)["isError"]
    assert (
        data(call(client, token, "schedule_post", {**args, "confirmed": True}))["status"]
        == "scheduled"
    )
    assert (
        data(call(client, token, "cancel_schedule", {"variant_id": variant}))["status"] == "draft"
    )


def test_expired_connection_and_refresh_scope_expansion_are_rejected(client, auth, connection):
    with SessionLocal.begin() as db:
        db.get(AgentConnection, connection["connection"]["id"]).expires_at = datetime.now(
            UTC
        ) - timedelta(seconds=1)
    assert rpc(client, connection["token"], "tools/list").status_code == 401
    nonce, exchange = oauth_request(client)
    approved = client.post(
        "/api/v1/agents/authorization", headers=auth, json={"request": nonce, "approve": True}
    ).json()
    exchange["code"] = parse_qs(urlsplit(approved["redirect_url"]).query)["code"][0]
    tokens = client.post("/oauth/token", data=exchange).json()
    refresh = {
        "grant_type": "refresh_token",
        "client_id": exchange["client_id"],
        "refresh_token": tokens["refresh_token"],
        "scope": "postflow:read postflow:write",
    }
    assert client.post("/oauth/token", data=refresh).json()["error"] == "invalid_scope"
    with SessionLocal.begin() as db:
        from app.modules.identity.models import User

        grant = db.scalar(
            select(AgentConnection).where(AgentConnection.client_id == exchange["client_id"])
        )
        db.get(User, grant.user_id).is_active = False
    refresh.pop("scope")
    assert client.post("/oauth/token", data=refresh).json()["error"] == "invalid_grant"


def test_agent_migration_preserves_existing_tables_and_data(tmp_path):
    import importlib.util

    import sqlalchemy as sa
    from alembic.migration import MigrationContext
    from alembic.operations import Operations

    engine = sa.create_engine(f"sqlite:///{tmp_path / 'agents.db'}")
    with engine.begin() as db:
        db.exec_driver_sql("CREATE TABLE users (id VARCHAR(36) PRIMARY KEY)")
        db.exec_driver_sql("CREATE TABLE workspaces (id VARCHAR(36) PRIMARY KEY)")
        db.exec_driver_sql("INSERT INTO users VALUES ('preserved-user')")
        spec = importlib.util.spec_from_file_location(
            "agents_migration", "migrations/versions/20261009_agent_connections.py"
        )
        migration = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(migration)
        migration.op = Operations(MigrationContext.configure(db))
        migration.upgrade()
        assert {"agent_clients", "agent_authorizations", "agent_connections"} <= set(
            sa.inspect(db).get_table_names()
        )
        assert db.exec_driver_sql("SELECT id FROM users").scalar() == "preserved-user"
        assert str(sa.inspect(db).get_columns("agent_connections")[0]["type"]) == "VARCHAR(36)"
        migration.downgrade()
        assert set(sa.inspect(db).get_table_names()) == {"users", "workspaces"}
        assert db.exec_driver_sql("SELECT id FROM users").scalar() == "preserved-user"


def test_mcp_url_uses_existing_backend_origin_and_rejects_secret_urls():
    from pydantic import ValidationError

    from app.core.config import Settings

    config = Settings(
        _env_file=None,
        oauth_redirect_base_url="https://api.postflow.ai/api/v1/channels/{platform}/callback",
        public_backend_url=None,
    )
    assert config.mcp_url == "https://api.postflow.ai/mcp"
    assert (
        Settings(_env_file=None, public_backend_url="https://backend.example/api/v1/").mcp_url
        == "https://backend.example/mcp"
    )
    with pytest.raises(ValidationError):
        Settings(_env_file=None, public_backend_url="https://secret:password@backend.example/")


def test_account_listing_and_analytics_are_scoped_without_social_secrets(
    client, auth, connection, account, monkeypatch
):
    from types import SimpleNamespace

    from app.modules.analytics import service

    token = connection["token"]
    accounts = data(call(client, token, "list_accounts"))
    assert "secret-social-token" not in json.dumps(accounts)
    seen = []

    async def dashboard(
        db, workspace_id, account_id, start, end, days, limit, offset, content_type
    ):
        seen.append((workspace_id, account_id, days, limit, offset, content_type))
        return SimpleNamespace(model_dump=lambda **kwargs: {"posts": [{"id": "native-post"}]})

    monkeypatch.setattr(service, "get_dashboard", dashboard)
    result = data(
        call(client, token, "get_analytics", {"account_id": account, "days": 7, "limit": 10})
    )
    assert result["posts"][0]["id"] == "native-post"
    with SessionLocal() as db:
        workspace = db.get(AgentConnection, connection["connection"]["id"]).workspace_id
    assert seen == [(workspace, account, 7, 10, 0, "posts")]
    assert call(client, token, "get_analytics", {"account_id": "foreign-account"})["isError"]
    assert len(seen) == 1


@pytest.mark.parametrize("scheduled_time", ["2026-01-01T00:00:00Z", "2099-01-01T00:00:00"])
def test_agent_schedule_rejects_past_or_ambiguous_times(client, connection, scheduled_time):
    result = call(
        client,
        connection["token"],
        "schedule_post",
        {"variant_id": "not-used", "scheduled_time": scheduled_time, "confirmed": True},
    )
    assert result["isError"] and "explicit timezone" in result["content"][0]["text"]
