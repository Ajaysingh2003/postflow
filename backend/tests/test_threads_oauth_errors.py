"""Token exchanges fail closed without leaking provider URLs into OAuth redirects."""

import asyncio
from urllib.parse import parse_qs, urlsplit

import httpx
import pytest
from fastapi import HTTPException
from sqlalchemy import select

from app.core.config import get_settings
from app.db.session import SessionLocal
from app.modules.channels.adapters.threads import ThreadsAdapter
from app.modules.channels.models import ConnectedAccount
from app.modules.channels.oauth import decrypt_token, encrypt_token
from app.modules.channels.registry import channel_registry

CALLBACK = "https://api.example/api/v1/channels/threads/callback"
SECRET = "PRIVATE-APP-SECRET"
SHORT = "PRIVATE-SHORT-TOKEN"
LONG = "PRIVATE-LONG-TOKEN"
CODE = "PRIVATE-AUTH-CODE"


def exchange_response(request):
    if request.url.path == "/oauth/access_token":
        body = parse_qs(request.content.decode())
        assert body["client_id"] == ["threads-app"]
        assert body["client_secret"] == [SECRET]
        assert body["redirect_uri"] == [CALLBACK]
        return httpx.Response(200, json={"access_token": SHORT})
    if request.url.path == "/access_token":
        assert request.url.params["grant_type"] == "th_exchange_token"
        assert request.url.params["client_secret"] == SECRET
        assert request.url.params["access_token"] == SHORT
        return httpx.Response(200, json={"access_token": LONG, "expires_in": 5184000})
    return httpx.Response(200, json={"id": "user", "username": "writer"})


@pytest.mark.anyio
@pytest.mark.parametrize(
    "path,operation",
    [
        ("/oauth/access_token", "authorization code exchange"),
        ("/access_token", "long-lived token exchange"),
        ("/v1.0/me", "profile lookup"),
    ],
)
async def test_provider_error_exposes_only_stage_and_numeric_codes(path, operation, caplog):
    calls = []

    def handler(request):
        calls.append(request.url.path)
        if request.url.path == path:
            return httpx.Response(
                400,
                json={"error": {"code": 100, "error_subcode": 42,
                                "message": f"Rejected {SECRET} {SHORT} {LONG} {CODE}"}},
            )
        return exchange_response(request)

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        adapter = ThreadsAdapter(app_id="threads-app", app_secret=SECRET, http_client=client)
        with pytest.raises(HTTPException) as failure:
            await adapter.handle_callback("ws", {"code": CODE}, "state", redirect_uri=CALLBACK)
    assert failure.value.status_code == 400
    assert operation in failure.value.detail
    assert "code 100, subcode 42" in failure.value.detail
    assert "matching Threads app credentials" in failure.value.detail
    assert calls[-1] == path
    output = failure.value.detail + caplog.text
    assert not any(secret in output for secret in (SECRET, SHORT, LONG, CODE))
    assert "graph.threads.net/access_token?" not in failure.value.detail


@pytest.mark.anyio
@pytest.mark.parametrize(
    "status,body,expected_status,hint",
    [
        (400, {"error": {"code": 190}}, 400, "rejected the token"),
        (429, {"error": {"code": 4}}, 429, "rate limiting"),
        (503, {"error": {"code": 2}}, 503, "temporarily unavailable"),
        (200, {"error": {"code": 190}}, 400, "rejected the token"),
        (400, {"error": {"code": SECRET, "error_subcode": SHORT}}, 400, "credentials"),
        (400, [SECRET], 400, "credentials"),
    ],
)
async def test_exchange_error_classification(status, body, expected_status, hint, caplog):
    def handler(request):
        if request.url.path == "/access_token":
            return httpx.Response(status, json=body)
        return exchange_response(request)

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        adapter = ThreadsAdapter(app_id="threads-app", app_secret=SECRET, http_client=client)
        with pytest.raises(HTTPException) as failure:
            await adapter.handle_callback("ws", {"code": CODE}, "state", redirect_uri=CALLBACK)
    assert failure.value.status_code == expected_status
    assert hint in failure.value.detail
    assert SECRET not in failure.value.detail + caplog.text
    assert SHORT not in failure.value.detail + caplog.text


@pytest.mark.anyio
@pytest.mark.parametrize(
    "body",
    [
        [], None, {}, {"access_token": ""}, {"access_token": 123},
        {"access_token": "   "}, {"access_token": LONG},
        *[{"access_token": LONG, "expires_in": expiry}
          for expiry in (True, 0, -1, 1.5, "bad", 10**100)],
    ],
)
async def test_invalid_long_lived_tokens_never_reach_profile_lookup(body):
    def handler(request):
        if request.url.path == "/access_token":
            return httpx.Response(200, json=body)
        assert request.url.path == "/oauth/access_token"
        return exchange_response(request)

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        adapter = ThreadsAdapter(app_id="threads-app", app_secret=SECRET, http_client=client)
        with pytest.raises(HTTPException) as failure:
            await adapter.handle_callback("ws", {"code": CODE}, "state", redirect_uri=CALLBACK)
    assert failure.value.status_code == 502
    assert LONG not in failure.value.detail


@pytest.mark.anyio
async def test_network_failure_never_exposes_request_url_or_transport_message(caplog):
    def handler(request):
        if request.url.path == "/access_token":
            raise httpx.ReadTimeout(f"Timed out on {request.url}", request=request)
        return exchange_response(request)

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        adapter = ThreadsAdapter(app_id="threads-app", app_secret=SECRET, http_client=client)
        with pytest.raises(HTTPException) as failure:
            await adapter.handle_callback("ws", {"code": CODE}, "state", redirect_uri=CALLBACK)
    assert failure.value.status_code == 503
    assert "long-lived token exchange" in failure.value.detail
    assert not any(secret in failure.value.detail + caplog.text for secret in (SECRET, SHORT))


@pytest.mark.anyio
async def test_refresh_rejection_preserves_stored_token_and_expiry():
    account = ConnectedAccount(encrypted_access_token=encrypt_token(LONG))
    token, expiry = account.encrypted_access_token, account.token_expires_at
    async with httpx.AsyncClient(
        transport=httpx.MockTransport(lambda request: httpx.Response(200, json={"expires_in": 0}))
    ) as client:
        adapter = ThreadsAdapter(app_id="threads-app", app_secret=SECRET, http_client=client)
        with pytest.raises(HTTPException):
            await adapter.refresh_tokens(account)
    assert account.encrypted_access_token == token
    assert account.token_expires_at == expiry
    assert decrypt_token(account.encrypted_access_token) == LONG


@pytest.mark.anyio
@pytest.mark.parametrize("profile", [{}, [], {"id": True}, {"id": " "}, {"id": None}])
async def test_invalid_profile_is_rejected(profile):
    def handler(request):
        if request.url.path == "/v1.0/me":
            return httpx.Response(200, json=profile)
        return exchange_response(request)

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        adapter = ThreadsAdapter(app_id="threads-app", app_secret=SECRET, http_client=client)
        with pytest.raises(HTTPException) as failure:
            await adapter.handle_callback("ws", {"code": CODE}, "state", redirect_uri=CALLBACK)
    assert failure.value.status_code == 502


@pytest.mark.anyio
async def test_non_json_provider_error_is_safe():
    def handler(request):
        if request.url.path == "/access_token":
            return httpx.Response(502, text=f"<html>Upstream failure {SECRET}</html>")
        return exchange_response(request)

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        adapter = ThreadsAdapter(app_id="threads-app", app_secret=SECRET, http_client=client)
        with pytest.raises(HTTPException) as failure:
            await adapter.handle_callback("ws", {"code": CODE}, "state", redirect_uri=CALLBACK)
    assert failure.value.status_code == 503
    assert SECRET not in failure.value.detail


@pytest.mark.anyio
async def test_successful_exchange_accepts_numeric_expiry_string_and_encrypts_token():
    def handler(request):
        if request.url.path == "/access_token":
            return httpx.Response(200, json={"access_token": LONG, "expires_in": "5184000"})
        return exchange_response(request)

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        adapter = ThreadsAdapter(app_id="threads-app", app_secret=SECRET, http_client=client)
        account = await adapter.handle_callback(
            "ws", {"code": CODE}, "state", redirect_uri=CALLBACK
        )
    assert decrypt_token(account.encrypted_access_token) == LONG
    assert LONG not in account.encrypted_access_token
    assert account.token_expires_at is not None


@pytest.mark.parametrize("browser", [True, False])
def test_failed_exchange_does_not_save_account_and_callback_state_is_consumed(
    client, auth, monkeypatch, browser, caplog
):
    monkeypatch.setattr(get_settings(), "threads_redirect_uri", CALLBACK)

    def handler(request):
        if request.url.path == "/access_token":
            return httpx.Response(400, json={"error": {"code": 100, "message": SECRET}})
        return exchange_response(request)

    http = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    monkeypatch.setitem(
        channel_registry._adapters, "threads",
        ThreadsAdapter(app_id="threads-app", app_secret=SECRET, http_client=http),
    )
    start = client.post("/api/v1/channels/threads/connect", headers=auth)
    assert start.status_code == 200
    state = start.json()["state"]
    payload = {"code": CODE, "state": state}
    if browser:
        response = client.get(
            "/api/v1/channels/threads/callback", params=payload, follow_redirects=False
        )
        assert response.status_code == 302
        public = parse_qs(urlsplit(response.headers["location"]).query)["error"][0]
    else:
        response = client.post("/api/v1/channels/threads/callback", json=payload)
        assert response.status_code == 400
        public = response.json()["detail"]
    assert "long-lived token exchange" in public
    assert not any(secret in public + caplog.text for secret in (SECRET, SHORT, LONG, CODE))
    with SessionLocal() as db:
        assert db.scalar(select(ConnectedAccount)) is None
    replay = client.post("/api/v1/channels/threads/callback", json=payload)
    assert replay.status_code == 400
    asyncio.run(http.aclose())


def test_unexpected_adapter_exception_never_enters_redirect(client, auth, monkeypatch, caplog):
    monkeypatch.setattr(get_settings(), "threads_redirect_uri", CALLBACK)
    adapter = ThreadsAdapter(app_id="threads-app", app_secret=SECRET)

    async def fail(*args, **kwargs):
        raise RuntimeError(f"private upstream failure {SECRET} {LONG}")

    monkeypatch.setattr(adapter, "handle_callback", fail)
    monkeypatch.setitem(channel_registry._adapters, "threads", adapter)
    start = client.post("/api/v1/channels/threads/connect", headers=auth)
    response = client.get(
        "/api/v1/channels/threads/callback",
        params={"state": start.json()["state"], "code": CODE},
        follow_redirects=False,
    )
    assert response.status_code == 302
    public = parse_qs(urlsplit(response.headers["location"]).query)["error"][0]
    assert "new connection" in public
    assert not any(secret in public + caplog.text for secret in (SECRET, LONG, CODE))
