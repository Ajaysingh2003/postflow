"""Official X OAuth 2.0 sign-in with browser-bound state and S256 PKCE."""

from datetime import timedelta
from urllib.parse import urlencode

import httpx
from fastapi import HTTPException
from pydantic import EmailStr, TypeAdapter, ValidationError
from sqlalchemy import delete, select, update
from sqlalchemy.exc import IntegrityError

from app.core.config import get_settings
from app.core.security import new_token, normalize_email, token_hash, utcnow
from app.modules.channels.oauth import decrypt_token, encrypt_token, generate_pkce_pair
from app.modules.identity import service
from app.modules.identity.models import (
    AuthIdentity,
    AuthOAuthState,
    EmailVerificationToken,
    PasswordCredential,
    PasswordResetToken,
    SessionToken,
    User,
    Workspace,
    WorkspaceMembership,
)

X_AUTH_URL = "https://x.com/i/oauth2/authorize"
X_TOKEN_URL = "https://api.x.com/2/oauth2/token"
X_USER_URL = "https://api.x.com/2/users/me"
X_LOGIN_SCOPES = ("tweet.read", "users.read", "users.email")


def require_config():
    settings = get_settings()
    if not settings.x_login_client_id or not settings.x_login_client_secret:
        raise HTTPException(503, "X sign-in is not configured. Please use email instead")
    return settings


def start(db, browser_token):
    settings = require_config()
    verifier, challenge = generate_pkce_pair()
    raw_state = new_token()
    db.execute(
        delete(AuthOAuthState).where(AuthOAuthState.expires_at < utcnow() - timedelta(days=1))
    )
    db.add(
        AuthOAuthState(
            provider="x",
            state_hash=token_hash(raw_state),
            browser_hash=token_hash(browser_token),
            encrypted_verifier=encrypt_token(verifier),
            redirect_uri=settings.x_login_callback_url,
            expires_at=utcnow() + timedelta(minutes=10),
        )
    )
    db.commit()
    return {
        "authorization_url": X_AUTH_URL
        + "?"
        + urlencode(
            {
                "response_type": "code",
                "client_id": settings.x_login_client_id,
                "redirect_uri": settings.x_login_callback_url,
                "scope": " ".join(X_LOGIN_SCOPES),
                "state": raw_state,
                "code_challenge": challenge,
                "code_challenge_method": "S256",
            }
        ),
        "state": raw_state,
        "expires_in": 600,
    }


def finish(db, payload):
    settings = require_config()
    record = db.scalar(
        update(AuthOAuthState)
        .where(
            AuthOAuthState.provider == "x",
            AuthOAuthState.state_hash == token_hash(payload.state),
            AuthOAuthState.browser_hash == token_hash(payload.browser_token),
            AuthOAuthState.expires_at > utcnow(),
            AuthOAuthState.consumed_at.is_(None),
        )
        .values(consumed_at=utcnow())
        .returning(AuthOAuthState)
    )
    db.commit()  # Claim once before external requests, including failed exchanges.
    if record is None:
        raise HTTPException(400, "X sign-in expired or is invalid. Please start again")
    if record.redirect_uri != settings.x_login_callback_url:
        raise HTTPException(400, "X sign-in configuration changed. Please start again")
    try:
        with httpx.Client(timeout=15, follow_redirects=False) as client:
            token_response = client.post(
                X_TOKEN_URL,
                auth=(settings.x_login_client_id, settings.x_login_client_secret),
                data={
                    "grant_type": "authorization_code",
                    "code": payload.code,
                    "client_id": settings.x_login_client_id,
                    "redirect_uri": record.redirect_uri,
                    "code_verifier": decrypt_token(record.encrypted_verifier),
                },
            )
            if token_response.status_code == 429 or token_response.status_code >= 500:
                raise HTTPException(503, "X sign-in is temporarily unavailable. Please retry")
            if not token_response.is_success:
                raise HTTPException(400, "X sign-in could not be completed. Please start again")
            access_token = token_response.json().get("access_token")
            if not isinstance(access_token, str) or not access_token:
                raise HTTPException(503, "X returned an invalid sign-in response")
            profile_response = client.get(
                X_USER_URL,
                headers={"Authorization": "Bearer " + access_token},
                params={"user.fields": "confirmed_email,name,username"},
            )
            if not profile_response.is_success:
                raise HTTPException(
                    503, "X profile could not be read. Please use email or retry later"
                )
            profile = profile_response.json().get("data")
            if not isinstance(profile, dict):
                raise HTTPException(503, "X returned an invalid profile")
    except (httpx.HTTPError, ValueError, AttributeError) as exc:
        raise HTTPException(503, "X sign-in is temporarily unavailable. Please retry") from exc
    # Login tokens are ephemeral. No posting permission or refresh token is requested/stored.
    return login_profile(db, profile)


def login_profile(db, profile):
    subject = profile.get("id")
    if (
        not isinstance(subject, str)
        or not subject.isascii()
        or not subject.isdigit()
        or len(subject) > 32
    ):
        raise HTTPException(400, "X returned an invalid account identity")
    identity = db.scalar(
        select(AuthIdentity).where(
            AuthIdentity.provider == "x",
            AuthIdentity.provider_subject == subject,
        )
    )
    if identity:
        user = db.scalar(select(User).where(User.id == identity.user_id).with_for_update())
    else:
        try:
            email = normalize_email(
                str(TypeAdapter(EmailStr).validate_python(profile.get("confirmed_email")))
            )
        except ValidationError as exc:
            raise HTTPException(
                400, "X did not provide a confirmed email. Please use email sign-in instead"
            ) from exc
        user = db.scalar(select(User).where(User.email == email).with_for_update())
        try:
            if user is None:
                name = (
                    str(profile.get("name") or profile.get("username") or "X user").strip()[:160]
                    or "X user"
                )
                user = User(email=email, name=name, email_verified=True)
                db.add(user)
                db.flush()
                workspace = Workspace(
                    owner_user_id=user.id, name=f"{name}'s workspace", slug=service._slug(name)
                )
                db.add(workspace)
                db.flush()
                db.add(
                    WorkspaceMembership(workspace_id=workspace.id, user_id=user.id, role="owner")
                )
            if not user.is_active:
                raise HTTPException(403, "Account is disabled")
            if not user.email_verified:
                db.execute(delete(PasswordCredential).where(PasswordCredential.user_id == user.id))
                db.execute(
                    update(SessionToken)
                    .where(SessionToken.user_id == user.id)
                    .values(revoked_at=utcnow())
                )
                for model in (EmailVerificationToken, PasswordResetToken):
                    db.execute(
                        update(model).where(model.user_id == user.id).values(consumed_at=utcnow())
                    )
            user.email_verified = True
            db.add(
                AuthIdentity(
                    user_id=user.id, provider="x", provider_subject=subject, provider_email=email
                )
            )
            db.commit()
        except IntegrityError as exc:
            db.rollback()
            raise HTTPException(409, "Account changed during sign-in. Please try again") from exc
    if not user or not user.is_active:
        raise HTTPException(403, "Account is unavailable")
    workspace = db.scalar(select(Workspace).where(Workspace.owner_user_id == user.id))
    if workspace is None:
        raise HTTPException(500, "Workspace is missing")
    token, ttl = service.create_session(db, user, workspace)
    return user, workspace, token, ttl
