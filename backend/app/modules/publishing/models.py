from datetime import datetime

from sqlalchemy import JSON, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class PublishAttempt(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "publish_attempts"

    variant_id: Mapped[str] = mapped_column(
        ForeignKey("post_variants.id", ondelete="CASCADE"), index=True
    )
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    result: Mapped[str] = mapped_column(String(32), index=True)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    status_code: Mapped[int | None] = mapped_column(Integer, nullable=True)
    response_payload: Mapped[dict | None] = mapped_column(JSON, nullable=True)


__all__ = ["PublishAttempt"]
