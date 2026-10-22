"""Analytics and metrics aggregation schemas for workspace, account, and post performance."""

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class PlatformMetricsSummary(BaseModel):
    platform: str
    impressions: int = 0
    views: int = 0
    reach: int = 0
    engagements: int = 0
    likes: int = 0
    comments: int = 0
    shares: int = 0
    clicks: int = 0
    profile_clicks: int = 0
    bookmarks: int = 0
    posts_count: int = 0


class WorkspaceOverviewResponse(BaseModel):
    total_impressions: int = 0
    total_views: int = 0
    total_reach: int = 0
    total_engagements: int = 0
    total_likes: int = 0
    total_comments: int = 0
    total_shares: int = 0
    total_clicks: int = 0
    total_profile_clicks: int = 0
    total_bookmarks: int = 0
    total_posts_published: int = 0
    by_platform: dict[str, PlatformMetricsSummary] = Field(default_factory=dict)
    timeframe_days: int = 30
    start_date: datetime | None = None
    end_date: datetime | None = None
    metrics_status: str = "unavailable"
    metrics_notice: str | None = None
    available_metrics: list[str] = Field(default_factory=list)


class MetricSnapshotSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    fetched_at: datetime
    followers_count: int = 0
    profile_views: int = 0
    impressions: int = 0
    views: int = 0
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
    views: int = 0
    reach: int = 0
    following_count: int = 0
    posts_count: int = 0
    engagements: int = 0
    available_metrics: list[str] = Field(default_factory=list)
    last_synced_at: datetime | None = None
    historical_snapshots: list[MetricSnapshotSummary] = Field(default_factory=list)
    metrics_status: str = "unavailable"
    metrics_notice: str | None = None
    extras: dict[str, Any] = Field(default_factory=dict)


class VariantAnalyticsResponse(BaseModel):
    variant_id: str
    post_id: str
    platform: str
    external_post_id: str | None = None
    published_at: datetime | None = None
    impressions: int = 0
    views: int = 0
    reach: int = 0
    engagements: int = 0
    likes: int = 0
    comments: int = 0
    shares: int = 0
    clicks: int = 0
    latest_snapshot_at: datetime | None = None
    extras: dict[str, Any] = Field(default_factory=dict)
    metrics_status: str = "unavailable"
    metrics_notice: str | None = None
    available_metrics: list[str] = Field(default_factory=list)


class PostAnalyticsResponse(BaseModel):
    post_id: str
    title: str
    status: str
    total_impressions: int = 0
    total_views: int = 0
    total_engagements: int = 0
    total_likes: int = 0
    total_comments: int = 0
    variants: list[VariantAnalyticsResponse] = Field(default_factory=list)


class PostFeedItemAnalytics(BaseModel):
    variant_id: str
    post_id: str | None = None
    platform: str
    connected_account_id: str | None = None
    account_display_name: str | None = None
    text: str
    media_urls: list[str] = Field(default_factory=list)
    published_at: datetime | None = None
    created_at: datetime
    status: str
    external_post_id: str | None = None
    external_url: str | None = None
    is_reply: bool = False
    impressions: int = 0
    views: int = 0
    reach: int = 0
    likes: int = 0
    comments: int = 0
    shares: int = 0
    clicks: int = 0
    profile_clicks: int = 0
    bookmarks: int = 0
    engagements: int = 0
    engagement_rate: float = 0.0
    extras: dict[str, Any] = Field(default_factory=dict)
    metrics_status: str = "unavailable"
    metrics_notice: str | None = None
    available_metrics: list[str] = Field(default_factory=list)
    metrics_fetched_at: datetime | None = None


class InclusiveImpressions(BaseModel):
    total: int | None = None
    post_impressions: int | None = None
    reply_impressions: int | None = None
    replies_count: int = 0
    complete: bool = False


class AnalyticsDashboardResponse(BaseModel):
    cache_hit: bool = False
    cache_expires_at: datetime | None = None
    refresh_available_at: datetime | None = None
    provider_reads: int = 0
    daily_provider_reads: int = 0
    daily_read_limit: int = 0
    account_id: str | None = None
    accounts: list[AccountAnalyticsResponse] = Field(default_factory=list)
    overview: WorkspaceOverviewResponse
    posts: list[PostFeedItemAnalytics] = Field(default_factory=list)
    fetched_at: datetime
    dataset_complete: bool = True
    dataset_notice: str | None = None
    inclusive_impressions: InclusiveImpressions | None = None
    replies_supported: bool = False
    replies_count: int = 0
    feed_total: int = 0


class LimitUsageDetail(BaseModel):
    used: int
    limit: int | None
    remaining: int | None


class AICreditDetails(BaseModel):
    monthly_limit: int | None
    monthly_used: int
    monthly_reserved: int
    monthly_remaining: int | None
    bonus_credits: int
    bonus_reserved: int
    bonus_used: int
    bonus_remaining: int


class PlanLimitsResponse(BaseModel):
    plan_code: str
    cycle_start: datetime
    cycle_end: datetime
    connected_accounts: LimitUsageDetail
    scheduled_posts: LimitUsageDetail
    ai_credits: LimitUsageDetail
    ai_credit_details: AICreditDetails | None = None
