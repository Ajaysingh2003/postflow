from datetime import datetime

from sqlalchemy import JSON, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class MetricSnapshot(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """
    Stores metrics snapshots from official platform APIs.
    Supports both:
    1. Whole-account level analytics (snapshot_type='account', variant_id=None)
    2. Post/variant level analytics (snapshot_type='variant', variant_id set)
    """
    __tablename__ = "metrics_snapshots"

    workspace_id: Mapped[str] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), index=True
    )
    connected_account_id: Mapped[str] = mapped_column(
        ForeignKey("connected_accounts.id", ondelete="CASCADE"), index=True
    )
    variant_id: Mapped[str | None] = mapped_column(
        ForeignKey("post_variants.id", ondelete="SET NULL"), nullable=True, index=True
    )
    snapshot_type: Mapped[str] = mapped_column(String(20), default="variant", index=True)
    fetched_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)

    # Common metrics columns
    impressions: Mapped[int] = mapped_column(Integer, default=0)
    reach: Mapped[int] = mapped_column(Integer, default=0)
    engagements: Mapped[int] = mapped_column(Integer, default=0)
    likes: Mapped[int] = mapped_column(Integer, default=0)
    comments: Mapped[int] = mapped_column(Integer, default=0)
    shares_reposts: Mapped[int] = mapped_column(Integer, default=0)
    clicks: Mapped[int] = mapped_column(Integer, default=0)

    # Account-level metrics
    followers_count: Mapped[int] = mapped_column(Integer, default=0)
    profile_views: Mapped[int] = mapped_column(Integer, default=0)

    # Raw metrics directly from the original source API
    extras: Mapped[dict] = mapped_column(JSON, default=dict)


__all__ = ["MetricSnapshot"]
