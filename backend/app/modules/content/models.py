from datetime import datetime

from sqlalchemy import JSON, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class Post(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "posts"

    workspace_id: Mapped[str] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), index=True
    )
    author_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(240), default="Untitled")
    base_text: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(32), default="draft", index=True)

    # Relationship to platform variants
    variants: Mapped[list["PostVariant"]] = relationship(
        "PostVariant", back_populates="post", cascade="all, delete-orphan"
    )

    # Backward compatibility helpers
    @property
    def created_by_user_id(self) -> str:
        return self.author_id

    @created_by_user_id.setter
    def created_by_user_id(self, value: str) -> None:
        self.author_id = value

    @property
    def content(self) -> str:
        return self.base_text

    @content.setter
    def content(self, value: str) -> None:
        self.base_text = value


class PostVariant(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "post_variants"

    post_id: Mapped[str] = mapped_column(ForeignKey("posts.id", ondelete="CASCADE"), index=True)
    connected_account_id: Mapped[str | None] = mapped_column(
        ForeignKey("connected_accounts.id", ondelete="SET NULL"), nullable=True, index=True
    )
    platform: Mapped[str] = mapped_column(String(32), index=True)
    payload: Mapped[dict] = mapped_column(JSON, default=dict)
    scheduled_time: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, index=True)
    status: Mapped[str] = mapped_column(String(32), default="draft", index=True)
    external_post_id: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    last_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    attempt_count: Mapped[int] = mapped_column(Integer, default=0)
    idempotency_key: Mapped[str] = mapped_column(String(128), unique=True, index=True)

    post: Mapped["Post"] = relationship("Post", back_populates="variants")
    media_links: Mapped[list["PostVariantMedia"]] = relationship(
        "PostVariantMedia", back_populates="variant", cascade="all, delete-orphan", order_by="PostVariantMedia.order_index"
    )


class PostVariantMedia(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "post_variant_media"
    __table_args__ = (
        UniqueConstraint("variant_id", "media_asset_id", name="uq_post_variant_media_variant_asset"),
    )

    variant_id: Mapped[str] = mapped_column(
        ForeignKey("post_variants.id", ondelete="CASCADE"), index=True
    )
    media_asset_id: Mapped[str] = mapped_column(
        ForeignKey("media_assets.id", ondelete="CASCADE"), index=True
    )
    order_index: Mapped[int] = mapped_column(Integer, default=0)
    alt_text: Mapped[str | None] = mapped_column(String(1000), nullable=True)

    variant: Mapped["PostVariant"] = relationship("PostVariant", back_populates="media_links")


__all__ = ["Post", "PostVariant", "PostVariantMedia"]
