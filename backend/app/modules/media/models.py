from sqlalchemy import ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class MediaAsset(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "media_assets"

    workspace_id: Mapped[str] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), index=True
    )
    uploaded_by_user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    object_key: Mapped[str] = mapped_column(String(1024), unique=True)
    original_filename: Mapped[str] = mapped_column(String(255))
    content_type: Mapped[str] = mapped_column(String(100))
    declared_size: Mapped[int] = mapped_column(Integer)
    actual_size: Mapped[int | None] = mapped_column(Integer, nullable=True)
    width: Mapped[int | None] = mapped_column(Integer, nullable=True)
    height: Mapped[int | None] = mapped_column(Integer, nullable=True)
    alt_text: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    etag: Mapped[str | None] = mapped_column(String(200), nullable=True)
    status: Mapped[str] = mapped_column(String(40), default="awaiting_upload", index=True)
    rejection_reason: Mapped[str | None] = mapped_column(Text, nullable=True)

    @property
    def storage_key(self) -> str:
        return self.object_key

    @property
    def type(self) -> str:
        return self.content_type

    @property
    def size(self) -> int:
        return self.actual_size or self.declared_size


__all__ = ["MediaAsset"]
