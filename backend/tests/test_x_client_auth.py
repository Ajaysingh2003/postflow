import base64
from urllib.parse import parse_qs

import httpx
import pytest
from fastapi import HTTPException

from app.modules.channels.adapters.x import X_TOKEN_URL, XAdapter
from app.modules.channels.models import ConnectedAccount
from app.modules.channels.oauth import encrypt_token


@pytest.mark.anyio
async def test_x_web_app_authenticates_code_exchange_refresh_and_revocation():
    requests = []
    client_id, secret = "oauth2-client", "oauth2-secret"
    expected = "Basic " + base64.b64encode(f"{client_id}:{secret}".encode()).decode()

    def handler(request):
        requests.append(request)
        if request.url.path.endswith("/users/me"):
            assert request.headers["Authorization"] == "Bearer access-token"
            return httpx.Response(200, json={"data": {"id": "123", "name": "Writer"}})
        assert request.headers["Authorization"] == expected
        form = parse_qs(request.content.decode())
        assert form["client_id"] == [client_id]
        assert "client_secret" not in form
        if form.get("grant_type") == ["authorization_code"]:
            assert form["code_verifier"] == ["pkce-verifier"]
            assert form["redirect_uri"] == ["https://api.draftva.com/api/v1/channels/x/callback"]
        if form.get("grant_type") == ["refresh_token"]:
            assert form["refresh_token"] == ["refresh-token"]
        return httpx.Response(
            200, json={"access_token": "access-token", "refresh_token": "refresh-token"}
        )

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        adapter = XAdapter(client_id=client_id, client_secret=secret, http_client=client)
        account = await adapter.handle_callback(
            "workspace",
            {"code": "code"},
            "state",
            code_verifier="pkce-verifier",
            redirect_uri="https://api.draftva.com/api/v1/channels/x/callback",
        )
        await adapter.refresh_tokens(account)
        await adapter.revoke(account)
    assert len(requests) == 4
    assert str(requests[0].url) == X_TOKEN_URL


@pytest.mark.anyio
@pytest.mark.parametrize(
    "body,status_code,expected_status",
    [
        ({"error": "unauthorized_client", "error_description": "PRIVATE credential"}, 401, 503),
        ({"error": "invalid_client", "error_description": "PRIVATE credential"}, 401, 503),
        ({"error": "invalid_grant", "error_description": "PRIVATE authorization code"}, 400, 400),
        ({"error": ["unexpected", "PRIVATE"]}, 400, 400),
        (["PRIVATE"], 500, 400),
    ],
)
async def test_x_token_errors_are_actionable_without_exposing_provider_data(
    body, status_code, expected_status, caplog
):
    async with httpx.AsyncClient(
        transport=httpx.MockTransport(lambda request: httpx.Response(status_code, json=body))
    ) as client:
        adapter = XAdapter(client_id="oauth2-client", client_secret="secret", http_client=client)
        with pytest.raises(HTTPException) as error:
            await adapter.handle_callback(
                "workspace", {"code": "code"}, "state", code_verifier="verifier"
            )
    assert error.value.status_code == expected_status
    assert "PRIVATE" not in str(error.value.detail) + caplog.text
    assert "new connection" in error.value.detail


@pytest.mark.anyio
async def test_public_x_clients_can_still_use_pkce_without_basic_auth(monkeypatch):
    monkeypatch.setattr(
        "app.modules.channels.adapters.x.get_settings",
        lambda: type(
            "Settings",
            (),
            {
                "x_client_id": None,
                "x_client_secret": None,
                "oauth_callback_url": lambda self, platform: "https://app.example/callback",
            },
        )(),
    )

    def handler(request):
        assert "authorization" not in request.headers
        assert parse_qs(request.content.decode())["client_id"] == ["public-client"]
        return httpx.Response(200, json={"access_token": "new-token"})

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        account = ConnectedAccount(encrypted_refresh_token=encrypt_token("refresh"))
        await XAdapter(client_id="public-client", http_client=client).refresh_tokens(account)
