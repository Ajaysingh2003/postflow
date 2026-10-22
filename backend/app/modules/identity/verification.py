"""Durable, email-bound, single-use OTPs and bounded email delivery requests."""

import hashlib
import hmac
import secrets
from datetime import timedelta
from uuid import uuid4

from fastapi import HTTPException
from sqlalchemy import func, select, update

from app.core.config import get_settings
from app.core.security import as_utc, new_token, token_hash, utcnow
from app.modules.identity import mail
from app.modules.identity.models import EmailVerificationToken, PasswordResetToken, User


def lock_user(db, user_id):
    if db.get_bind().dialect.name == "sqlite":
        db.execute(update(User).where(User.id == user_id).values(is_active=User.is_active))
    return db.scalar(
        select(User)
        .where(User.id == user_id)
        .with_for_update()
        .execution_options(populate_existing=True)
    )


def otp_hash(user_id, challenge_id, code):
    return hmac.new(
        get_settings().app_secret.encode(),
        f"email-otp:{user_id}:{challenge_id}:{code}".encode(),
        hashlib.sha256,
    ).hexdigest()


def check_send_allowance(db, model, user_id):
    now = utcnow()
    recent = db.scalar(
        select(model).where(model.user_id == user_id).order_by(model.created_at.desc())
    )
    if recent:
        wait = get_settings().otp_resend_seconds - (now - as_utc(recent.created_at)).total_seconds()
        if wait > 0:
            raise HTTPException(
                429,
                "Please wait before requesting another email",
                headers={"Retry-After": str(int(wait) + 1)},
            )
    for window, limit in ((timedelta(hours=1), 5), (timedelta(days=1), 10)):
        count = (
            db.scalar(
                select(func.count())
                .select_from(model)
                .where(
                    model.user_id == user_id,
                    model.created_at > now - window,
                )
            )
            or 0
        )
        if count >= limit:
            raise HTTPException(
                429,
                "Email request limit reached. Please try again later",
                headers={"Retry-After": str(int(window.total_seconds()))},
            )


def request_email_otp(db, user):
    user = lock_user(db, user.id)
    if not user or not user.is_active:
        raise HTTPException(400, "Unable to verify this account")
    if user.email_verified:
        return False
    check_send_allowance(db, EmailVerificationToken, user.id)
    challenge = EmailVerificationToken(
        id=str(uuid4()),
        user_id=user.id,
        token_hash=token_hash(new_token(48)),
        expires_at=utcnow() + timedelta(seconds=get_settings().otp_ttl_seconds),
        created_at=utcnow(),
    )
    destination = user.email
    db.add(challenge)
    db.commit()  # Reserves the send before HTTP, including concurrent resend requests.
    code = f"{secrets.randbelow(1_000_000):06d}"
    try:
        mail.deliver_otp(destination, code, challenge.id)
    except HTTPException:
        challenge.consumed_at = utcnow()
        db.commit()
        raise
    user = lock_user(db, user.id)
    db.refresh(challenge)
    if (
        not user
        or not user.is_active
        or user.email_verified
        or user.email != destination
        or challenge.consumed_at
    ):
        challenge.consumed_at = utcnow()
        db.commit()
        raise HTTPException(409, "Account changed while sending. Request a new code")
    # Failed delivery leaves the earlier valid OTP usable. Successful resend replaces it.
    db.execute(
        update(EmailVerificationToken)
        .where(
            EmailVerificationToken.user_id == user.id,
            EmailVerificationToken.id != challenge.id,
            EmailVerificationToken.consumed_at.is_(None),
        )
        .values(consumed_at=utcnow())
    )
    challenge.otp_hash = otp_hash(user.id, challenge.id, code)
    challenge.sent_at = utcnow()
    db.commit()
    return True


def verify_email_code(db, email, code):
    user = db.scalar(select(User).where(User.email == email))
    if user is None or not user.is_active:
        raise HTTPException(400, "Code is invalid or expired. Request a new code")
    user = lock_user(db, user.id)
    if not user or not user.is_active:
        raise HTTPException(400, "Code is invalid or expired. Request a new code")
    challenge = db.scalar(
        select(EmailVerificationToken)
        .where(
            EmailVerificationToken.user_id == user.id,
            EmailVerificationToken.consumed_at.is_(None),
            EmailVerificationToken.otp_hash.is_not(None),
        )
        .order_by(EmailVerificationToken.created_at.desc())
    )
    if not challenge or as_utc(challenge.expires_at) <= utcnow():
        raise HTTPException(400, "Code is invalid or expired. Request a new code")
    maximum = get_settings().otp_max_attempts
    if challenge.attempt_count >= maximum:
        raise HTTPException(400, "Code is invalid or expired. Request a new code")
    valid = hmac.compare_digest(challenge.otp_hash, otp_hash(user.id, challenge.id, code))
    challenge.attempt_count += 1
    if not valid:
        if challenge.attempt_count >= maximum:
            challenge.consumed_at = utcnow()
        db.commit()
        raise HTTPException(400, "Code is invalid or expired. Request a new code")
    db.execute(
        update(EmailVerificationToken)
        .where(
            EmailVerificationToken.user_id == user.id,
            EmailVerificationToken.consumed_at.is_(None),
        )
        .values(consumed_at=utcnow())
    )
    user.email_verified = True
    db.commit()


def request_password_reset(db, user):
    user = lock_user(db, user.id)
    if not user or not user.is_active:
        raise HTTPException(400, "Unable to recover this account")
    check_send_allowance(db, PasswordResetToken, user.id)
    raw = new_token(48)
    reset = PasswordResetToken(
        user_id=user.id,
        token_hash=token_hash(raw),
        expires_at=utcnow() + timedelta(minutes=20),
        created_at=utcnow(),
    )
    destination = user.email
    db.add(reset)
    db.commit()
    try:
        mail.deliver_token(destination, raw, "reset-password")
    except HTTPException:
        reset.consumed_at = utcnow()
        db.commit()
        raise
    user = lock_user(db, user.id)
    db.refresh(reset)
    if not user or not user.is_active or user.email != destination or reset.consumed_at:
        reset.consumed_at = utcnow()
        db.commit()
        raise HTTPException(409, "Account changed while sending. Request a new reset link")
    db.execute(
        update(PasswordResetToken)
        .where(
            PasswordResetToken.user_id == user.id,
            PasswordResetToken.id != reset.id,
            PasswordResetToken.consumed_at.is_(None),
        )
        .values(consumed_at=utcnow())
    )
    db.commit()
