"""Analytics and metrics aggregation schemas for workspace, account, and post performance."""

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class PlatformMetricsSummary(BaseModel):
    platform: str
    impressions: int = 0
    reach: int = 0
    engagements: int = 0
    likes: int = 0
    comments: int = 0
    shares: int = 0
    clicks: int = 0
    posts_count: int = 0


class WorkspaceOverviewResponse(BaseModel):
    total_impressions: int = 0
    total_reach: int = 0
    total_engagements: int = 0
    total_likes: int = 0
    total_comments: int = 0
    total_shares: int = 0
    total_clicks: int = 0
    total_posts_published: int = 0
    by_platform: dict[str, PlatformMetricsSummary] = Field(default_factory=dict)
    timeframe_days: int = 30


class MetricSnapshotSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    fetched_at: datetime
    followers_count: int = 0
    profile_views: int = 0
    impressions: int = 0
    reach: int = 0
    engagements: int = 0
    likes: int = 0
    comments: int = 0
    shares_reposts: int = 0
    clicks: int = 0
    extras: dict[str, Any] = Field(default_factory=dict)


class AccountAnalyticsResponse(BaseModel):
    account_id: str
    platform: str
    display_name: str
    account_type: str
    followers_count: int = 0
    profile_views: int = 0
    impressions: int = 0
    reach: int = 0
    last_synced_at: datetime | None = None
    historical_snapshots: list[MetricSnapshotSummary] = Field(default_factory=list)


class VariantAnalyticsResponse(BaseModel):
    variant_id: str
    post_id: str
    platform: str
    external_post_id: str | None = None
    published_at: datetime | None = None
    impressions: int = 0
    reach: int = 0
    engagements: int = 0
    likes: int = 0
    comments: int = 0
    shares: int = 0
    clicks: int = 0
    latest_snapshot_at: datetime | None = None
    extras: dict[str, Any] = Field(default_factory=dict)


class PostAnalyticsResponse(BaseModel):
    post_id: str
    title: str
    status: str
    total_impressions: int = 0
    total_engagements: int = 0
    total_likes: int = 0
    total_comments: int = 0
    variants: list[VariantAnalyticsResponse] = Field(default_factory=list)


class LimitUsageDetail(BaseModel):
    used: int
    limit: int | None
    remaining: int | None


class PlanLimitsResponse(BaseModel):
    plan_code: str
    cycle_start: datetime
    connected_accounts: LimitUsageDetail
    scheduled_posts: LimitUsageDetail
    ai_credits: LimitUsageDetail
