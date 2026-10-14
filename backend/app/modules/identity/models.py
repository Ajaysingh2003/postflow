from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from app.modules.workspaces.models import Workspace, WorkspaceInvitation, WorkspaceMembership


class User(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "users"

    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(160))
    email_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class PasswordCredential(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "password_credentials"

    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), unique=True)
    password_hash: Mapped[str] = mapped_column(Text)


class AuthIdentity(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "auth_identities"
    __table_args__ = (UniqueConstraint("provider", "provider_subject"),)

    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    provider: Mapped[str] = mapped_column(String(32))
    provider_subject: Mapped[str] = mapped_column(String(255))
    provider_email: Mapped[str | None] = mapped_column(String(320))


class SessionToken(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "session_tokens"

    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class EmailVerificationToken(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "email_verification_tokens"

    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    consumed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    otp_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
    attempt_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class PasswordResetToken(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "password_reset_tokens"

    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    consumed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class AuthOAuthState(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Anonymous sign-in challenges, separate from workspace channel authorization."""

    __tablename__ = "auth_oauth_states"

    provider: Mapped[str] = mapped_column(String(32))
    state_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    browser_hash: Mapped[str] = mapped_column(String(64))
    encrypted_verifier: Mapped[str] = mapped_column(Text)
    redirect_uri: Mapped[str] = mapped_column(String(500))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    consumed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


__all__ = [
    "AuthIdentity",
    "AuthOAuthState",
    "EmailVerificationToken",
    "PasswordCredential",
    "PasswordResetToken",
    "SessionToken",
    "User",
    "Workspace",
    "WorkspaceInvitation",
    "WorkspaceMembership",
]
