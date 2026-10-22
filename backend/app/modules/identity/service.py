import re
from datetime import timedelta

from fastapi import HTTPException
from pydantic import EmailStr, TypeAdapter, ValidationError
from sqlalchemy import delete, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import (
    hash_password,
    new_token,
    normalize_email,
    token_hash,
    utcnow,
    verify_password,
)
from app.modules.identity.models import (
    AuthIdentity,
    PasswordCredential,
    SessionToken,
    User,
    Workspace,
    WorkspaceMembership,
)


def _slug(value: str) -> str:
    base = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-") or "workspace"
    return f"{base}-{new_token(4).lower()}"


def create_session(db: Session, user: User, workspace: Workspace) -> tuple[str, int]:
    settings = get_settings()
    raw_token = new_token()
    ttl_seconds = settings.session_ttl_days * 24 * 60 * 60
    db.add(
        SessionToken(
            user_id=user.id,
            token_hash=token_hash(raw_token),
            expires_at=utcnow() + timedelta(seconds=ttl_seconds),
        )
    )
    db.commit()
    return raw_token, ttl_seconds


def register(db: Session, email: str, password: str, name: str) -> tuple[User, Workspace, str, int]:
    email = normalize_email(email)
    name = name.strip()
    if len(name) < 2:
        raise HTTPException(422, "Enter at least two characters for your name")
    if db.scalar(select(User).where(User.email == email)):
        raise HTTPException(status_code=409, detail="An account with this email already exists")
    user = User(email=email, name=name.strip(), email_verified=False)
    db.add(user)
    try:
        db.flush()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(409, "An account with this email already exists") from exc
    db.add(PasswordCredential(user_id=user.id, password_hash=hash_password(password)))
    db.add(
        AuthIdentity(
            user_id=user.id, provider="email", provider_subject=email, provider_email=email
        )
    )
    workspace = Workspace(
        owner_user_id=user.id, name=f"{user.name}'s workspace", slug=_slug(user.name)
    )
    db.add(workspace)
    db.flush()
    db.add(WorkspaceMembership(workspace_id=workspace.id, user_id=user.id, role="owner"))
    db.commit()
    db.refresh(user)
    db.refresh(workspace)
    token, ttl = create_session(db, user, workspace)
    return user, workspace, token, ttl


def login(db: Session, email: str, password: str) -> tuple[User, Workspace, str, int]:
    user = db.scalar(select(User).where(User.email == normalize_email(email)))
    credential = (
        db.scalar(select(PasswordCredential).where(PasswordCredential.user_id == user.id))
        if user
        else None
    )
    valid = verify_password(
        credential.password_hash if credential else _dummy_password_hash, password
    )
    if user is None or credential is None or not valid:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is disabled")
    workspace = db.scalar(select(Workspace).where(Workspace.owner_user_id == user.id))
    if workspace is None:
        raise HTTPException(status_code=500, detail="Workspace is missing")
    token, ttl = create_session(db, user, workspace)
    return user, workspace, token, ttl


def login_google(db: Session, claims: dict[str, object]) -> tuple[User, Workspace, str, int]:
    if (
        not isinstance(claims, dict)
        or not isinstance(claims.get("sub"), str)
        or not 1 <= len(claims["sub"]) <= 255
        or not isinstance(claims.get("email"), str)
        or claims.get("email_verified") is not True
    ):
        raise HTTPException(401, "Google must provide a verified email address")
    subject = str(claims["sub"])
    try:
        email = normalize_email(str(TypeAdapter(EmailStr).validate_python(claims["email"])))
    except ValidationError as exc:
        raise HTTPException(401, "Google must provide a verified email address") from exc
    identity = db.scalar(
        select(AuthIdentity).where(
            AuthIdentity.provider == "google", AuthIdentity.provider_subject == subject
        )
    )
    if identity:
        user = db.get(User, identity.user_id)
    else:
        user = db.scalar(select(User).where(User.email == email))
        if user is None:
            user = User(
                email=email,
                name=(str(claims.get("name") or "").strip() or email.split("@", 1)[0])[:160],
                email_verified=bool(claims.get("email_verified")),
            )
            db.add(user)
            db.flush()
            workspace = Workspace(
                owner_user_id=user.id, name=f"{user.name}'s workspace", slug=_slug(user.name)
            )
            db.add(workspace)
            db.flush()
            db.add(WorkspaceMembership(workspace_id=workspace.id, user_id=user.id, role="owner"))
        if not user.is_active:
            raise HTTPException(403, "Account is disabled")
        if not user.email_verified:
            # A verified Google identity may recover a pre-created email account.
            # Remove its unverified password and sessions to prevent account pre-hijacking.
            db.execute(delete(PasswordCredential).where(PasswordCredential.user_id == user.id))
            db.execute(
                update(SessionToken)
                .where(SessionToken.user_id == user.id)
                .values(revoked_at=utcnow())
            )
        user.email_verified = True
        db.add(
            AuthIdentity(
                user_id=user.id,
                provider="google",
                provider_subject=subject,
                provider_email=email,
            )
        )
        db.commit()
    if user is None:
        raise HTTPException(status_code=401, detail="Unable to authenticate Google account")
    if not user.is_active:
        raise HTTPException(403, "Account is disabled")
    user.email_verified = True
    workspace = db.scalar(select(Workspace).where(Workspace.owner_user_id == user.id))
    if workspace is None:
        raise HTTPException(status_code=500, detail="Workspace is missing")
    token, ttl = create_session(db, user, workspace)
    return user, workspace, token, ttl


_dummy_password_hash = hash_password(new_token())
