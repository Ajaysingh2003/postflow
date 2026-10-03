import base64
import hashlib
import logging
import secrets
from datetime import UTC, datetime, timedelta

import httpx
from cryptography.fernet import Fernet, InvalidToken, MultiFernet
from fastapi import HTTPException, status
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import utcnow
from app.modules.channels.base import PlatformAdapter
from app.modules.channels.models import ConnectedAccount, OAuthState

logger = logging.getLogger(__name__)


def _get_fernet() -> MultiFernet:
    """Derive a 32-byte URL-safe base64 encryption key from app_secret."""
    settings = get_settings()
    legacy = base64.urlsafe_b64encode(hashlib.sha256(settings.app_secret.encode("utf-8")).digest())
    keys = [settings.token_encryption_key or legacy]
    keys.extend(k.strip() for k in settings.token_encryption_previous_keys.split(",") if k.strip())
    if settings.token_encryption_key:
        keys.append(legacy)
    return MultiFernet([Fernet(key) for key in keys])


def encrypt_token(raw_token: str | None) -> str | None:
    """Encrypt a sensitive token string at rest."""
    if not raw_token:
        return None
    fernet = _get_fernet()
    return fernet.encrypt(raw_token.encode("utf-8")).decode("utf-8")


def decrypt_token(encrypted_token: str | None) -> str | None:
    """Decrypt a stored token string."""
    if not encrypted_token:
        return None
    fernet = _get_fernet()
    try:
        return fernet.decrypt(encrypted_token.encode("utf-8")).decode("utf-8")
    except InvalidToken as exc:
        logger.error("Failed to decrypt token: invalid token or secret mismatch")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to decrypt authentication credentials",
        ) from exc


def generate_pkce_pair(length: int = 64) -> tuple[str, str]:
    """
    Generate RFC 7636 PKCE code_verifier and code_challenge (S256).
    Returns (code_verifier, code_challenge).
    """
    if length < 43 or length > 128:
        length = 64
    code_verifier = secrets.token_urlsafe(length)[:length]
    sha256_digest = hashlib.sha256(code_verifier.encode("ascii")).digest()
    code_challenge = base64.urlsafe_b64encode(sha256_digest).decode("ascii").rstrip("=")
    return code_verifier, code_challenge


def create_oauth_state(
    db: Session,
    workspace_id: str,
    user_id: str,
    platform: str,
    code_verifier: str | None = None,
    redirect_uri: str | None = None,
    instance_domain: str | None = None,
    ttl_minutes: int = 15,
) -> tuple[OAuthState, str]:
    """
    Create a CSRF-safe OAuth state record in the database.
    Returns (OAuthState record, raw_state token for the provider).
    """
    raw_state = secrets.token_urlsafe(32)
    state_hash = hashlib.sha256(raw_state.encode("utf-8")).hexdigest()
    expires_at = utcnow() + timedelta(minutes=ttl_minutes)

    oauth_state = OAuthState(
        workspace_id=workspace_id,
        user_id=user_id,
        platform=platform.lower(),
        state_hash=state_hash,
        code_verifier=code_verifier,
        redirect_uri=redirect_uri,
        instance_domain=instance_domain,
        expires_at=expires_at,
    )
    db.add(oauth_state)
    db.commit()
    db.refresh(oauth_state)
    return oauth_state, raw_state


def _ensure_utc(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=UTC)
    return dt


def verify_and_consume_oauth_state(
    db: Session,
    platform: str,
    raw_state: str,
) -> OAuthState:
    """
    Verify the raw OAuth state token and consume it immediately to prevent replay attacks.
    Raises HTTPException 400 if state is invalid or expired.
    """
    if not raw_state:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="OAuth state parameter is required",
        )

    state_hash = hashlib.sha256(raw_state.encode("utf-8")).hexdigest()
    stmt = select(OAuthState).where(
        OAuthState.platform == platform.lower(),
        OAuthState.state_hash == state_hash,
    )
    record = db.scalar(stmt)

    if record is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or unrecognized OAuth state",
        )

    if _ensure_utc(record.expires_at) < utcnow():
        db.delete(record)
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="OAuth state has expired. Please restart authorization.",
        )

    # Make a copy of needed attributes before deletion
    state_copy = OAuthState(
        id=record.id,
        workspace_id=record.workspace_id,
        user_id=record.user_id,
        platform=record.platform,
        state_hash=record.state_hash,
        code_verifier=record.code_verifier,
        instance_domain=record.instance_domain,
        redirect_uri=record.redirect_uri,
        expires_at=record.expires_at,
        encrypted_metadata=record.encrypted_metadata,
    )

    consumed = db.execute(
        delete(OAuthState).where(OAuthState.id == record.id).returning(OAuthState.id)
    ).scalar_one_or_none()
    if consumed is None:
        db.rollback()
        raise HTTPException(400, "OAuth state was already consumed")
    db.commit()
    return state_copy


def is_permanent_auth_error(exc: Exception) -> bool:
    """Determine if a token refresh error is an unrecoverable auth revocation vs a transient error."""
    # Transport, timeout or OS errors are transient network glitches
    if isinstance(exc, (httpx.TimeoutException, httpx.NetworkError, OSError)):
        return False

    err_str = str(exc).lower()
    transient_indicators = (
        "name or service not known",
        "nodename nor servname provided",
        "connection refused",
        "temporary failure",
        "timeout",
        "timed out",
        "502",
        "503",
        "504",
        "429",
        "rate limit",
    )
    if any(term in err_str for term in transient_indicators):
        return False

    auth_indicators = (
        "invalid_grant",
        "unauthorized_client",
        "invalid_token",
        "token has been revoked",
        "token revoked",
        "expired/revoked",
        "revoked",
        "401",
        "unauthorized",
        "forbidden",
        "user-suspended",
        "invalid refresh token",
        "rejected refresh token",
    )
    if any(term in err_str for term in auth_indicators):
        return True

    status_code = getattr(exc, "status_code", None)
    if status_code in (400, 401, 403):
        return True

    return True


async def refresh_account_tokens(
    db: Session,
    account: ConnectedAccount,
    adapter: PlatformAdapter,
) -> ConnectedAccount:
    """
    Refresh tokens for an account using its platform adapter.
    If refresh fails due to permanent auth error, updates account status to 'needs_reauth'.
    Transient network/server errors keep the account status unchanged.
    """
    try:
        updated_account = await adapter.refresh_tokens(account)
        updated_account.status = "active"
        db.add(updated_account)
        db.commit()
        db.refresh(updated_account)
        return updated_account
    except Exception as exc:
        if is_permanent_auth_error(exc):
            logger.error(
                "Permanent token refresh failure for account %s (%s): %s; marked needs_reauth",
                account.id,
                account.platform,
                str(exc),
            )
            account.status = "needs_reauth"
            db.add(account)
            db.commit()
            db.refresh(account)
        else:
            logger.warning(
                "Transient error during token refresh for account %s (%s): %s; keeping active for retry",
                account.id,
                account.platform,
                str(exc),
            )
        raise


async def refresh_expiring_accounts(
    db: Session,
    adapters: dict[str, PlatformAdapter],
    lookahead_minutes: int = 90,
) -> list[ConnectedAccount]:
    """
    Find accounts whose tokens will expire within lookahead_minutes (default 90 min)
    or active/needs_reauth accounts with a stored refresh token, and proactively refresh them.
    Accounts failing refresh due to permanent auth errors are marked 'needs_reauth'.
    """
    cutoff = utcnow() + timedelta(minutes=lookahead_minutes)
    stmt = select(ConnectedAccount).where(
        (
            (ConnectedAccount.status == "active")
            | (
                (ConnectedAccount.status == "needs_reauth")
                & ConnectedAccount.encrypted_refresh_token.is_not(None)
            )
        ),
        ConnectedAccount.token_expires_at.is_not(None),
        ConnectedAccount.token_expires_at <= cutoff,
    )
    accounts = list(db.scalars(stmt))
    refreshed: list[ConnectedAccount] = []

    for account in accounts:
        adapter = adapters.get(account.platform)
        if not adapter:
            logger.warning(
                "No adapter found to refresh account %s (%s)", account.id, account.platform
            )
            continue
        try:
            res = await refresh_account_tokens(db, account, adapter)
            refreshed.append(res)
        except Exception as exc:  # noqa: BLE001
            logger.warning(
                "Background token refresh failed for %s (%s): %s",
                account.id,
                account.platform,
                exc,
            )

    return refreshed


async def disconnect_account(
    db: Session,
    account: ConnectedAccount,
    adapter: PlatformAdapter | None = None,
) -> None:
    """
    Revoke external tokens if adapter is provided and delete the connected account.
    """
    if adapter:
        try:
            await adapter.revoke(account)
        except Exception as exc:
            logger.warning(
                "Revocation call failed for account %s (%s): %s",
                account.id,
                account.platform,
                str(exc),
            )
            account.status = "needs_reauth"
            db.commit()
            raise HTTPException(
                502, "Provider revocation failed; account requires reauthentication"
            ) from exc

    db.delete(account)
    db.commit()
