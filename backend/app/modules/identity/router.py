from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.dependencies import bearer, get_current_user
from app.core.security import hash_password, new_token, normalize_email, token_hash, utcnow
from app.db.session import get_db
from app.modules.identity import service
from app.modules.identity.models import (
    EmailVerificationToken,
    PasswordCredential,
    PasswordResetToken,
    SessionToken,
    User,
    Workspace,
)
from app.modules.identity.schemas import (
    AuthResponse,
    ForgotPasswordRequest,
    GoogleLoginRequest,
    LoginRequest,
    MeResponse,
    MessageResponse,
    RegisterRequest,
    ResetPasswordRequest,
    SessionResponse,
    TokenRequest,
    UpdateProfileRequest,
)

router = APIRouter(prefix="/auth", tags=["authentication"])


def _response(user: User, workspace: Workspace, token: str, ttl: int) -> AuthResponse:
    return AuthResponse(
        access_token=token,
        expires_in=ttl,
        user_id=user.id,
        workspace_id=workspace.id,
    )


@router.post("/register", response_model=AuthResponse, status_code=201)
def register(payload: RegisterRequest, db: Session = Depends(get_db)) -> AuthResponse:
    return _response(*service.register(db, str(payload.email), payload.password, payload.name))


@router.post("/login", response_model=AuthResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> AuthResponse:
    return _response(*service.login(db, str(payload.email), payload.password))


@router.post("/google", response_model=AuthResponse)
def google_login(payload: GoogleLoginRequest, db: Session = Depends(get_db)) -> AuthResponse:
    settings = get_settings()
    if not settings.google_client_id:
        raise HTTPException(status_code=503, detail="Google login is not configured")
    try:
        claims = google_id_token.verify_oauth2_token(
            payload.id_token, google_requests.Request(), settings.google_client_id
        )
    except ValueError as exc:
        raise HTTPException(status_code=401, detail="Invalid Google identity token") from exc
    if not claims.get("email"):
        raise HTTPException(status_code=400, detail="Google account did not provide an email")
    return _response(*service.login_google(db, claims))


@router.get("/me", response_model=MeResponse)
def me(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> MeResponse:
    workspace = db.scalar(select(Workspace).where(Workspace.owner_user_id == user.id))
    if workspace is None:
        raise HTTPException(status_code=404, detail="Workspace not found")
    return MeResponse(
        id=user.id,
        email=user.email,
        name=user.name,
        email_verified=user.email_verified,
        workspace_id=workspace.id,
    )


@router.patch("/me", response_model=MeResponse)
def update_me(
    payload: UpdateProfileRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MeResponse:
    user.name = payload.name.strip()
    db.commit()
    db.refresh(user)
    workspace = db.scalar(select(Workspace).where(Workspace.owner_user_id == user.id))
    if workspace is None:
        raise HTTPException(status_code=404, detail="Workspace not found")
    return MeResponse(
        id=user.id,
        email=user.email,
        name=user.name,
        email_verified=user.email_verified,
        workspace_id=workspace.id,
    )



@router.post("/logout", status_code=204)
def logout(credentials=Depends(bearer), db: Session = Depends(get_db)) -> None:
    if credentials:
        session = db.scalar(
            select(SessionToken).where(
                SessionToken.token_hash == token_hash(credentials.credentials)
            )
        )
        if session:
            session.revoked_at = utcnow()
            db.commit()


def _issue_one_time_token(db: Session, model, user_id: str, minutes: int) -> str:
    raw = new_token(48)
    db.add(
        model(
            user_id=user_id,
            token_hash=token_hash(raw),
            expires_at=utcnow() + timedelta(minutes=minutes),
        )
    )
    db.commit()
    return raw


@router.post("/email/request-verification", response_model=MessageResponse)
def request_verification(
    user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> MessageResponse:
    if user.email_verified:
        return MessageResponse(message="Email is already verified")
    raw = _issue_one_time_token(db, EmailVerificationToken, user.id, 30)
    return MessageResponse(
        message="Verification instructions have been created",
        development_token=raw if get_settings().debug else None,
    )


@router.post("/email/verify", response_model=MessageResponse)
def verify_email(payload: TokenRequest, db: Session = Depends(get_db)) -> MessageResponse:
    token = db.scalar(
        select(EmailVerificationToken).where(
            EmailVerificationToken.token_hash == token_hash(payload.token),
            EmailVerificationToken.consumed_at.is_(None),
            EmailVerificationToken.expires_at > utcnow(),
        )
    )
    if token is None:
        raise HTTPException(status_code=400, detail="Verification token is invalid or expired")
    user = db.get(User, token.user_id)
    if user is None:
        raise HTTPException(status_code=400, detail="Verification token is invalid or expired")
    user.email_verified = True
    token.consumed_at = utcnow()
    db.commit()
    return MessageResponse(message="Email verified")


@router.post("/password/forgot", response_model=MessageResponse)
def forgot_password(
    payload: ForgotPasswordRequest, db: Session = Depends(get_db)
) -> MessageResponse:
    user = db.scalar(select(User).where(User.email == normalize_email(str(payload.email))))
    raw = _issue_one_time_token(db, PasswordResetToken, user.id, 20) if user else None
    return MessageResponse(
        message="If the account exists, password reset instructions have been created",
        development_token=raw if raw and get_settings().debug else None,
    )


@router.post("/password/reset", response_model=MessageResponse)
def reset_password(payload: ResetPasswordRequest, db: Session = Depends(get_db)) -> MessageResponse:
    reset = db.scalar(
        select(PasswordResetToken).where(
            PasswordResetToken.token_hash == token_hash(payload.token),
            PasswordResetToken.consumed_at.is_(None),
            PasswordResetToken.expires_at > utcnow(),
        )
    )
    if reset is None:
        raise HTTPException(status_code=400, detail="Reset token is invalid or expired")
    credential = db.scalar(
        select(PasswordCredential).where(PasswordCredential.user_id == reset.user_id)
    )
    if credential is None:
        raise HTTPException(status_code=400, detail="This account has no password login")
    credential.password_hash = hash_password(payload.password)
    reset.consumed_at = utcnow()
    sessions = db.scalars(
        select(SessionToken).where(
            SessionToken.user_id == reset.user_id, SessionToken.revoked_at.is_(None)
        )
    )
    for session in sessions:
        session.revoked_at = utcnow()
    db.commit()
    return MessageResponse(message="Password reset; all sessions were signed out")


@router.get("/sessions", response_model=list[SessionResponse])
def list_sessions(
    credentials=Depends(bearer),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[SessionResponse]:
    current_hash = token_hash(credentials.credentials)
    sessions = db.scalars(
        select(SessionToken)
        .where(SessionToken.user_id == user.id, SessionToken.revoked_at.is_(None))
        .order_by(SessionToken.created_at.desc())
    )
    return [
        SessionResponse(
            id=item.id,
            created_at=item.created_at,
            expires_at=item.expires_at,
            current=item.token_hash == current_hash,
        )
        for item in sessions
    ]


@router.delete("/sessions/{session_id}", status_code=204)
def revoke_session(
    session_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    session = db.scalar(
        select(SessionToken).where(SessionToken.id == session_id, SessionToken.user_id == user.id)
    )
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")
    session.revoked_at = utcnow()
    db.commit()


@router.post("/logout-all", status_code=204)
def logout_all(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> None:
    for session in db.scalars(
        select(SessionToken).where(
            SessionToken.user_id == user.id, SessionToken.revoked_at.is_(None)
        )
    ):
        session.revoked_at = utcnow()
    db.commit()
