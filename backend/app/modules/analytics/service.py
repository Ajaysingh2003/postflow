"""Analytics service for aggregating performance metrics across accounts, posts, and platforms."""

import logging
from datetime import UTC, datetime, timedelta

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.analytics.models import MetricSnapshot
from app.modules.analytics.schemas import (
    AccountAnalyticsResponse,
    MetricSnapshotSummary,
    PlatformMetricsSummary,
    PostAnalyticsResponse,
    VariantAnalyticsResponse,
    WorkspaceOverviewResponse,
)
from app.modules.channels.models import ConnectedAccount
from app.modules.channels.registry import channel_registry
from app.modules.content.models import Post, PostVariant

logger = logging.getLogger("analytics.service")


def get_workspace_overview(
    db: Session, workspace_id: str, days: int = 30
) -> WorkspaceOverviewResponse:
    """Aggregate total performance metrics across all channels for the workspace."""
    cutoff = datetime.now(UTC) - timedelta(days=days)

    # 1. Query variant-level metrics in timeframe
    snapshots = list(
        db.scalars(
            select(MetricSnapshot)
            .where(
                MetricSnapshot.workspace_id == workspace_id,
                MetricSnapshot.snapshot_type == "variant",
                MetricSnapshot.fetched_at >= cutoff,
            )
            .order_by(MetricSnapshot.fetched_at.desc())
        )
    )

    # De-duplicate to only latest snapshot per variant
    latest_by_variant: dict[str, MetricSnapshot] = {}
    for s in snapshots:
        if s.variant_id and s.variant_id not in latest_by_variant:
            latest_by_variant[s.variant_id] = s

    # 2. Query published posts in timeframe
    variants = list(
        db.scalars(
            select(PostVariant)
            .join(Post, PostVariant.post_id == Post.id)
            .where(
                Post.workspace_id == workspace_id,
                PostVariant.status == "published",
                PostVariant.created_at >= cutoff,
            )
        )
    )

    total_published = len(variants)
    posts_by_platform: dict[str, int] = {}
    for v in variants:
        posts_by_platform[v.platform] = posts_by_platform.get(v.platform, 0) + 1

    # Map variant ID to platform
    variant_platform_map = {v.id: v.platform for v in variants}

    total_imp = 0
    total_reach = 0
    total_eng = 0
    total_likes = 0
    total_comments = 0
    total_shares = 0
    total_clicks = 0

    by_platform: dict[str, PlatformMetricsSummary] = {}

    for var_id, snap in latest_by_variant.items():
        platform = variant_platform_map.get(var_id, "unknown")
        total_imp += snap.impressions
        total_reach += snap.reach
        total_eng += snap.engagements
        total_likes += snap.likes
        total_comments += snap.comments
        total_shares += snap.shares_reposts
        total_clicks += snap.clicks

        if platform not in by_platform:
            by_platform[platform] = PlatformMetricsSummary(
                platform=platform,
                posts_count=posts_by_platform.get(platform, 0),
            )

        p_summary = by_platform[platform]
        p_summary.impressions += snap.impressions
        p_summary.reach += snap.reach
        p_summary.engagements += snap.engagements
        p_summary.likes += snap.likes
        p_summary.comments += snap.comments
        p_summary.shares += snap.shares_reposts
        p_summary.clicks += snap.clicks

    # Ensure all platforms with published posts have an entry
    for plat, p_count in posts_by_platform.items():
        if plat not in by_platform:
            by_platform[plat] = PlatformMetricsSummary(platform=plat, posts_count=p_count)

    return WorkspaceOverviewResponse(
        total_impressions=total_imp,
        total_reach=total_reach,
        total_engagements=total_eng,
        total_likes=total_likes,
        total_comments=total_comments,
        total_shares=total_shares,
        total_clicks=total_clicks,
        total_posts_published=total_published,
        by_platform=by_platform,
        timeframe_days=days,
    )


def get_account_analytics(
    db: Session, workspace_id: str, account_id: str | None = None
) -> list[AccountAnalyticsResponse]:
    """Retrieve whole-account analytics and historical snapshots for workspace channels."""
    account_query = select(ConnectedAccount).where(ConnectedAccount.workspace_id == workspace_id)
    if account_id:
        account_query = account_query.where(ConnectedAccount.id == account_id)

    accounts = list(db.scalars(account_query.order_by(ConnectedAccount.created_at.desc())))
    results: list[AccountAnalyticsResponse] = []

    for acc in accounts:
        # Fetch account-level snapshots
        snapshots = list(
            db.scalars(
                select(MetricSnapshot)
                .where(
                    MetricSnapshot.connected_account_id == acc.id,
                    MetricSnapshot.snapshot_type == "account",
                )
                .order_by(MetricSnapshot.fetched_at.desc())
                .limit(30)
            )
        )

        latest = snapshots[0] if snapshots else None
        results.append(
            AccountAnalyticsResponse(
                account_id=acc.id,
                platform=acc.platform,
                display_name=acc.display_name,
                account_type=acc.account_type,
                followers_count=latest.followers_count if latest else 0,
                profile_views=latest.profile_views if latest else 0,
                impressions=latest.impressions if latest else 0,
                reach=latest.reach if latest else 0,
                last_synced_at=acc.last_synced_at or (latest.fetched_at if latest else None),
                historical_snapshots=[
                    MetricSnapshotSummary(
                        fetched_at=s.fetched_at,
                        followers_count=s.followers_count,
                        profile_views=s.profile_views,
                        impressions=s.impressions,
                        reach=s.reach,
                        engagements=s.engagements,
                        likes=s.likes,
                        comments=s.comments,
                        shares_reposts=s.shares_reposts,
                        clicks=s.clicks,
                        extras=s.extras,
                    )
                    for s in snapshots
                ],
            )
        )

    return results


def get_variant_analytics(
    db: Session, workspace_id: str, variant_id: str
) -> VariantAnalyticsResponse:
    """Retrieve post-level analytics and latest snapshot for a single variant."""
    variant = db.scalar(
        select(PostVariant)
        .join(Post, PostVariant.post_id == Post.id)
        .where(PostVariant.id == variant_id, Post.workspace_id == workspace_id)
    )
    if not variant:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Variant not found")

    latest_snap = db.scalar(
        select(MetricSnapshot)
        .where(
            MetricSnapshot.variant_id == variant.id,
            MetricSnapshot.snapshot_type == "variant",
        )
        .order_by(MetricSnapshot.fetched_at.desc())
    )

    return VariantAnalyticsResponse(
        variant_id=variant.id,
        post_id=variant.post_id,
        platform=variant.platform,
        external_post_id=variant.external_post_id,
        published_at=variant.updated_at if variant.status == "published" else None,
        impressions=latest_snap.impressions if latest_snap else 0,
        reach=latest_snap.reach if latest_snap else 0,
        engagements=latest_snap.engagements if latest_snap else 0,
        likes=latest_snap.likes if latest_snap else 0,
        comments=latest_snap.comments if latest_snap else 0,
        shares=latest_snap.shares_reposts if latest_snap else 0,
        clicks=latest_snap.clicks if latest_snap else 0,
        latest_snapshot_at=latest_snap.fetched_at if latest_snap else None,
    )


def get_post_analytics(
    db: Session, workspace_id: str, post_id: str
) -> PostAnalyticsResponse:
    """Aggregate metrics across all variants belonging to a post."""
    post = db.scalar(
        select(Post).where(Post.id == post_id, Post.workspace_id == workspace_id)
    )
    if not post:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")

    variant_responses: list[VariantAnalyticsResponse] = []
    tot_imp = 0
    tot_eng = 0
    tot_likes = 0
    tot_comments = 0

    for var in post.variants:
        v_analytics = get_variant_analytics(db, workspace_id, var.id)
        variant_responses.append(v_analytics)
        tot_imp += v_analytics.impressions
        tot_eng += v_analytics.engagements
        tot_likes += v_analytics.likes
        tot_comments += v_analytics.comments

    return PostAnalyticsResponse(
        post_id=post.id,
        title=post.title,
        status=post.status,
        total_impressions=tot_imp,
        total_engagements=tot_eng,
        total_likes=tot_likes,
        total_comments=tot_comments,
        variants=variant_responses,
    )


async def trigger_workspace_metrics_sync(
    db: Session, workspace_id: str
) -> dict[str, int]:
    """Manually trigger immediate metrics synchronization for workspace accounts and variants."""
    now = datetime.now(UTC)
    accounts_synced = 0
    variants_synced = 0

    # 1. Sync accounts
    accounts = list(
        db.scalars(
            select(ConnectedAccount).where(
                ConnectedAccount.workspace_id == workspace_id,
                ConnectedAccount.status == "active",
            )
        )
    )

    for acc in accounts:
        adapter = channel_registry.get(acc.platform)
        if not adapter:
            continue
        try:
            acc_metrics = await adapter.fetch_account_metrics(acc)
            snapshot = MetricSnapshot(
                workspace_id=workspace_id,
                connected_account_id=acc.id,
                variant_id=None,
                snapshot_type="account",
                fetched_at=now,
                followers_count=acc_metrics.followers_count,
                profile_views=acc_metrics.profile_views,
                impressions=acc_metrics.impressions,
                reach=acc_metrics.reach,
                engagements=acc_metrics.engagements,
                extras=acc_metrics.extras,
            )
            db.add(snapshot)
            acc.last_synced_at = now
            accounts_synced += 1
        except Exception:  # noqa: BLE001
            logger.warning("Error syncing account metrics for %s", acc.id)

    # 2. Sync published variants (last 30 days)
    cutoff = now - timedelta(days=30)
    variants = list(
        db.scalars(
            select(PostVariant)
            .join(Post, PostVariant.post_id == Post.id)
            .where(
                Post.workspace_id == workspace_id,
                PostVariant.status == "published",
                PostVariant.external_post_id.is_not(None),
                PostVariant.created_at >= cutoff,
            )
        )
    )

    for var in variants:
        if not var.connected_account_id or not var.external_post_id:
            continue
        acc = db.scalar(
            select(ConnectedAccount).where(ConnectedAccount.id == var.connected_account_id)
        )
        if not acc or acc.status != "active":
            continue
        adapter = channel_registry.get(var.platform)
        if not adapter:
            continue
        try:
            p_metrics = await adapter.fetch_metrics(acc, var.external_post_id)
            v_snap = MetricSnapshot(
                workspace_id=workspace_id,
                connected_account_id=acc.id,
                variant_id=var.id,
                snapshot_type="variant",
                fetched_at=now,
                impressions=p_metrics.impressions,
                reach=p_metrics.reach,
                engagements=p_metrics.engagements,
                likes=p_metrics.likes,
                comments=p_metrics.comments,
                shares_reposts=p_metrics.shares_reposts,
                clicks=p_metrics.clicks,
                extras=p_metrics.extras,
            )
            db.add(v_snap)
            variants_synced += 1
        except Exception:  # noqa: BLE001
            logger.warning("Error syncing variant metrics for %s", var.id)

    db.commit()
    return {"accounts_synced": accounts_synced, "variants_synced": variants_synced}
