from datetime import datetime

from sqlalchemy import JSON, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class AgentClient(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "agent_clients"

    name: Mapped[str] = mapped_column(String(160))
    redirect_uris: Mapped[list[str]] = mapped_column(JSON)


class AgentAuthorization(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "agent_authorizations"

    request_hash: Mapped[str] = mapped_column(String(64), unique=True)
    client_id: Mapped[str] = mapped_column(ForeignKey("agent_clients.id", ondelete="CASCADE"))
    redirect_uri: Mapped[str] = mapped_column(Text)
    state: Mapped[str | None] = mapped_column(Text)
    code_challenge: Mapped[str] = mapped_column(String(43))
    scopes: Mapped[list[str]] = mapped_column(JSON)
    resource: Mapped[str] = mapped_column(Text)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    code_hash: Mapped[str | None] = mapped_column(String(64), unique=True)
    consumed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    workspace_id: Mapped[str | None] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE")
    )


class AgentConnection(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "agent_connections"

    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    workspace_id: Mapped[str] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), index=True
    )
    client_id: Mapped[str | None] = mapped_column(
        ForeignKey("agent_clients.id", ondelete="CASCADE")
    )
    name: Mapped[str] = mapped_column(String(160))
    scopes: Mapped[list[str]] = mapped_column(JSON)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    refresh_hash: Mapped[str | None] = mapped_column(String(64), unique=True)
    resource: Mapped[str] = mapped_column(Text)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    grant_expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
