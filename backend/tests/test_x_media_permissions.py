import base64
import json
from types import SimpleNamespace

import httpx
import pytest
from fastapi import HTTPException

from app.modules.channels.adapters.media import upload_x
from app.modules.channels.adapters.x import XAdapter
from app.modules.channels.models import ConnectedAccount
from app.modules.channels.oauth import encrypt_token


@pytest.mark.anyio
async def test_legacy_account_requires_reconnect_before_reading_or_uploading(monkeypatch):
    def forbidden_read(*args):
        pytest.fail("Missing upload permission must be detected before reading media")

    monkeypatch.setattr("app.modules.media.service.read_ready", forbidden_read)

    def forbidden_request(request):
        pytest.fail("Missing upload permission must not make an HTTP request")

    account = SimpleNamespace(granted_scopes=["tweet.write"])
    variant = SimpleNamespace(payload={"text": "Photo post"}, publish_state={})
    async with httpx.AsyncClient(transport=httpx.MockTransport(forbidden_request)) as client:
        with pytest.raises(HTTPException) as error:
            await upload_x(XAdapter(http_client=client), account, variant, [(object(), "")])
    assert error.value.status_code == 401
    assert "Reconnect" in error.value.detail
    assert "media.write" in error.value.detail
    assert variant.publish_state == {}


@pytest.mark.anyio
@pytest.mark.parametrize("status_code", [401, 402, 403, 429, 500, 503, 504])
async def test_x_upload_failure_has_safe_actionable_error(status_code, monkeypatch):
    monkeypatch.setattr("app.modules.media.service.read_ready", lambda *_: b"image bytes")
    account = SimpleNamespace(
        granted_scopes=["media.write"], encrypted_access_token=encrypt_token("test_access")
    )
    variant = SimpleNamespace(payload={"text": "Photo post"}, publish_state={})
    asset = SimpleNamespace(id="image", content_type="image/jpeg")

    def handler(request):
        assert request.url.path == "/2/media/upload"
        assert request.headers["Authorization"] == "Bearer test_access"
        body = json.loads(request.content)
        assert base64.b64decode(body["media"]) == b"image bytes"
        assert body["media_category"] == "tweet_image"
        return httpx.Response(
            status_code,
            json={"detail": "Do not expose this response with secret_value"},
            headers={"Retry-After": "90"},
        )

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        with pytest.raises(HTTPException) as error:
            await upload_x(XAdapter(http_client=client), account, variant, [(asset, "")])
    assert error.value.status_code == status_code
    assert "X" in error.value.detail
    assert "secret_value" not in error.value.detail
    assert error.value.headers == {"Retry-After": "90"}
    assert variant.publish_state == {}
    if status_code == 403:
        assert "media.write" in error.value.detail
        assert "API access" in error.value.detail


@pytest.mark.anyio
async def test_token_refresh_preserves_or_replaces_actual_granted_scopes():
    token_responses = [
        {"access_token": "new_access", "scope": "tweet.write"},
        {"access_token": "another_access"},
    ]

    def handler(request):
        return httpx.Response(200, json=token_responses.pop(0))

    account = ConnectedAccount(
        encrypted_refresh_token=encrypt_token("refresh"), granted_scopes=["media.write"]
    )
    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        adapter = XAdapter(http_client=client)
        await adapter.refresh_tokens(account)
        assert account.granted_scopes == ["tweet.write"]
        await adapter.refresh_tokens(account)
        assert account.granted_scopes == ["tweet.write"]


@pytest.mark.anyio
@pytest.mark.parametrize("requested_scopes", [[], ["tweet.write"], ["tweet.write", "media.write"]])
async def test_callback_uses_only_saved_request_when_scope_is_omitted(requested_scopes):
    def handler(request):
        if request.url.path.endswith("/oauth2/token"):
            return httpx.Response(200, json={"access_token": "test_access"})
        return httpx.Response(200, json={"data": {"id": "user", "name": "Test"}})

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        account = await XAdapter(http_client=client).handle_callback(
            "workspace",
            {"code": "test_code"},
            "state",
            code_verifier="test_verifier",
            oauth_metadata={"requested_scopes": requested_scopes},
        )
    assert account.granted_scopes == requested_scopes
