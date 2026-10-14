import base64
import hashlib
from datetime import timedelta
from urllib.parse import parse_qs, urlsplit

import httpx
import pytest
from pydantic import ValidationError
from sqlalchemy import select

from app.core.config import Settings, get_settings
from app.core.security import utcnow
from app.db.session import SessionLocal
from app.modules.channels.models import ConnectedAccount, OAuthState
from app.modules.channels.oauth import decrypt_token
from app.modules.identity import x_login
from app.modules.identity.models import (
    AuthIdentity,
    AuthOAuthState,
    PasswordCredential,
    SessionToken,
    User,
)


@pytest.fixture
def configured(monkeypatch):
    settings = get_settings()
    monkeypatch.setattr(settings, "x_login_client_id", "login-client")
    monkeypatch.setattr(settings, "x_login_client_secret", "login-secret")
    monkeypatch.setattr(
        settings, "x_login_redirect_uri", "http://localhost:3000/api/auth/x/callback"
    )
    calls = []
    profile = {
        "id": "123456",
        "username": "new_user",
        "name": "New User",
        "confirmed_email": "new@example.com",
    }

    def handler(request):
        calls.append(request)
        if request.url == x_login.X_TOKEN_URL:
            return httpx.Response(
                200, json={"access_token": "ephemeral-token", "token_type": "bearer"}
            )
        return httpx.Response(200, json={"data": profile})

    actual_client = httpx.Client
    monkeypatch.setattr(
        x_login.httpx,
        "Client",
        lambda **opts: actual_client(transport=httpx.MockTransport(handler)),
    )
    return calls, profile


def start(client, browser="a" * 43):
    response = client.post("/api/v1/auth/x/start", json={"browser_token": browser})
    assert response.status_code == 200, response.text
    return {
        "browser_token": browser,
        "state": response.json()["state"],
        "code": "provider-code",
    }, response.json()


def test_x_signup_uses_official_minimal_scopes_pkce_and_keeps_tokens_server_only(
    client, configured
):
    payload, flow = start(client)
    params = parse_qs(urlsplit(flow["authorization_url"]).query)
    assert flow["authorization_url"].startswith("https://x.com/i/oauth2/authorize?")
    assert set(params["scope"][0].split()) == {"users.read", "users.email", "tweet.read"}
    assert params["code_challenge_method"] == ["S256"]
    with SessionLocal() as db:
        state = db.scalar(select(AuthOAuthState))
        verifier = decrypt_token(state.encrypted_verifier)
        assert verifier not in state.encrypted_verifier
        digest = (
            base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest())
            .decode()
            .rstrip("=")
        )
        assert params["code_challenge"] == [digest]
        assert (
            state.state_hash != payload["state"] and state.browser_hash != payload["browser_token"]
        )
        assert db.scalar(select(OAuthState)) is None
    response = client.post("/api/v1/auth/x/complete", json=payload)
    assert response.status_code == 200, response.text
    data = response.json()
    assert data["email_verified"] and not data["verification_required"]
    assert "ephemeral-token" not in str(data)
    auth = {"Authorization": "Bearer " + data["access_token"]}
    assert client.get("/api/v1/posts/home", headers=auth).status_code == 200
    token_request, user_request = configured[0]
    assert token_request.headers["authorization"].startswith("Basic ")
    assert parse_qs(token_request.content.decode())["code_verifier"] == [verifier]
    assert user_request.url.params["user.fields"] == "confirmed_email,name,username"
    with SessionLocal() as db:
        assert db.scalar(select(PasswordCredential)) is None
        assert db.scalar(select(ConnectedAccount)) is None
        assert db.scalar(select(AuthIdentity)).provider == "x"


def test_state_is_browser_bound_single_use_and_expires_before_any_provider_call(client, configured):
    payload, _ = start(client)
    wrong = client.post("/api/v1/auth/x/complete", json={**payload, "browser_token": "b" * 43})
    assert wrong.status_code == 400 and not configured[0]
    assert client.post("/api/v1/auth/x/complete", json=payload).status_code == 200
    assert client.post("/api/v1/auth/x/complete", json=payload).status_code == 400
    assert len(configured[0]) == 2
    expired, _ = start(client)
    with SessionLocal.begin() as db:
        for state in db.scalars(select(AuthOAuthState)):
            state.expires_at = utcnow() - timedelta(seconds=1)
    assert client.post("/api/v1/auth/x/complete", json=expired).status_code == 400
    assert len(configured[0]) == 2


def test_x_repeated_sign_in_preserves_user_workspace_and_does_not_require_email_again(
    client, configured
):
    first, _ = start(client)
    original = client.post("/api/v1/auth/x/complete", json=first).json()
    configured[1].pop("confirmed_email")
    second, _ = start(client)
    repeated = client.post("/api/v1/auth/x/complete", json=second)
    assert repeated.status_code == 200
    assert repeated.json()["user_id"] == original["user_id"]
    assert repeated.json()["workspace_id"] == original["workspace_id"]


def test_missing_confirmed_email_never_invents_email_or_creates_account(client, configured):
    configured[1].pop("confirmed_email")
    payload, _ = start(client)
    response = client.post("/api/v1/auth/x/complete", json=payload)
    assert response.status_code == 400 and "confirmed email" in response.json()["detail"]
    with SessionLocal() as db:
        assert db.scalar(select(User)) is None


def test_existing_verified_email_is_reused_and_unverified_precreated_credentials_are_revoked(
    client, configured
):
    registration = client.post(
        "/api/v1/auth/register",
        json={"email": "new@example.com", "password": "a long password", "name": "Existing"},
    ).json()
    payload, _ = start(client)
    response = client.post("/api/v1/auth/x/complete", json=payload)
    assert response.status_code == 200 and response.json()["user_id"] == registration["user_id"]
    old = {"Authorization": "Bearer " + registration["access_token"]}
    assert client.get("/api/v1/auth/me", headers=old).status_code == 401
    with SessionLocal.begin() as db:
        assert db.scalar(select(PasswordCredential)) is None
        db.get(User, registration["user_id"]).is_active = False
    second, _ = start(client)
    assert client.post("/api/v1/auth/x/complete", json=second).status_code == 403


def test_verified_password_account_keeps_its_password_and_existing_session(client, configured):
    registration = client.post(
        "/api/v1/auth/register",
        json={"email": "new@example.com", "password": "a long password", "name": "Existing"},
    ).json()
    with SessionLocal.begin() as db:
        db.get(User, registration["user_id"]).email_verified = True
    payload, _ = start(client)
    assert client.post("/api/v1/auth/x/complete", json=payload).status_code == 200
    with SessionLocal() as db:
        assert db.scalar(select(PasswordCredential)) is not None
        assert (
            len(list(db.scalars(select(SessionToken).where(SessionToken.revoked_at.is_(None)))))
            == 2
        )


@pytest.mark.parametrize(
    "status,body", [(400, {"error": "PRIVATE secret"}), (429, {}), (200, []), (200, {})]
)
def test_provider_failures_are_sanitized_and_cannot_replay_consumed_state(
    client, configured, monkeypatch, status, body
):
    monkeypatch.undo()
    actual_client = httpx.Client
    settings = get_settings()
    monkeypatch.setattr(settings, "x_login_client_id", "login-client")
    monkeypatch.setattr(settings, "x_login_client_secret", "login-secret")
    monkeypatch.setattr(
        x_login.httpx,
        "Client",
        lambda **opts: actual_client(
            transport=httpx.MockTransport(lambda r: httpx.Response(status, json=body))
        ),
    )
    payload, _ = start(client)
    response = client.post("/api/v1/auth/x/complete", json=payload)
    assert response.status_code in {400, 503}
    assert "PRIVATE" not in response.text and "login-secret" not in response.text
    assert client.post("/api/v1/auth/x/complete", json=payload).status_code == 400


def test_unconfigured_buttons_have_explicit_config_without_leaking_credentials(client, monkeypatch):
    monkeypatch.setattr(get_settings(), "x_login_client_id", None)
    config = client.get("/api/v1/auth/config").json()
    assert config["x_login_enabled"] is False
    assert "secret" not in str(config)
    response = client.post("/api/v1/auth/x/start", json={"browser_token": "a" * 43})
    assert response.status_code == 503


def test_login_callback_rejects_insecure_or_ambiguous_urls():
    for uri in (
        "http://draftva.com/api/auth/x/callback",
        "javascript:alert(1)",
        "https://user:password@draftva.com/callback",
        "https://draftva.com/callback?token=x",
    ):
        with pytest.raises(ValidationError):
            Settings(_env_file=None, x_login_redirect_uri=uri)
