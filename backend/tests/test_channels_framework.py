import base64
import hashlib
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import uuid4

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.db.session import SessionLocal
from app.main import app
from app.modules.channels.base import (
    AccountMetrics,
    AuthStart,
    Capabilities,
    Issue,
    Metrics,
    PublishResult,
    Target,
)
from app.modules.channels.models import ConnectedAccount
from app.modules.channels.oauth import (
    create_oauth_state,
    decrypt_token,
    encrypt_token,
    generate_pkce_pair,
    refresh_account_tokens,
    refresh_expiring_accounts,
    verify_and_consume_oauth_state,
)
from app.modules.channels.registry import channel_registry
from app.modules.identity.models import PasswordCredential, SessionToken, User
from app.modules.workspaces.models import Workspace, WorkspaceMembership


class FakePlatformAdapter:
    """Mock platform adapter implementing PlatformAdapter protocol for tests."""

    def __init__(self, platform: str = "mock_social", fail_refresh: bool = False) -> None:
        self.platform = platform
        self.fail_refresh = fail_refresh
        self.revoked_accounts: list[str] = []
        self.capabilities = Capabilities(
            platform=platform,
            display_name="Mock Social Network",
            max_text_length=500,
            supports_media=True,
            max_media_count=4,
            requires_target=True,
            target_type_name="page",
            supports_account_metrics=True,
        )

    async def build_auth_url(self, workspace_id: str, state: str, **opts: Any) -> AuthStart:
        return AuthStart(
            auth_url=f"https://auth.mocksocial.test/authorize?client_id=client_123&state={state}",
            state=state,
            code_verifier=opts.get("code_verifier"),
        )

    async def handle_callback(
        self,
        workspace_id: str,
        params: dict[str, Any],
        state: str,
        **opts: Any,
    ) -> ConnectedAccount:
        return ConnectedAccount(
            workspace_id=workspace_id,
            platform=self.platform,
            external_account_id=params.get("user_id", "mock_ext_123"),
            display_name="Mock Display Name",
            account_type="creator",
            encrypted_access_token=encrypt_token("access_secret_token_123"),
            encrypted_refresh_token=encrypt_token("refresh_secret_token_456"),
            token_expires_at=datetime.now(UTC) + timedelta(hours=2),
            granted_scopes=["read", "write", "pages_manage"],
            status="active",
            account_metadata={"username": "mockuser"},
        )

    async def refresh_tokens(self, account: ConnectedAccount) -> ConnectedAccount:
        if self.fail_refresh:
            raise RuntimeError("OAuth provider rejected refresh token (token expired/revoked)")
        account.encrypted_access_token = encrypt_token("new_refreshed_access_token")
        account.token_expires_at = datetime.now(UTC) + timedelta(hours=4)
        return account

    async def revoke(self, account: ConnectedAccount) -> None:
        self.revoked_accounts.append(account.external_account_id)

    async def list_targets(self, account: ConnectedAccount) -> list[Target]:
        return [
            Target(
                id="page_target_1",
                name="Marketing Page",
                target_type="page",
                description="Official company updates",
            )
        ]

    async def validate(self, variant: Any) -> list[Issue]:
        text = getattr(variant, "payload", {}).get("text", "")
        if len(text) > self.capabilities.max_text_length:
            return [
                Issue(
                    field="text",
                    message="Text exceeds max length",
                    severity="error",
                )
            ]
        return []

    async def publish(self, account: ConnectedAccount, variant: Any) -> PublishResult:
        return PublishResult(
            success=True,
            external_post_id="post_mock_789",
            external_url="https://mocksocial.test/p/789",
        )

    async def delete_post(self, account: ConnectedAccount, external_post_id: str) -> None:
        pass

    async def fetch_metrics(self, account: ConnectedAccount, external_post_id: str) -> Metrics:
        return Metrics(impressions=500, reach=400, likes=42, comments=7)

    async def fetch_account_metrics(self, account: ConnectedAccount) -> AccountMetrics:
        return AccountMetrics(followers_count=1200, profile_views=350, impressions=15000)


@pytest.fixture(autouse=True)
def register_fake_adapter():
    adapter = FakePlatformAdapter(platform="mock_social")
    channel_registry.register(adapter)
    yield adapter
    channel_registry.unregister("mock_social")


@pytest.fixture
def auth_client():
    client = TestClient(app)
    user_id = str(uuid4())
    ws_id = str(uuid4())
    raw_token = "test_token_" + str(uuid4())

    with SessionLocal.begin() as db:
        user = User(
            id=user_id,
            email=f"user_{uuid4().hex[:8]}@example.com",
            name="Channel Tester",
            email_verified=True,
            is_active=True,
        )
        ws = Workspace(
            id=ws_id,
            name="Channel Test WS",
            slug=f"ws-{uuid4().hex[:8]}",
            owner_user_id=user_id,
        )
        cred = PasswordCredential(user_id=user_id, password_hash="hashed")
        membership = WorkspaceMembership(workspace_id=ws_id, user_id=user_id, role="owner")
        session = SessionToken(
            user_id=user_id,
            token_hash=hashlib.sha256(raw_token.encode("utf-8")).hexdigest(),
            expires_at=datetime.now(UTC) + timedelta(days=1),
        )
        db.add_all([user, ws, cred, membership, session])

    client.headers.update(
        {
            "Authorization": f"Bearer {raw_token}",
            "X-Workspace-ID": ws_id,
        }
    )
    return client, ws_id, user_id


def test_token_encryption_and_decryption():
    raw_secret = "my_super_secret_oauth_token_12345"
    encrypted = encrypt_token(raw_secret)
    assert encrypted != raw_secret
    decrypted = decrypt_token(encrypted)
    assert decrypted == raw_secret

    assert encrypt_token(None) is None
    assert decrypt_token(None) is None


def test_generate_pkce_pair():
    verifier, challenge = generate_pkce_pair(64)
    assert len(verifier) == 64
    assert "=" not in challenge

    # Re-compute challenge and verify S256 formula
    expected_challenge = (
        base64.urlsafe_b64encode(hashlib.sha256(verifier.encode("ascii")).digest())
        .decode("ascii")
        .rstrip("=")
    )
    assert challenge == expected_challenge


def test_oauth_state_lifecycle_and_replay_protection():
    with SessionLocal() as db:
        ws_id = str(uuid4())
        user_id = str(uuid4())

        record, raw_state = create_oauth_state(
            db=db,
            workspace_id=ws_id,
            user_id=user_id,
            platform="mock_social",
            code_verifier="test_code_verifier",
            redirect_uri="https://app.postflow.ai/callback",
            instance_domain="mastodon.example.org",
            ttl_minutes=10,
        )

        assert record.id is not None
        assert record.state_hash is not None

        # 1. First verification succeeds and consumes state
        consumed = verify_and_consume_oauth_state(db, "mock_social", raw_state)
        assert consumed.workspace_id == ws_id
        assert consumed.code_verifier == "test_code_verifier"
        assert consumed.instance_domain == "mastodon.example.org"

        # 2. Immediate second call with same raw_state must fail (consumed / replay protection)
        with pytest.raises(HTTPException):
            verify_and_consume_oauth_state(db, "mock_social", raw_state)


def test_oauth_state_expiration():
    with SessionLocal() as db:
        ws_id = str(uuid4())
        user_id = str(uuid4())

        # Expired state
        _, raw_state = create_oauth_state(
            db=db,
            workspace_id=ws_id,
            user_id=user_id,
            platform="mock_social",
            ttl_minutes=-5,  # already expired
        )

        with pytest.raises(HTTPException):
            verify_and_consume_oauth_state(db, "mock_social", raw_state)


@pytest.mark.anyio
async def test_token_refresh_and_needs_reauth_flagging():
    with SessionLocal.begin() as db:
        ws_id = str(uuid4())
        account = ConnectedAccount(
            workspace_id=ws_id,
            platform="mock_social",
            external_account_id="acc_refresh_test",
            display_name="Refresh Target",
            account_type="profile",
            encrypted_access_token=encrypt_token("old_token"),
            token_expires_at=datetime.now(UTC) + timedelta(minutes=5),
            status="active",
        )
        db.add(account)

    with SessionLocal() as db:
        acc = db.scalar(select(ConnectedAccount).where(ConnectedAccount.external_account_id == "acc_refresh_test"))
        adapter = FakePlatformAdapter(fail_refresh=False)

        # Successful refresh
        updated = await refresh_account_tokens(db, acc, adapter)
        assert updated.status == "active"
        assert decrypt_token(updated.encrypted_access_token) == "new_refreshed_access_token"

        # Failed refresh -> status marked needs_reauth
        failing_adapter = FakePlatformAdapter(fail_refresh=True)
        with pytest.raises(RuntimeError):
            await refresh_account_tokens(db, acc, failing_adapter)

    with SessionLocal() as db:
        rechecked = db.scalar(
            select(ConnectedAccount).where(ConnectedAccount.external_account_id == "acc_refresh_test")
        )
        assert rechecked.status == "needs_reauth"


@pytest.mark.anyio
async def test_refresh_expiring_accounts():
    now = datetime.now(UTC)
    with SessionLocal.begin() as db:
        ws_id = str(uuid4())
        # 1. Expiring in 10 mins (within 60m window)
        acc1 = ConnectedAccount(
            workspace_id=ws_id,
            platform="mock_social",
            external_account_id="expiring_soon",
            display_name="Expiring Soon",
            account_type="profile",
            encrypted_access_token=encrypt_token("tok1"),
            token_expires_at=now + timedelta(minutes=10),
            status="active",
        )
        # 2. Expiring in 5 hours (outside 60m window)
        acc2 = ConnectedAccount(
            workspace_id=ws_id,
            platform="mock_social",
            external_account_id="expiring_later",
            display_name="Expiring Later",
            account_type="profile",
            encrypted_access_token=encrypt_token("tok2"),
            token_expires_at=now + timedelta(hours=5),
            status="active",
        )
        db.add_all([acc1, acc2])

    with SessionLocal() as db:
        adapter = FakePlatformAdapter()
        refreshed = await refresh_expiring_accounts(db, {"mock_social": adapter}, lookahead_minutes=60)
        external_ids = [a.external_account_id for a in refreshed]
        assert "expiring_soon" in external_ids
        assert "expiring_later" not in external_ids


def test_channels_endpoints_full_lifecycle(auth_client):
    client, _ws_id, _ = auth_client

    # 1. Get all capabilities
    cap_resp = client.get("/api/v1/channels/capabilities")
    assert cap_resp.status_code == 200
    caps = cap_resp.json()["platforms"]
    assert "mock_social" in caps
    assert caps["mock_social"]["max_text_length"] == 500
    assert caps["mock_social"]["requires_target"] is True

    # 2. Get specific platform capabilities
    single_cap = client.get("/api/v1/channels/capabilities/mock_social")
    assert single_cap.status_code == 200
    assert single_cap.json()["display_name"] == "Mock Social Network"

    # 3. Non-existent platform capabilities -> 404
    not_found = client.get("/api/v1/channels/capabilities/unknown_network")
    assert not_found.status_code == 404

    # 4. Initiate OAuth connect
    connect_resp = client.post(
        "/api/v1/channels/mock_social/connect",
        json={"redirect_uri": "https://app.postflow.ai/callback", "options": {"scope": "all"}},
    )
    assert connect_resp.status_code == 200
    connect_data = connect_resp.json()
    assert "auth_url" in connect_data
    assert "state" in connect_data
    raw_state = connect_data["state"]

    # 5. Process Callback
    callback_resp = client.post(
        "/api/v1/channels/mock_social/callback",
        json={
            "code": "auth_code_from_provider",
            "state": raw_state,
            "params": {"user_id": "test_user_connected_1"},
        },
    )
    assert callback_resp.status_code == 200
    account_data = callback_resp.json()
    assert account_data["platform"] == "mock_social"
    assert account_data["external_account_id"] == "test_user_connected_1"
    assert account_data["display_name"] == "Mock Display Name"
    assert account_data["status"] == "active"
    account_id = account_data["id"]

    # 6. List connected accounts
    list_resp = client.get("/api/v1/channels/accounts")
    assert list_resp.status_code == 200
    accounts = list_resp.json()
    assert len(accounts) >= 1
    matched = next((a for a in accounts if a["id"] == account_id), None)
    assert matched is not None
    # Crucial security check: sensitive tokens must NOT be present in JSON response
    assert "encrypted_access_token" not in matched
    assert "encrypted_refresh_token" not in matched

    # 7. List targets for account
    target_resp = client.get(f"/api/v1/channels/accounts/{account_id}/targets")
    assert target_resp.status_code == 200
    target_data = target_resp.json()
    assert target_data["platform"] == "mock_social"
    assert len(target_data["targets"]) == 1
    assert target_data["targets"][0]["id"] == "page_target_1"

    # 8. Refresh account manually
    refresh_resp = client.post(f"/api/v1/channels/accounts/{account_id}/refresh")
    assert refresh_resp.status_code == 200
    assert refresh_resp.json()["status"] == "active"

    # 9. Disconnect account
    disconnect_resp = client.post(f"/api/v1/channels/accounts/{account_id}/disconnect")
    assert disconnect_resp.status_code == 200
    assert disconnect_resp.json()["status"] == "disconnected"

    # 10. Verify account is gone
    get_gone = client.get(f"/api/v1/channels/accounts/{account_id}")
    assert get_gone.status_code == 404
