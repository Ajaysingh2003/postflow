import logging
import re

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from google.auth.exceptions import GoogleAuthError
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token
from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.dependencies import bearer, get_current_user, get_current_workspace, membership_for
from app.core.security import as_utc, hash_password, normalize_email, token_hash, utcnow
from app.db.session import SessionLocal, get_db
from app.modules.identity import mail, service, verification, x_login
from app.modules.identity.models import (
    AuthIdentity,
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
    OnboardingResponse,
    RegisterRequest,
    ResetPasswordRequest,
    SessionResponse,
    UpdateProfileRequest,
    VerifyEmailRequest,
    XLoginCompleteRequest,
    XLoginStartRequest,
)

router = APIRouter(prefix="/auth", tags=["authentication"])


class BoundedGoogleRequest(google_requests.Request):
    def __call__(self, *args, **kwargs):
        kwargs["timeout"] = 10
        return super().__call__(*args, **kwargs)


def _response(user: User, workspace: Workspace, token: str, ttl: int) -> AuthResponse:
    return AuthResponse(
        access_token=token,
        expires_in=ttl,
        user_id=user.id,
        workspace_id=workspace.id,
        email=user.email,
        name=user.name,
        email_verified=user.email_verified,
        verification_required=get_settings().email_verification_required
        and not user.email_verified,
    )


@router.post("/register", response_model=AuthResponse, status_code=201)
def register(payload: RegisterRequest, db: Session = Depends(get_db)) -> AuthResponse:
    result = service.register(db, str(payload.email), payload.password, payload.name)
    response = _response(*result)
    if response.verification_required:
        try:
            response.verification_sent = verification.request_email_otp(db, result[0])
        except HTTPException as exc:
            if exc.status_code not in {429, 503}:
                raise
            response.verification_error = (
                "Account created, but the verification email could not be sent. Request a new code."
            )
        response.retry_after = get_settings().otp_resend_seconds
    return response


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
            payload.id_token, BoundedGoogleRequest(), settings.google_client_id
        )
    except ValueError as exc:
        raise HTTPException(status_code=401, detail="Invalid Google identity token") from exc
    except GoogleAuthError as exc:
        raise HTTPException(503, "Google sign-in is temporarily unavailable. Please retry") from exc
    if not isinstance(claims, dict) or not claims.get("email"):
        raise HTTPException(status_code=400, detail="Google account did not provide an email")
    try:
        return _response(*service.login_google(db, claims))
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(409, "Account changed during sign-in. Please try again") from exc


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
        onboarding_completed_at=user.onboarding_completed_at,
    )


@router.patch("/me", response_model=MeResponse)
def update_me(
    payload: UpdateProfileRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MeResponse:
    user.name = payload.name.strip()
    if not user.name:
        raise HTTPException(422, "Name cannot be blank")
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
        onboarding_completed_at=user.onboarding_completed_at,
    )


@router.get("/onboarding", response_model=OnboardingResponse)
def onboarding_status(
    user: User = Depends(get_current_user),
    workspace: Workspace = Depends(get_current_workspace),
    db: Session = Depends(get_db),
) -> OnboardingResponse:
    membership = membership_for(db, workspace.id, user.id)
    return OnboardingResponse(
        completed_at=user.onboarding_completed_at,
        workspace_id=workspace.id,
        workspace_name=workspace.name,
        can_connect=membership.role in {"owner", "admin"},
    )


@router.post("/onboarding/complete", response_model=MessageResponse)
def complete_onboarding(
    user: User = Depends(get_current_user),
    workspace: Workspace = Depends(get_current_workspace),
    db: Session = Depends(get_db),
) -> MessageResponse:
    # Completion and skipping share one idempotent action. Connections are optional.
    db.execute(
        update(User)
        .where(User.id == user.id, User.onboarding_completed_at.is_(None))
        .values(onboarding_completed_at=utcnow())
    )
    db.commit()
    return MessageResponse(message="You're ready to go")


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


@router.get("/config")
def auth_config():
    settings = get_settings()
    return {
        "google_client_id": settings.google_client_id or None,
        "x_login_enabled": bool(settings.x_login_client_id and settings.x_login_client_secret),
    }


@router.post("/x/start")
def x_login_start(payload: XLoginStartRequest, db: Session = Depends(get_db)):
    return x_login.start(db, payload.browser_token)


@router.post("/x/complete", response_model=AuthResponse)
def x_login_complete(payload: XLoginCompleteRequest, db: Session = Depends(get_db)):
    return _response(*x_login.finish(db, payload))


@router.get("/session", response_model=AuthResponse)
def session_status(
    credentials=Depends(bearer),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    session = db.scalar(
        select(SessionToken).where(
            SessionToken.token_hash == token_hash(credentials.credentials),
            SessionToken.revoked_at.is_(None),
            SessionToken.expires_at > utcnow(),
        )
    )
    if session is None:
        raise HTTPException(401, "Invalid session")
    workspace = db.scalar(select(Workspace).where(Workspace.owner_user_id == user.id))
    if workspace is None:
        raise HTTPException(404, "Workspace not found")
    return _response(
        user,
        workspace,
        credentials.credentials,
        max(1, int((as_utc(session.expires_at) - utcnow()).total_seconds())),
    )


@router.post("/email/request-verification", response_model=MessageResponse)
def request_verification(
    user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> MessageResponse:
    if user.email_verified:
        return MessageResponse(message="Email is already verified", already_verified=True)
    if not verification.request_email_otp(db, user):
        return MessageResponse(message="Email is already verified", already_verified=True)
    return MessageResponse(
        message="Verification code sent",
        delivery_status="sent",
        retry_after=get_settings().otp_resend_seconds,
        expires_in=get_settings().otp_ttl_seconds,
    )


@router.get("/email/status", response_model=MessageResponse)
def verification_status(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    recent = db.scalar(
        select(EmailVerificationToken)
        .where(EmailVerificationToken.user_id == user.id)
        .order_by(EmailVerificationToken.created_at.desc())
    )
    wait = (
        max(
            0,
            int(
                get_settings().otp_resend_seconds
                - (utcnow() - as_utc(recent.created_at)).total_seconds()
            )
            + 1,
        )
        if recent
        else 0
    )
    delivered = db.scalar(
        select(EmailVerificationToken)
        .where(
            EmailVerificationToken.user_id == user.id,
            EmailVerificationToken.sent_at.is_not(None),
            EmailVerificationToken.otp_hash.is_not(None),
            EmailVerificationToken.consumed_at.is_(None),
        )
        .order_by(EmailVerificationToken.created_at.desc())
    )
    expiry = (
        max(0, int((as_utc(delivered.expires_at) - utcnow()).total_seconds())) if delivered else 0
    )
    failed = bool(recent and not recent.sent_at and recent.consumed_at and not user.email_verified)
    return MessageResponse(
        message=(
            "The last code could not be sent. Use an earlier valid code or request a new one."
            if failed
            else "Email is verified"
            if user.email_verified
            else "Verification required"
        ),
        delivery_status="failed" if failed else None,
        already_verified=user.email_verified,
        retry_after=wait,
        expires_in=expiry,
    )


def _deliver_public_email(email: str, purpose: str):
    # Run after the generic response; unknown accounts have the same response timing.
    with SessionLocal() as db:
        user = db.scalar(select(User).where(User.email == email))
        if not user or not user.is_active:
            return
        try:
            if purpose == "verification" and not user.email_verified:
                verification.request_email_otp(db, user)
            elif purpose == "reset":
                verification.request_password_reset(db, user)
        except HTTPException as exc:
            if exc.status_code != 429:
                logging.getLogger(__name__).warning(
                    "Transactional email request failed (HTTP %s)", exc.status_code
                )


@router.post("/email/resend", response_model=MessageResponse)
def resend_verification(payload: ForgotPasswordRequest, tasks: BackgroundTasks):
    mail.ensure_email_configured()
    tasks.add_task(_deliver_public_email, normalize_email(str(payload.email)), "verification")
    return MessageResponse(
        message="Verification request received. Check your inbox and spam folder for next steps.",
        delivery_status="accepted",
        outcome="accepted",
        retry_after=get_settings().otp_resend_seconds,
        expires_in=get_settings().otp_ttl_seconds,
    )


@router.patch("/email", response_model=MessageResponse)
def correct_pending_email(
    payload: ForgotPasswordRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user = verification.lock_user(db, user.id)
    if not user or not user.is_active:
        raise HTTPException(401, "Please sign in again")
    if user.email_verified:
        raise HTTPException(403, "A verified email cannot be changed through this flow")
    verification.check_send_allowance(db, EmailVerificationToken, user.id)
    email = normalize_email(str(payload.email))
    existing = db.scalar(select(User).where(User.email == email, User.id != user.id))
    if existing:
        raise HTTPException(409, "An account with this email already exists")
    try:
        user.email = email
        identity = db.scalar(
            select(AuthIdentity).where(
                AuthIdentity.user_id == user.id, AuthIdentity.provider == "email"
            )
        )
        if identity:
            identity.provider_subject = email
            identity.provider_email = email
        for model in (EmailVerificationToken, PasswordResetToken):
            db.execute(
                update(model)
                .where(model.user_id == user.id, model.consumed_at.is_(None))
                .values(consumed_at=utcnow())
            )
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(409, "An account with this email already exists") from exc
    try:
        verification.request_email_otp(db, user)
    except HTTPException as exc:
        if exc.status_code != 503:
            raise
        return MessageResponse(
            message="Email updated, but the code could not be sent. Request a new code.",
            email=user.email,
            delivery_status="failed",
            retry_after=get_settings().otp_resend_seconds,
        )
    return MessageResponse(
        message="Email updated and a new code sent",
        email=user.email,
        delivery_status="sent",
        retry_after=get_settings().otp_resend_seconds,
        expires_in=get_settings().otp_ttl_seconds,
    )


@router.post("/email/verify", response_model=MessageResponse)
def verify_email(payload: VerifyEmailRequest, db: Session = Depends(get_db)) -> MessageResponse:
    if re.fullmatch(r"[0-9]{6}", payload.token):
        if not payload.email:
            raise HTTPException(422, "Email is required to verify a code")
        verification.verify_email_code(db, normalize_email(str(payload.email)), payload.token)
        return MessageResponse(message="Email verified", outcome="verified")
    # Previously issued links remain usable; never truncate them into six digits.
    if len(payload.token) < 20:
        raise HTTPException(400, "Verification link is invalid or expired")
    token = db.scalar(
        select(EmailVerificationToken).where(
            EmailVerificationToken.token_hash == token_hash(payload.token),
            EmailVerificationToken.consumed_at.is_(None),
            EmailVerificationToken.expires_at > utcnow(),
        )
    )
    if token is None:
        raise HTTPException(400, "Verification link is invalid or expired")
    user = verification.lock_user(db, token.user_id)
    consumed = db.execute(
        update(EmailVerificationToken)
        .execution_options(synchronize_session="fetch")
        .where(
            EmailVerificationToken.id == token.id,
            EmailVerificationToken.consumed_at.is_(None),
            EmailVerificationToken.expires_at > utcnow(),
        )
        .values(consumed_at=utcnow())
    )
    if not user or not user.is_active or consumed.rowcount != 1:
        db.rollback()
        raise HTTPException(400, "Verification link is invalid or expired")
    user.email_verified = True
    db.commit()
    return MessageResponse(message="Email verified", outcome="verified")


@router.post("/password/forgot", response_model=MessageResponse)
def forgot_password(payload: ForgotPasswordRequest, tasks: BackgroundTasks):
    mail.ensure_email_configured()
    tasks.add_task(_deliver_public_email, normalize_email(str(payload.email)), "reset")
    return MessageResponse(
        message="Recovery request received. Check your inbox and spam folder for next steps.",
        delivery_status="accepted",
        outcome="accepted",
        retry_after=get_settings().otp_resend_seconds,
    )


@router.post("/password/reset", response_model=MessageResponse)
def reset_password(payload: ResetPasswordRequest, db: Session = Depends(get_db)):
    reset = db.scalar(
        select(PasswordResetToken).where(
            PasswordResetToken.token_hash == token_hash(payload.token),
            PasswordResetToken.consumed_at.is_(None),
            PasswordResetToken.expires_at > utcnow(),
        )
    )
    if reset is None:
        raise HTTPException(400, "Reset link is invalid or expired")
    user = verification.lock_user(db, reset.user_id)
    consumed = db.execute(
        update(PasswordResetToken)
        .execution_options(synchronize_session="fetch")
        .where(
            PasswordResetToken.id == reset.id,
            PasswordResetToken.consumed_at.is_(None),
            PasswordResetToken.expires_at > utcnow(),
        )
        .values(consumed_at=utcnow())
    )
    if not user or not user.is_active or consumed.rowcount != 1:
        db.rollback()
        raise HTTPException(400, "Reset link is invalid or expired")
    credential = db.scalar(
        select(PasswordCredential).where(PasswordCredential.user_id == reset.user_id)
    )
    if credential is None:
        credential = PasswordCredential(
            user_id=user.id, password_hash=hash_password(payload.password)
        )
        db.add(credential)
    else:
        credential.password_hash = hash_password(payload.password)
    # Recovery also proves control of the email, including Google-only accounts.
    user.email_verified = True
    db.execute(
        update(PasswordResetToken)
        .execution_options(synchronize_session="fetch")
        .where(
            PasswordResetToken.user_id == user.id,
            PasswordResetToken.consumed_at.is_(None),
        )
        .values(consumed_at=utcnow())
    )
    db.execute(
        update(SessionToken)
        .where(
            SessionToken.user_id == user.id,
            SessionToken.revoked_at.is_(None),
        )
        .values(revoked_at=utcnow())
    )
    db.execute(
        update(EmailVerificationToken)
        .where(
            EmailVerificationToken.user_id == user.id,
            EmailVerificationToken.consumed_at.is_(None),
        )
        .values(consumed_at=utcnow())
    )
    db.commit()
    return MessageResponse(
        message="Password reset; all sessions were signed out", outcome="password_updated"
    )


@router.get("/sessions", response_model=list[SessionResponse])
def list_sessions(
    credentials=Depends(bearer),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[SessionResponse]:
    current_hash = token_hash(credentials.credentials)
    sessions = db.scalars(
        select(SessionToken)
        .where(
            SessionToken.user_id == user.id,
            SessionToken.revoked_at.is_(None),
            SessionToken.expires_at > utcnow(),
        )
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
