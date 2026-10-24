from datetime import UTC, datetime, timedelta

import httpx
import pytest

from app.db.session import SessionLocal
from app.modules.channels.adapters.x import XAdapter
from app.modules.channels.models import ConnectedAccount
from app.modules.channels.oauth import (
    OAuthRefreshError,
    decrypt_token,
    encrypt_token,
    is_permanent_auth_error,
    refresh_expiring_accounts,
)
from app.modules.identity.models import User, Workspace


@pytest.mark.anyio
@pytest.mark.parametrize("code", [400, 429, 500])
async def test_refresh_rejections_stop_permanent_retries_but_retry_transient_failures(
    auth, code, caplog
):
    with SessionLocal() as db:
        user = db.query(User).filter_by(email="owner@example.com").one()
        workspace = db.query(Workspace).filter_by(owner_user_id=user.id).one()
        account = ConnectedAccount(
            workspace_id=workspace.id,
            platform="x",
            external_account_id="refresh-fixture",
            display_name="Writer",
            status="active",
            encrypted_access_token=encrypt_token("old-access"),
            encrypted_refresh_token=encrypt_token("old-refresh"),
            token_expires_at=datetime.now(UTC) - timedelta(minutes=1),
        )
        db.add(account)
        db.commit()
        requests = []

        def handler(request):
            requests.append(request)
            if len(requests) == 1:
                return httpx.Response(
                    code,
                    json={
                        "error": "invalid_request",
                        "error_description": "PRIVATE_PROVIDER_TOKEN_DETAIL",
                    },
                )
            return httpx.Response(
                200,
                json={
                    "access_token": "new-access",
                    "refresh_token": "rotated-refresh",
                    "expires_in": 7200,
                },
            )

        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
            adapter = XAdapter(client_id="fixture-client", http_client=client)
            assert await refresh_expiring_accounts(db, {"x": adapter}) == []
            db.refresh(account)
            assert account.status == ("needs_reauth" if code == 400 else "active")
            refreshed = await refresh_expiring_accounts(db, {"x": adapter})
            if code == 400:
                assert refreshed == []
                assert len(requests) == 1
            else:
                assert len(requests) == 2
                assert len(refreshed) == 1
                db.refresh(account)
                assert decrypt_token(account.encrypted_refresh_token) == "rotated-refresh"
                assert decrypt_token(account.encrypted_access_token) == "new-access"
        assert "PRIVATE_PROVIDER_TOKEN_DETAIL" not in caplog.text


@pytest.mark.anyio
@pytest.mark.parametrize(
    "data",
    [
        {},
        [],
        {"access_token": ""},
        {"access_token": "new", "refresh_token": None},
        {"access_token": "new", "expires_in": -1},
        {"access_token": "new", "scope": []},
    ],
)
async def test_malformed_refresh_success_preserves_credentials_and_is_transient(data):
    account = ConnectedAccount(
        encrypted_access_token=encrypt_token("old-access"),
        encrypted_refresh_token=encrypt_token("old-refresh"),
    )
    async with httpx.AsyncClient(
        transport=httpx.MockTransport(lambda _: httpx.Response(200, json=data))
    ) as client:
        with pytest.raises(OAuthRefreshError) as raised:
            await XAdapter(client_id="fixture-client", http_client=client).refresh_tokens(account)
    assert not is_permanent_auth_error(raised.value)
    assert decrypt_token(account.encrypted_access_token) == "old-access"
    assert decrypt_token(account.encrypted_refresh_token) == "old-refresh"
