from datetime import datetime

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class ConnectedAccount(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "connected_accounts"
    __table_args__ = (
        UniqueConstraint(
            "workspace_id", "platform", "external_account_id",
            name="uq_connected_accounts_workspace_platform_external_id",
        ),
    )

    workspace_id: Mapped[str] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), index=True
    )
    platform: Mapped[str] = mapped_column(String(32), index=True)
    external_account_id: Mapped[str] = mapped_column(String(128), index=True)
    display_name: Mapped[str] = mapped_column(String(255))
    account_type: Mapped[str] = mapped_column(String(32), default="personal")
    encrypted_access_token: Mapped[str | None] = mapped_column(Text, nullable=True)
    encrypted_refresh_token: Mapped[str | None] = mapped_column(Text, nullable=True)
    token_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    granted_scopes: Mapped[list[str]] = mapped_column(JSON, default=list)
    status: Mapped[str] = mapped_column(String(32), default="active", index=True)
    account_metadata: Mapped[dict] = mapped_column(JSON, default=dict)
    last_synced_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class MastodonApp(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "mastodon_apps"

    instance_domain: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    client_id: Mapped[str] = mapped_column(String(255))
    encrypted_client_secret: Mapped[str] = mapped_column(Text)
    redirect_uri: Mapped[str] = mapped_column(String(500))
    scopes: Mapped[str] = mapped_column(String(255), default="read write push")


class SubredditProfile(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "subreddit_profiles"

    name: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    display_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    rules: Mapped[list[dict]] = mapped_column(JSON, default=list)
    allowed_post_types: Mapped[list[str]] = mapped_column(JSON, default=list)
    flair_required: Mapped[bool] = mapped_column(Boolean, default=False)
    available_flairs: Mapped[list[dict]] = mapped_column(JSON, default=list)
    title_requirements: Mapped[dict] = mapped_column(JSON, default=dict)
    fetched_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, index=True)


class OAuthState(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "oauth_states"

    workspace_id: Mapped[str] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), index=True
    )
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    platform: Mapped[str] = mapped_column(String(32), index=True)
    state_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    code_verifier: Mapped[str | None] = mapped_column(String(128), nullable=True)
    instance_domain: Mapped[str | None] = mapped_column(String(255), nullable=True)
    redirect_uri: Mapped[str | None] = mapped_column(String(500), nullable=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    consumed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
