import asyncio
from urllib.parse import parse_qs, urlsplit

import httpx
import pytest
from fastapi import HTTPException
from sqlalchemy import select

from app.core.config import Settings, get_settings
from app.db.session import SessionLocal
from app.modules.channels.adapters.threads import ThreadsAdapter
from app.modules.channels.models import ConnectedAccount
from app.modules.channels.oauth import decrypt_token, disconnect_account, encrypt_token
from app.modules.channels.registry import channel_registry

URI = "https://callback.example/api/v1/channels/threads/callback/?source=a%2Fb"


@pytest.fixture
def anyio_backend():
    return "asyncio"


def test_threads_redirect_setting_preserves_exact_uri_and_other_platforms():
    settings = Settings(
        _env_file=None,
        threads_redirect_uri=URI,
        instagram_redirect_uri="https://instagram.example/callback",
        facebook_redirect_uri="https://facebook.example/callback",
        oauth_redirect_base_url="http://localhost:18000/api/v1/channels/oauth/callback",
    )
    assert settings.oauth_callback_url("Threads") == URI
    assert settings.oauth_callback_url("instagram") == "https://instagram.example/callback"
    assert settings.oauth_callback_url("facebook") == "https://facebook.example/callback"
    assert settings.oauth_callback_url("x") == "http://localhost:18000/api/v1/channels/x/callback"
    settings.threads_redirect_uri = ""
    assert (
        settings.oauth_callback_url("threads")
        == "http://localhost:18000/api/v1/channels/threads/callback"
    )


@pytest.mark.anyio
@pytest.mark.parametrize(
    "uri",
    [
        "http://localhost:18000/callback",
        "http://callback.example/callback",
        "https://localhost/callback",
        "https://sub.localhost/callback",
        "https://localhost./callback",
        "https://127.0.0.1/callback",
        "https://[::1]/callback",
        "https://0.0.0.0/callback",
        "https:///callback",
        "https://callback.example:wrong/callback",
        "https://user:password@callback.example/callback",
        "https://callback.example/callback#fragment",
    ],
)
async def test_threads_rejects_invalid_callbacks_before_any_provider_request(uri):
    calls = []

    def handler(request):
        calls.append(request)
        pytest.fail("Invalid redirect must not reach the provider")

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as http:
        adapter = ThreadsAdapter(app_id="app", app_secret="secret", http_client=http)
        for operation in (
            adapter.build_auth_url("ws", "state", redirect_uri=uri),
            adapter.handle_callback("ws", {"code": "code"}, "state", redirect_uri=uri),
        ):
            with pytest.raises(HTTPException) as failure:
                await operation
            assert failure.value.status_code == 422
            assert "THREADS_REDIRECT_URI" in failure.value.detail
    assert calls == []


def test_threads_connect_and_exchange_use_saved_https_callback(client, auth, monkeypatch):
    settings = get_settings()
    monkeypatch.setattr(settings, "threads_redirect_uri", URI)
    calls = []

    def handler(request):
        calls.append(request)
        if request.url.path == "/oauth/access_token":
            body = parse_qs(request.content.decode())
            assert body["redirect_uri"] == [URI]
            assert body["grant_type"] == ["authorization_code"]
            return httpx.Response(200, json={"access_token": "short"})
        if request.url.path == "/access_token":
            return httpx.Response(200, json={"access_token": "long", "expires_in": 5184000})
        assert request.url.path == "/v1.0/me"
        return httpx.Response(200, json={"id": "thread-user", "username": "tester"})

    http = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    adapter = ThreadsAdapter(app_id="threads-app", app_secret="secret", http_client=http)
    # A long-lived adapter instance may still have the old configured callback.
    adapter.redirect_base_url = "http://localhost:18000/callback"
    monkeypatch.setitem(channel_registry._adapters, "threads", adapter)
    start = client.post("/api/v1/channels/threads/connect", headers=auth)
    assert start.status_code == 200, start.text
    query = parse_qs(urlsplit(start.json()["auth_url"]).query)
    assert query["redirect_uri"] == [URI]
    assert query["client_id"] == ["threads-app"]
    assert query["state"] == [start.json()["state"]]
    assert "threads_basic" in query["scope"][0]

    monkeypatch.setattr(settings, "threads_redirect_uri", "https://changed.example/callback")
    response = client.post(
        "/api/v1/channels/threads/callback", json={"code": "code", "state": start.json()["state"]}
    )
    assert response.status_code == 200, response.text
    assert len(calls) == 3
    with SessionLocal() as db:
        account = db.scalar(select(ConnectedAccount).where(ConnectedAccount.platform == "threads"))
        assert decrypt_token(account.encrypted_access_token) == "long"
        assert account.external_account_id == "thread-user"
        assert "long" not in account.encrypted_access_token
    replay = client.post(
        "/api/v1/channels/threads/callback", json={"code": "code", "state": start.json()["state"]}
    )
    assert replay.status_code == 400 and len(calls) == 3
    asyncio.run(http.aclose())


def test_threads_connect_cannot_override_registered_callback(client, auth, monkeypatch):
    monkeypatch.setattr(get_settings(), "threads_redirect_uri", URI)
    monkeypatch.setitem(
        channel_registry._adapters, "threads", ThreadsAdapter(app_id="app", app_secret="secret")
    )
    response = client.post(
        "/api/v1/channels/threads/connect", headers=auth, json={"redirect_uri": URI + "extra"}
    )
    assert response.status_code == 422


def test_threads_insecure_configuration_returns_actionable_error(client, auth, monkeypatch):
    monkeypatch.setattr(get_settings(), "threads_redirect_uri", "http://localhost:18000/callback")
    monkeypatch.setitem(
        channel_registry._adapters, "threads", ThreadsAdapter(app_id="app", app_secret="secret")
    )
    response = client.post("/api/v1/channels/threads/connect", headers=auth)
    assert response.status_code == 422
    assert "HTTPS" in response.json()["detail"]
    assert "THREADS_REDIRECT_URI" in response.json()["detail"]


@pytest.mark.anyio
@pytest.mark.parametrize(
    "status_code,body",
    [
        (400, {"error": {"message": "(#100) Tried accessing nonexisting field (permissions) on node type (User)", "type": "OAuthException", "code": 100}}),
        (401, {"error": {"message": "Invalid OAuth access token", "type": "OAuthException", "code": 190}}),
        (404, {"error": {"message": "Unknown path", "type": "OAuthException", "code": 803}}),
        (200, {"success": True}),
    ],
)
async def test_threads_revoke_handles_unsupported_meta_responses(status_code, body):
    account = ConnectedAccount(
        workspace_id="ws_1",
        platform="threads",
        external_account_id="user_123",
        display_name="Test User",
        encrypted_access_token=encrypt_token("valid_token"),
    )

    def handler(request: httpx.Request):
        assert request.method == "DELETE"
        assert request.url.path == "/v1.0/me/permissions"
        assert request.url.params["access_token"] == "valid_token"
        return httpx.Response(status_code, json=body)

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as http:
        adapter = ThreadsAdapter(app_id="app", app_secret="secret", http_client=http)
        # Should complete gracefully without raising any exception
        await adapter.revoke(account)


@pytest.mark.anyio
async def test_threads_revoke_raises_on_server_error():
    account = ConnectedAccount(
        workspace_id="ws_1",
        platform="threads",
        external_account_id="user_123",
        display_name="Test User",
        encrypted_access_token=encrypt_token("valid_token"),
    )

    def handler(request: httpx.Request):
        return httpx.Response(500, json={"error": "Internal server error"})

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as http:
        adapter = ThreadsAdapter(app_id="app", app_secret="secret", http_client=http)
        with pytest.raises(httpx.HTTPStatusError):
            await adapter.revoke(account)


def test_threads_disconnect_success_via_api(client, auth, monkeypatch):
    """Disconnecting a Threads account must succeed even when Meta returns 400 for permissions deletion."""
    account_id = None
    with SessionLocal() as db:
        # Get workspace id from current user
        from app.modules.workspaces.models import Workspace
        ws = db.scalar(select(Workspace))
        account = ConnectedAccount(
            workspace_id=ws.id,
            platform="threads",
            external_account_id="threads_del_test",
            display_name="Threads User",
            status="active",
            encrypted_access_token=encrypt_token("threads_tok"),
        )
        db.add(account)
        db.commit()
        db.refresh(account)
        account_id = account.id

    def handler(request: httpx.Request):
        assert request.method == "DELETE"
        # Meta returns 400 OAuthException when deleting permissions on graph.threads.net
        return httpx.Response(
            400,
            json={"error": {"message": "(#100) Tried accessing nonexisting field (permissions) on node type (User)", "code": 100}},
        )

    http = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    adapter = ThreadsAdapter(app_id="app", app_secret="secret", http_client=http)
    monkeypatch.setitem(channel_registry._adapters, "threads", adapter)

    resp = client.delete(f"/api/v1/channels/accounts/{account_id}", headers=auth)
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["status"] == "disconnected"
    assert data["account_id"] == account_id

    # Verify deleted from db
    with SessionLocal() as db:
        assert db.get(ConnectedAccount, account_id) is None


@pytest.mark.anyio
async def test_disconnect_account_already_in_needs_reauth_deletes_account(client, auth):
    """If an account was already marked needs_reauth, failing revocation must still allow deleting."""
    from types import SimpleNamespace

    account_id = None
    with SessionLocal() as db:
        from app.modules.workspaces.models import Workspace
        ws = db.scalar(select(Workspace))
        account = ConnectedAccount(
            workspace_id=ws.id,
            platform="threads",
            external_account_id="reauth_test_user",
            display_name="Broken Account",
            status="needs_reauth",
            encrypted_access_token=encrypt_token("expired_tok"),
        )
        db.add(account)
        db.commit()
        db.refresh(account)
        account_id = account.id

    async def fail_revoke(acc):
        raise RuntimeError("Provider offline or token invalid")

    fake_adapter = SimpleNamespace(revoke=fail_revoke)
    with SessionLocal() as db:
        acc_row = db.get(ConnectedAccount, account_id)
        assert acc_row.status == "needs_reauth"
        # Must not raise 502; must delete the account
        await disconnect_account(db, acc_row, fake_adapter)
        assert db.get(ConnectedAccount, account_id) is None

