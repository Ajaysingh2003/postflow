from datetime import timedelta

import httpx
import pytest
from fastapi import HTTPException
from pydantic import ValidationError
from sqlalchemy import select
from starlette.requests import Request

from app.core.config import Settings, get_settings
from app.core.rate_limit import RateLimiter
from app.core.security import utcnow
from app.db.session import SessionLocal
from app.modules.identity.models import (
    EmailVerificationToken,
    PasswordCredential,
    PasswordResetToken,
    SessionToken,
    User,
)
from app.modules.identity.service import login_google
from app.modules.identity.verification import request_email_otp


@pytest.fixture
def delivery(monkeypatch):
    codes, links = [], []
    monkeypatch.setattr(get_settings(), "email_verification_required", True)
    monkeypatch.setattr(
        "app.modules.identity.mail.deliver_otp",
        lambda email, code, key: codes.append((email, code)),
    )
    monkeypatch.setattr(
        "app.modules.identity.mail.deliver_token",
        lambda email, token, purpose: links.append((email, token, purpose)),
    )
    return codes, links


def signup(client, email="new@example.com"):
    response = client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "a secure password", "name": "New user"},
    )
    assert response.status_code == 201, response.text
    return response.json(), {"Authorization": "Bearer " + response.json()["access_token"]}


def age_challenges(user_id):
    with SessionLocal.begin() as db:
        for row in db.scalars(
            select(EmailVerificationToken).where(EmailVerificationToken.user_id == user_id)
        ):
            row.created_at = utcnow() - timedelta(minutes=2)


def test_signup_requires_otp_and_verification_unlocks_workspace_without_leaking_code(
    client, delivery
):
    data, auth = signup(client)
    code = delivery[0][0][1]
    assert data["verification_required"] and data["verification_sent"]
    assert code not in str(data)
    status = client.get("/api/v1/auth/email/status", headers=auth)
    assert status.status_code == 200 and code not in status.text
    assert 1 <= status.json()["retry_after"] <= 60
    assert 1 <= status.json()["expires_in"] <= 600
    assert client.get("/api/v1/auth/me", headers=auth).status_code == 200
    assert client.get("/api/v1/posts/home", headers=auth).status_code == 403
    assert (
        client.post(
            "/api/v1/workspaces", headers=auth, json={"name": "Another workspace"}
        ).status_code
        == 403
    )
    assert (
        client.post(
            "/api/v1/auth/email/verify", json={"email": "new@example.com", "token": code}
        ).status_code
        == 200
    )
    assert client.get("/api/v1/posts/home", headers=auth).status_code == 200
    assert client.get("/api/v1/auth/email/status", headers=auth).json()["already_verified"]
    assert (
        client.post(
            "/api/v1/auth/email/verify", json={"email": "new@example.com", "token": code}
        ).status_code
        == 400
    )
    with SessionLocal() as db:
        stored = db.scalar(select(EmailVerificationToken))
        assert stored.otp_hash != code and len(stored.otp_hash) == 64
        assert stored.consumed_at and stored.sent_at


def test_otp_is_bound_to_email_and_five_wrong_guesses_invalidate_it(client, delivery):
    signup(client)
    code = delivery[0][0][1]
    assert (
        client.post(
            "/api/v1/auth/email/verify", json={"email": "other@example.com", "token": code}
        ).status_code
        == 400
    )
    assert client.post("/api/v1/auth/email/verify", json={"token": code}).status_code == 422
    wrong = "000000" if code != "000000" else "111111"
    for _ in range(5):
        assert (
            client.post(
                "/api/v1/auth/email/verify", json={"email": "new@example.com", "token": wrong}
            ).status_code
            == 400
        )
    assert (
        client.post(
            "/api/v1/auth/email/verify", json={"email": "new@example.com", "token": code}
        ).status_code
        == 400
    )
    with SessionLocal() as db:
        assert db.scalar(select(EmailVerificationToken)).attempt_count == 5
        assert not db.scalar(select(User)).email_verified


def test_resend_cooldown_replacement_and_expiry(client, delivery):
    data, auth = signup(client)
    first = delivery[0][0][1]
    denied = client.post("/api/v1/auth/email/request-verification", headers=auth)
    assert denied.status_code == 429
    assert 1 <= int(denied.headers["retry-after"]) <= 60
    age_challenges(data["user_id"])
    resent = client.post("/api/v1/auth/email/request-verification", headers=auth)
    assert resent.status_code == 200
    second = delivery[0][-1][1]
    assert (
        client.post(
            "/api/v1/auth/email/verify", json={"email": "new@example.com", "token": first}
        ).status_code
        == 400
    )
    with SessionLocal.begin() as db:
        row = db.scalar(
            select(EmailVerificationToken).where(EmailVerificationToken.consumed_at.is_(None))
        )
        row.expires_at = utcnow() - timedelta(seconds=1)
    assert (
        client.post(
            "/api/v1/auth/email/verify", json={"email": "new@example.com", "token": second}
        ).status_code
        == 400
    )


def test_failed_delivery_does_not_destroy_prior_otp_or_fake_registration_success(
    client, delivery, monkeypatch
):
    data, auth = signup(client)
    code = delivery[0][0][1]
    age_challenges(data["user_id"])

    def fail(*args):
        raise HTTPException(503, "Delivery is unavailable")

    monkeypatch.setattr("app.modules.identity.mail.deliver_otp", fail)
    assert client.post("/api/v1/auth/email/request-verification", headers=auth).status_code == 503
    assert (
        client.post(
            "/api/v1/auth/email/verify", json={"email": "new@example.com", "token": code}
        ).status_code
        == 200
    )
    failed, _ = signup(client, "delivery-failed@example.com")
    assert failed["verification_required"] and not failed["verification_sent"]


def test_public_resend_and_reset_hide_account_existence_and_do_not_expose_tokens(client, delivery):
    signup(client)
    for path in ("email/resend", "password/forgot"):
        known = client.post("/api/v1/auth/" + path, json={"email": "new@example.com"})
        unknown = client.post("/api/v1/auth/" + path, json={"email": "unknown@example.com"})
        assert known.status_code == unknown.status_code == 200
        assert known.json() == unknown.json()
        assert known.json()["development_token"] is None


def test_email_daily_and_hourly_caps_work_across_sessions(client, delivery):
    data, _ = signup(client)
    with SessionLocal.begin() as db:
        first = db.scalar(select(EmailVerificationToken))
        first.created_at = utcnow() - timedelta(minutes=2)
        for _ in range(4):
            from app.core.security import new_token, token_hash

            db.add(
                EmailVerificationToken(
                    user_id=data["user_id"],
                    token_hash=token_hash(new_token()),
                    expires_at=utcnow(),
                    consumed_at=utcnow(),
                    created_at=utcnow() - timedelta(minutes=2),
                )
            )
    with SessionLocal() as db:
        user = db.get(User, data["user_id"])
        with pytest.raises(HTTPException) as raised:
            request_email_otp(db, user)
        assert raised.value.status_code == 429
    assert len(delivery[0]) == 1
    with SessionLocal.begin() as db:
        for row in db.scalars(select(EmailVerificationToken)):
            row.created_at = utcnow() - timedelta(hours=2)
        from app.core.security import new_token, token_hash

        for _ in range(5):
            db.add(
                EmailVerificationToken(
                    user_id=data["user_id"],
                    token_hash=token_hash(new_token()),
                    expires_at=utcnow(),
                    created_at=utcnow() - timedelta(hours=2),
                )
            )
    with SessionLocal() as db:
        with pytest.raises(HTTPException) as raised:
            request_email_otp(db, db.get(User, data["user_id"]))
        assert raised.value.headers["Retry-After"] == "86400"


def test_password_reset_is_single_use_revokes_sessions_and_old_password(client, delivery):
    _, auth = signup(client)
    forgot = client.post("/api/v1/auth/password/forgot", json={"email": "new@example.com"})
    assert forgot.status_code == 200
    token = delivery[1][0][1]
    assert (
        client.post(
            "/api/v1/auth/password/reset", json={"token": token, "password": "short"}
        ).status_code
        == 422
    )
    reset = {"token": token, "password": "a completely new password"}
    assert client.post("/api/v1/auth/password/reset", json=reset).status_code == 200
    assert client.get("/api/v1/auth/me", headers=auth).status_code == 401
    assert client.post("/api/v1/auth/password/reset", json=reset).status_code == 400
    assert (
        client.post(
            "/api/v1/auth/login", json={"email": "new@example.com", "password": "a secure password"}
        ).status_code
        == 401
    )
    login = client.post(
        "/api/v1/auth/login", json={"email": "new@example.com", "password": reset["password"]}
    )
    assert login.status_code == 200 and not login.json()["verification_required"]


def test_reset_resend_invalidates_old_token_only_after_success_and_expiry(client, delivery):
    signup(client)
    client.post("/api/v1/auth/password/forgot", json={"email": "new@example.com"})
    first = delivery[1][0][1]
    with SessionLocal.begin() as db:
        row = db.scalar(select(PasswordResetToken))
        row.created_at = utcnow() - timedelta(minutes=2)
    client.post("/api/v1/auth/password/forgot", json={"email": "new@example.com"})
    second = delivery[1][-1][1]
    assert (
        client.post(
            "/api/v1/auth/password/reset",
            json={"token": first, "password": "a completely new password"},
        ).status_code
        == 400
    )
    with SessionLocal.begin() as db:
        for row in db.scalars(select(PasswordResetToken)):
            row.expires_at = utcnow() - timedelta(seconds=1)
    assert (
        client.post(
            "/api/v1/auth/password/reset",
            json={"token": second, "password": "a completely new password"},
        ).status_code
        == 400
    )


def test_session_check_reports_actual_remaining_lifetime_and_logout_revokes_it(client, delivery):
    _, auth = signup(client)
    with SessionLocal.begin() as db:
        db.scalar(select(SessionToken)).expires_at = utcnow() + timedelta(minutes=3)
    response = client.get("/api/v1/auth/session", headers=auth)
    assert 1 <= response.json()["expires_in"] <= 180
    assert response.headers["cache-control"] == "private, no-store"
    assert client.post("/api/v1/auth/logout", headers=auth).status_code == 204
    assert client.get("/api/v1/auth/session", headers=auth).status_code == 401


def test_google_rejects_unverified_and_disabled_accounts_and_recovers_precreated_identity(
    client, delivery
):
    _, auth = signup(client)
    claims = {"sub": "google-subject", "email": "new@example.com", "email_verified": False}
    with SessionLocal() as db:
        with pytest.raises(HTTPException):
            login_google(db, claims)
        user, _, _, _ = login_google(db, {**claims, "email_verified": True})
        assert user.email_verified
        assert db.scalar(select(PasswordCredential)) is None
        assert client.get("/api/v1/auth/me", headers=auth).status_code == 401
        user.is_active = False
        db.commit()
        with pytest.raises(HTTPException) as raised:
            login_google(db, {**claims, "email_verified": True})
        assert raised.value.status_code == 403


def test_resend_api_is_server_only_idempotent_and_provider_failures_are_sanitized(monkeypatch):
    from app.modules.identity.mail import deliver_otp

    settings = get_settings()
    monkeypatch.setattr(settings, "resend_api_key", "private-key")
    monkeypatch.setattr(settings, "resend_from_email", "Draftva <noreply@draftva.com>")
    calls = []

    def handler(request):
        calls.append(request)
        return httpx.Response(200, json={"id": "email-id"})

    actual_client = httpx.Client
    monkeypatch.setattr(
        "app.modules.identity.mail.httpx.Client",
        lambda **opts: actual_client(transport=httpx.MockTransport(handler)),
    )
    deliver_otp("new@example.com", "123456", "challenge")
    request = calls[0]
    assert request.url == "https://api.resend.com/emails"
    assert request.headers["authorization"] == "Bearer private-key"
    assert request.headers["idempotency-key"] == "verify-challenge"
    assert b"123456" in request.content

    def failure(request):
        return httpx.Response(403, json={"message": "SECRET provider details private-key"})

    monkeypatch.setattr(
        "app.modules.identity.mail.httpx.Client",
        lambda **opts: actual_client(transport=httpx.MockTransport(failure)),
    )
    with pytest.raises(HTTPException) as raised:
        deliver_otp("new@example.com", "123456", "challenge")
    assert "SECRET" not in str(raised.value.detail) and raised.value.status_code == 503


def test_production_cannot_disable_verification_or_rate_limits():
    for override in ({"email_verification_required": False}, {"rate_limit_enabled": False}):
        with pytest.raises(ValidationError):
            Settings(
                _env_file=None,
                app_env="production",
                app_secret="x" * 48,
                llm_mock_enabled=False,
                **{"email_verification_required": True, "rate_limit_enabled": True, **override},
            )


@pytest.mark.anyio
async def test_auth_rate_limits_ignore_spoofed_headers_enforce_email_across_ips_and_fail_closed():
    limiter = RateLimiter(Settings(_env_file=None, app_env="test", rate_limit_enabled=True))

    class Redis:
        def __init__(self):
            self.counts = {}

        async def eval(self, script, num, key, ttl):
            self.counts[key] = self.counts.get(key, 0) + 1
            return self.counts[key]

    limiter.redis = Redis()

    def request(index):
        async def receive():
            return {
                "type": "http.request",
                "body": b'{"email":"target@example.com"}',
                "more_body": False,
            }

        return Request(
            {
                "type": "http",
                "method": "POST",
                "path": "/api/v1/auth/login",
                "headers": [
                    (b"x-forwarded-for", b"spoofed"),
                    (b"authorization", str(index).encode()),
                ],
                "client": (f"10.0.0.{index}", 123),
            },
            receive,
        )

    for index in range(10):
        assert (await limiter.check(request(index)))[0]
    assert not (await limiter.check(request(11)))[0]
    assert limiter.identity(request(1)) == "10.0.0.1"

    class BrokenRedis:
        async def eval(self, *args):
            raise OSError("unavailable")

    limiter.redis = BrokenRedis()
    limiter.allow_fallback = False
    with pytest.raises(HTTPException) as raised:
        await limiter.check(request(12))
    assert raised.value.status_code == 503


@pytest.mark.anyio
async def test_signed_frontend_client_ip_is_bound_to_secret_and_timestamp():
    import hashlib
    import hmac
    import time

    limiter = RateLimiter(
        Settings(_env_file=None, app_env="test", auth_proxy_secret="proxy-secret")
    )
    ip = "203.0.113.2"

    def request(timestamp, secret):
        signature = hmac.new(
            secret.encode(), f"{timestamp}:{ip}".encode(), hashlib.sha256
        ).hexdigest()
        return Request(
            {
                "type": "http",
                "path": "/api/v1/auth/login",
                "method": "POST",
                "client": ("127.0.0.1", 1),
                "headers": [
                    (b"x-auth-client-ip", ip.encode()),
                    (b"x-auth-client-timestamp", str(timestamp).encode()),
                    (b"x-auth-client-signature", signature.encode()),
                ],
            }
        )

    now = int(time.time())
    assert limiter.identity(request(now, "proxy-secret")) == ip
    assert limiter.identity(request(now, "wrong-secret")) == "127.0.0.1"
    assert limiter.identity(request(now - 120, "proxy-secret")) == "127.0.0.1"


@pytest.mark.anyio
async def test_server_does_not_rewrite_client_ip_from_an_untrusted_proxy_header():
    from uvicorn.middleware.proxy_headers import ProxyHeadersMiddleware

    limiter = RateLimiter(Settings(_env_file=None, app_env="test"))
    observed = []

    async def application(scope, receive, send):
        observed.append(limiter.identity(Request(scope)))

    middleware = ProxyHeadersMiddleware(application, trusted_hosts="")
    await middleware(
        {
            "type": "http",
            "scheme": "http",
            "path": "/api/v1/auth/login",
            "client": ("203.0.113.10", 123),
            "headers": [(b"x-forwarded-for", b"198.51.100.1")],
        },
        None,
        None,
    )
    assert observed == ["203.0.113.10"]


def test_correcting_pending_email_invalidates_old_codes_and_requires_new_proof(client, delivery):
    data, auth = signup(client)
    first = delivery[0][0][1]
    age_challenges(data["user_id"])
    changed = client.patch(
        "/api/v1/auth/email", headers=auth, json={"email": "corrected@example.com"}
    )
    assert changed.status_code == 200
    second = delivery[0][-1][1]
    assert delivery[0][-1][0] == "corrected@example.com"
    assert client.get("/api/v1/auth/me", headers=auth).json()["email"] == "corrected@example.com"
    assert (
        client.post(
            "/api/v1/auth/email/verify", json={"email": "corrected@example.com", "token": first}
        ).status_code
        == 400
    )
    assert (
        client.post(
            "/api/v1/auth/email/verify", json={"email": "corrected@example.com", "token": second}
        ).status_code
        == 200
    )
    assert (
        client.patch(
            "/api/v1/auth/email", headers=auth, json={"email": "another@example.com"}
        ).status_code
        == 403
    )


def test_auth_rate_limit_middleware_preserves_request_body_and_retry_headers(client, monkeypatch):
    from app.main import rate_limiter

    monkeypatch.setattr(rate_limiter, "enabled", True)

    class Redis:
        def __init__(self):
            self.counts = {}

        async def eval(self, script, num, key, ttl):
            self.counts[key] = self.counts.get(key, 0) + 1
            return self.counts[key]

    monkeypatch.setattr(rate_limiter, "redis", Redis())
    for _ in range(10):
        response = client.post(
            "/api/v1/auth/login",
            json={"email": "missing@example.com", "password": "a secure password"},
        )
        assert response.status_code == 401
    denied = client.post(
        "/api/v1/auth/login", json={"email": "missing@example.com", "password": "a secure password"}
    )
    assert denied.status_code == 429
    assert int(denied.headers["retry-after"]) > 0


def test_email_changed_during_delivery_cannot_verify_new_address_with_old_destination_code(
    client, delivery, monkeypatch
):
    data, auth = signup(client)
    age_challenges(data["user_id"])
    sent = []

    def change_during_send(email, code, key):
        sent.append(code)
        with SessionLocal.begin() as db:
            db.get(User, data["user_id"]).email = "changed-during-delivery@example.com"

    monkeypatch.setattr("app.modules.identity.mail.deliver_otp", change_during_send)
    response = client.post("/api/v1/auth/email/request-verification", headers=auth)
    assert response.status_code == 409
    assert (
        client.post(
            "/api/v1/auth/email/verify",
            json={"email": "changed-during-delivery@example.com", "token": sent[0]},
        ).status_code
        == 400
    )
