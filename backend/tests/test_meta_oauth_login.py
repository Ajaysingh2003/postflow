"""Instagram Login and Facebook Pages are independent OAuth products."""

import asyncio
from types import SimpleNamespace
from urllib.parse import parse_qs, urlparse

import httpx
import pytest
from fastapi import HTTPException
from sqlalchemy import select

from app.core.config import Settings, get_settings
from app.db.session import SessionLocal
from app.modules.channels.adapters.facebook import FacebookAdapter
from app.modules.channels.adapters.instagram import (
    GRAPH_API_BASE,
    INSTAGRAM_SCOPES,
    InstagramAdapter,
)
from app.modules.channels.models import ConnectedAccount
from app.modules.channels.oauth import decrypt_token, encrypt_token, refresh_account_tokens
from app.modules.channels.registry import channel_registry

IG_URI = "https://example.ngrok-free.dev/api/v1/channels/instagram/callback?source=a%2Fb"
FB_URI = "https://example.ngrok-free.dev/api/v1/channels/facebook/callback"


def test_exact_redirect_settings_and_legacy_template():
    settings = Settings(
        _env_file=None,
        instagram_redirect_uri=IG_URI,
        facebook_redirect_uri=FB_URI,
        oauth_redirect_base_url="https://shared.example/api/v1/channels/oauth/callback",
    )
    assert settings.oauth_callback_url("Instagram") == IG_URI
    assert settings.oauth_callback_url("facebook") == FB_URI
    assert (
        settings.oauth_callback_url("linkedin")
        == "https://shared.example/api/v1/channels/linkedin/callback"
    )
    settings.instagram_redirect_uri = ""
    assert (
        settings.oauth_callback_url("instagram")
        == "https://shared.example/api/v1/channels/instagram/callback"
    )


def test_missing_instagram_credentials_never_uses_facebook(client, auth, monkeypatch):
    settings = get_settings()
    monkeypatch.setattr(settings, "instagram_app_id", None)
    monkeypatch.setattr(settings, "instagram_app_secret", None)
    monkeypatch.setattr(settings, "facebook_app_id", "fb_only")
    monkeypatch.setattr(settings, "facebook_app_secret", "fb_secret")
    adapter = InstagramAdapter()
    assert adapter.app_id != "fb_only" and adapter.app_secret != "fb_secret"
    monkeypatch.setitem(channel_registry._adapters, "instagram", adapter)
    response = client.post("/api/v1/channels/instagram/connect", headers=auth)
    assert response.status_code == 503


@pytest.mark.anyio
async def test_authorize_products_and_optional_scopes(monkeypatch):
    settings = get_settings()
    monkeypatch.setattr(settings, "instagram_redirect_uri", IG_URI)
    monkeypatch.setattr(settings, "facebook_redirect_uri", FB_URI)
    instagram = InstagramAdapter(app_id="instagram_id", app_secret="instagram_secret")
    facebook = FacebookAdapter(app_id="facebook_id", app_secret="facebook_secret")
    ig = await instagram.build_auth_url("workspace", "ig_state", manage_replies=True)
    fb = await facebook.build_auth_url("workspace", "fb_state")
    ig_url, fb_url = urlparse(ig.auth_url), urlparse(fb.auth_url)
    ig_params, fb_params = parse_qs(ig_url.query), parse_qs(fb_url.query)
    assert ig_url.netloc == "www.instagram.com" and ig_url.path == "/oauth/authorize"
    assert ig_params["client_id"] == ["instagram_id"]
    assert ig_params["redirect_uri"] == [IG_URI]
    assert ig_params["state"] == ["ig_state"]
    assert ig_params["enable_fb_login"] == ["0"]
    assert ig_params["force_authentication"] == ["1"]
    assert set(ig_params["scope"][0].split(",")) == {
        *INSTAGRAM_SCOPES,
        "instagram_business_manage_comments",
    }
    assert fb_url.netloc == "www.facebook.com" and fb_url.path.endswith("/dialog/oauth")
    assert fb_params["client_id"] == ["facebook_id"]
    assert fb_params["redirect_uri"] == [FB_URI]
    assert "pages_manage_posts" in fb_params["scope"][0].split(",")
    assert not any(scope.startswith("instagram_") for scope in fb_params["scope"][0].split(","))
    with pytest.raises(HTTPException) as caught:
        await instagram.build_auth_url(
            "workspace", "state", scopes=["instagram_basic", "pages_show_list"]
        )
    assert caught.value.status_code == 422


def instagram_transport(calls, failure=None, wrapped=False):
    def handler(request):
        calls.append(request)
        if request.url.host == "api.instagram.com":
            assert request.method == "POST" and request.url.path == "/oauth/access_token"
            form = parse_qs(request.content.decode())
            assert form["client_id"] == ["instagram_id"]
            assert form["client_secret"] == ["instagram_secret"]
            assert form["redirect_uri"] == [IG_URI]
            assert form["grant_type"] == ["authorization_code"]
            if failure == "short":
                return httpx.Response(400, json={"error_message": "private-token-secret"})
            if failure == "missing_token":
                return httpx.Response(200, json={"user_id": "scoped_id"})
            data = {
                "access_token": "short_token",
                "user_id": "scoped_id",
                "permissions": ["instagram_business_basic", "instagram_business_content_publish"],
            }
            return httpx.Response(200, json={"data": [data]} if wrapped else data)
        assert request.url.host == "graph.instagram.com"
        if request.url.path == "/access_token":
            assert request.url.params["grant_type"] == "ig_exchange_token"
            assert request.url.params["access_token"] == "short_token"
            assert request.url.params["client_secret"] == "instagram_secret"
            if failure == "long":
                return httpx.Response(400, json={"error_message": "private-token-secret"})
            return httpx.Response(200, json={"access_token": "long_token", "expires_in": 5184000})
        assert request.url.path == urlparse(GRAPH_API_BASE).path + "/me"
        assert request.url.params["access_token"] == "long_token"
        if failure == "profile":
            return httpx.Response(403, json={"error": {"message": "private-token-secret"}})
        return httpx.Response(
            200,
            json={
                "id": "scoped_id",
                "user_id": "professional_id",
                "username": "creator_name",
                "account_type": "MEDIA_CREATOR",
                "profile_picture_url": "https://cdn.example/avatar.jpg",
            },
        )

    return httpx.MockTransport(handler)


@pytest.mark.parametrize("wrapped", [False, True])
def test_callback_routes_saved_redirect_encryption_reconnect_and_replay(
    client, auth, monkeypatch, wrapped
):
    settings = get_settings()
    monkeypatch.setattr(settings, "instagram_redirect_uri", IG_URI)
    calls = []
    http = httpx.AsyncClient(transport=instagram_transport(calls, wrapped=wrapped))
    adapter = InstagramAdapter(
        app_id="instagram_id", app_secret="instagram_secret", http_client=http
    )
    monkeypatch.setitem(channel_registry._adapters, "instagram", adapter)
    start = client.post("/api/v1/channels/instagram/connect", headers=auth)
    assert start.status_code == 200, start.text
    state = start.json()["state"]
    query = parse_qs(urlparse(start.json()["auth_url"]).query)
    assert query["redirect_uri"] == [IG_URI]
    # Configuration may change mid-login; exchange must use the URI saved in this state.
    monkeypatch.setattr(settings, "instagram_redirect_uri", "https://changed.example/callback")
    mismatch = client.get(
        "/api/v1/channels/facebook/callback",
        params={"code": "code", "state": state},
        headers={"accept": "application/json"},
    )
    assert mismatch.status_code == 400 and calls == []
    response = client.get(
        "/api/v1/channels/instagram/callback",
        params={"code": "code", "state": state},
        headers={"accept": "text/html"},
        follow_redirects=False,
    )
    assert response.status_code == 302
    assert response.headers["location"].endswith("/dashboard/channels?connected=instagram")
    assert len(calls) == 3
    with SessionLocal() as db:
        account = db.scalar(
            select(ConnectedAccount).where(ConnectedAccount.platform == "instagram")
        )
        assert account.external_account_id == "ig_professional_id"
        account_id = account.id
        assert decrypt_token(account.encrypted_access_token) == "long_token"
        assert "long_token" not in account.encrypted_access_token
        assert account.account_type == "creator"
        assert account.granted_scopes == [
            "instagram_business_basic",
            "instagram_business_content_publish",
        ]
        assert account.account_metadata["avatar_url"] == "https://cdn.example/avatar.jpg"
    replay = client.post(
        "/api/v1/channels/instagram/callback", json={"code": "code", "state": state}
    )
    assert replay.status_code == 400 and len(calls) == 3
    accounts = client.get("/api/v1/channels/accounts", headers=auth)
    assert "long_token" not in accounts.text and "short_token" not in accounts.text
    monkeypatch.setattr(settings, "instagram_redirect_uri", IG_URI)
    next_state = client.post("/api/v1/channels/instagram/connect", headers=auth).json()["state"]
    updated = client.post(
        "/api/v1/channels/instagram/callback", json={"code": "new_code", "state": next_state}
    )
    assert updated.status_code == 200 and updated.json()["id"] == account_id
    assert len(client.get("/api/v1/channels/accounts", headers=auth).json()) == 1
    asyncio.run(http.aclose())


@pytest.mark.parametrize("failure", ["short", "long", "profile", "missing_token"])
def test_provider_errors_create_no_account_and_do_not_expose_secrets(
    client, auth, monkeypatch, failure
):
    monkeypatch.setattr(get_settings(), "instagram_redirect_uri", IG_URI)
    calls = []
    http = httpx.AsyncClient(transport=instagram_transport(calls, failure=failure))
    monkeypatch.setitem(
        channel_registry._adapters,
        "instagram",
        InstagramAdapter(app_id="instagram_id", app_secret="instagram_secret", http_client=http),
    )
    state = client.post("/api/v1/channels/instagram/connect", headers=auth).json()["state"]
    response = client.post(
        "/api/v1/channels/instagram/callback", json={"code": "code", "state": state}
    )
    assert response.status_code == 400
    assert "private-token-secret" not in response.text
    assert client.get("/api/v1/channels/accounts", headers=auth).json() == []
    replay = client.post(
        "/api/v1/channels/instagram/callback", json={"code": "code", "state": state}
    )
    assert replay.status_code == 400
    asyncio.run(http.aclose())


def test_redirect_override_rejected(client, auth, monkeypatch):
    monkeypatch.setattr(get_settings(), "instagram_redirect_uri", IG_URI)
    monkeypatch.setitem(
        channel_registry._adapters, "instagram", InstagramAdapter(app_id="id", app_secret="secret")
    )
    response = client.post(
        "/api/v1/channels/instagram/connect", headers=auth, json={"redirect_uri": IG_URI + "/"}
    )
    assert response.status_code == 422


@pytest.mark.anyio
async def test_refresh_instagram_user_token_and_discard_page_cache():
    account = ConnectedAccount(
        encrypted_access_token=encrypt_token("old_token"),
        account_metadata={
            "oauth_flow": "instagram_login",
            "primary_ig_id": "professional_id",
            "ig_tokens": {"professional_id": encrypt_token("stale_page_token")},
        },
        status="active",
    )

    def handler(request):
        assert request.url.host == "graph.instagram.com"
        assert request.url.path == "/refresh_access_token"
        assert dict(request.url.params) == {
            "grant_type": "ig_refresh_token",
            "access_token": "old_token",
        }
        return httpx.Response(200, json={"access_token": "new_token", "expires_in": 5184000})

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as http:
        adapter = InstagramAdapter(http_client=http)
        await adapter.refresh_tokens(account)
    assert decrypt_token(account.encrypted_access_token) == "new_token"
    assert "ig_tokens" not in account.account_metadata
    assert adapter._get_ig_token(account, "professional_id") == "new_token"


@pytest.mark.anyio
async def test_legacy_instagram_refresh_requires_reconnect():
    adapter = InstagramAdapter()
    with pytest.raises(HTTPException, match="Reconnect Instagram"):
        await adapter.refresh_tokens(ConnectedAccount(account_metadata={}))


@pytest.mark.anyio
async def test_failed_refresh_marks_reauth_and_keeps_previous_token(client, auth):
    workspace_id = client.get("/api/v1/workspaces", headers=auth).json()[0]["id"]
    with SessionLocal() as db:
        account = ConnectedAccount(
            workspace_id=workspace_id,
            platform="instagram",
            external_account_id="ig_professional",
            display_name="Creator",
            account_type="creator",
            granted_scopes=INSTAGRAM_SCOPES,
            encrypted_access_token=encrypt_token("old_token"),
            account_metadata={"oauth_flow": "instagram_login"},
            status="active",
        )
        db.add(account)
        db.commit()
        async with httpx.AsyncClient(
            transport=httpx.MockTransport(
                lambda request: httpx.Response(400, json={"error": "expired"})
            )
        ) as http:
            with pytest.raises(HTTPException):
                await refresh_account_tokens(db, account, InstagramAdapter(http_client=http))
        assert account.status == "needs_reauth"
        assert decrypt_token(account.encrypted_access_token) == "old_token"


@pytest.mark.anyio
async def test_management_and_revoke_use_instagram_host():
    account = SimpleNamespace(
        id="id",
        granted_scopes=["instagram_business_manage_comments"],
        encrypted_access_token=encrypt_token("user_token"),
        account_metadata={"oauth_flow": "instagram_login"},
    )
    variant = SimpleNamespace(external_post_id="media_id", payload={}, publish_state={})
    paths = []

    def handler(request):
        assert request.url.host == "graph.instagram.com"
        paths.append((request.method, request.url.path))
        if request.method == "DELETE":
            assert request.url.params["access_token"] == "user_token"
            return httpx.Response(200, json={"success": True})
        return httpx.Response(200, json={"data": []})

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as http:
        adapter = InstagramAdapter(http_client=http)
        assert adapter.post_actions(account, variant).can_reply
        await adapter.list_post_replies(account, variant)
        await adapter.revoke(account)
    assert paths == [("GET", "/v23.0/media_id/comments"), ("DELETE", "/v23.0/me/permissions")]


@pytest.mark.anyio
@pytest.mark.parametrize("status_code", [429, 503])
async def test_transient_refresh_preserves_active_connection(client, auth, status_code):
    workspace_id = client.get("/api/v1/workspaces", headers=auth).json()[0]["id"]
    with SessionLocal() as db:
        account = ConnectedAccount(
            workspace_id=workspace_id,
            platform="instagram",
            external_account_id="ig_professional",
            display_name="Creator",
            account_type="creator",
            granted_scopes=INSTAGRAM_SCOPES,
            encrypted_access_token=encrypt_token("old_token"),
            account_metadata={"oauth_flow": "instagram_login"},
            status="active",
        )
        db.add(account)
        db.commit()
        async with httpx.AsyncClient(
            transport=httpx.MockTransport(lambda request: httpx.Response(status_code))
        ) as http:
            with pytest.raises(HTTPException) as caught:
                await refresh_account_tokens(db, account, InstagramAdapter(http_client=http))
        assert caught.value.status_code == status_code
        assert account.status == "active"
        assert decrypt_token(account.encrypted_access_token) == "old_token"


@pytest.mark.anyio
@pytest.mark.parametrize("scopes", [42, {"scope": "instagram_business_basic"}, [{}]])
async def test_invalid_scope_option_is_rejected(scopes):
    adapter = InstagramAdapter(app_id="id", app_secret="secret")
    with pytest.raises(HTTPException) as caught:
        await adapter.build_auth_url("workspace", "state", scopes=scopes)
    assert caught.value.status_code == 422
