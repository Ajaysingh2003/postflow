from datetime import UTC, datetime

from sqlalchemy import JSON, DateTime, ForeignKey, Index, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class VoiceProfile(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "voice_profiles"

    workspace_id: Mapped[str] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), index=True
    )
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(120), default="Default Voice")
    tone_description: Mapped[str] = mapped_column(Text, default="")
    sample_posts: Mapped[list[str]] = mapped_column(JSON, default=list)
    settings: Mapped[dict] = mapped_column(JSON, default=dict)


class AssistantRun(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "assistant_runs"

    workspace_id: Mapped[str] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), index=True
    )
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    platform: Mapped[str] = mapped_column(String(32), index=True)
    feature_id: Mapped[str] = mapped_column(String(80), index=True)
    input_summary: Mapped[str] = mapped_column(Text, default="")
    tokens_used: Mapped[int] = mapped_column(Integer, default=0)
    cost_micros: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String(32), default="succeeded", index=True)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False, index=True
    )


class AssistantConversation(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "assistant_conversations"
    __table_args__ = (
        Index(
            "ix_assistant_conversations_owner_updated",
            "workspace_id",
            "user_id",
            "updated_at",
            "id",
        ),
    )
    workspace_id: Mapped[str] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), index=True
    )
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(160))
    platform: Mapped[str] = mapped_column(String(32))
    connected_account_id: Mapped[str | None] = mapped_column(
        ForeignKey("connected_accounts.id", ondelete="SET NULL"), nullable=True
    )
    context: Mapped[dict] = mapped_column(JSON, default=dict)
    turn_count: Mapped[int] = mapped_column(Integer, default=0)


class AssistantTurn(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "assistant_turns"
    __table_args__ = (
        UniqueConstraint(
            "conversation_id", "request_id", name="uq_assistant_turns_conversation_request"
        ),
        UniqueConstraint(
            "conversation_id", "sequence", name="uq_assistant_turns_conversation_sequence"
        ),
    )
    conversation_id: Mapped[str] = mapped_column(
        ForeignKey("assistant_conversations.id", ondelete="CASCADE"), index=True
    )
    request_id: Mapped[str] = mapped_column(String(36))
    sequence: Mapped[int] = mapped_column(Integer)
    prompt: Mapped[str] = mapped_column(Text)
    original_text: Mapped[str] = mapped_column(Text, default="")
    request_data: Mapped[dict] = mapped_column(JSON)
    response_data: Mapped[dict] = mapped_column(JSON, default=dict)
    status: Mapped[str] = mapped_column(String(20), default="running")
    error: Mapped[str | None] = mapped_column(Text, nullable=True)


__all__ = ["AssistantConversation", "AssistantRun", "AssistantTurn", "VoiceProfile"]
