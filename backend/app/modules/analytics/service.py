"""Analytics service for aggregating performance metrics across accounts, posts, and platforms."""

import logging
from datetime import UTC, datetime, timedelta

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.modules.analytics.models import MetricSnapshot
from app.modules.analytics.schemas import (
    AccountAnalyticsResponse,
    MetricSnapshotSummary,
    PlatformMetricsSummary,
    PostAnalyticsResponse,
    PostFeedItemAnalytics,
    VariantAnalyticsResponse,
    WorkspaceOverviewResponse,
)
from app.modules.channels.models import ConnectedAccount
from app.modules.channels.registry import channel_registry
from app.modules.content.models import Post, PostVariant

logger = logging.getLogger("analytics.service")

CORE_METRICS = [
    "impressions",
    "reach",
    "engagements",
    "likes",
    "comments",
    "shares",
    "clicks",
    "bookmarks",
]


def _metric_coverage(
    platform: str, extras: dict, *, has_snapshot: bool, snapshot: MetricSnapshot | None = None
) -> tuple[str, str | None, list[str]]:
    """Return explicit coverage metadata without treating missing data as zero."""
    if not has_snapshot:
        return "unavailable", "No metrics have been synced for this item yet.", []

    status = extras.get("metrics_status")
    notice = extras.get("metrics_notice")
    available = extras.get("available_metrics")

    # Older LinkedIn snapshots came from socialActions, which only exposes
    # reaction/comment counts. Preserve those counts, but never invent views.
    if platform == "linkedin" and not status:
        if extras.get("restricted"):
            return "unavailable", extras.get("notice") or "LinkedIn restricted these metrics.", []
        if snapshot and snapshot.snapshot_type == "variant":
            return (
                "partial",
                "Stored LinkedIn metrics predate the corrected API. Reactions and comments are available; sync again for post views and other metrics.",
                ["likes", "comments", "engagements"],
            )
        return (
            "unavailable",
            "Stored LinkedIn metrics predate the corrected API. Sync again to replace them.",
            [],
        )

    # Older X snapshots did not record field presence. Keep positive view/click
    # counts and public interaction counters, but don't infer that missing zeroes
    # are true values or that impressions equal unique reach.
    if platform == "x" and not status:
        if snapshot and snapshot.snapshot_type == "variant":
            available = ["likes", "comments", "shares"]
            if snapshot.impressions > 0:
                available.append("impressions")
            if snapshot.clicks > 0:
                available.append("clicks")
            if (snapshot.extras or {}).get("bookmark_count", 0) > 0:
                available.append("bookmarks")
            return (
                "partial",
                "Stored X metrics predate coverage tracking. Some historical values may be missing; X private and organic metrics are available only for recent posts.",
                available,
            )
        return (
            "partial",
            "Stored X metrics predate coverage tracking. Sync again for the latest detail.",
            ["followers_count"],
        )

    if status not in {"available", "partial", "unavailable"}:
        status = "available"
    if not isinstance(available, list):
        available = CORE_METRICS if status == "available" else []
    return status, notice, [str(metric) for metric in available]


def _latest_snapshots_by_variant(
    db: Session, variant_ids: list[str]
) -> dict[str, MetricSnapshot]:
    if not variant_ids:
        return {}
    latest: dict[str, MetricSnapshot] = {}
    snapshots = db.scalars(
        select(MetricSnapshot)
        .where(
            MetricSnapshot.snapshot_type == "variant",
            MetricSnapshot.variant_id.in_(variant_ids),
        )
        .order_by(MetricSnapshot.fetched_at.desc(), MetricSnapshot.id.desc())
    )
    for snapshot in snapshots:
        if snapshot.variant_id and snapshot.variant_id not in latest:
            latest[snapshot.variant_id] = snapshot
    return latest


def get_workspace_overview(
    db: Session,
    workspace_id: str,
    days: int = 30,
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    account_id: str | None = None,
) -> WorkspaceOverviewResponse:
    """Aggregate total performance metrics across all channels for the workspace."""
    if start_date:
        start_cutoff = start_date if start_date.tzinfo else start_date.replace(tzinfo=UTC)
    else:
        start_cutoff = datetime.now(UTC) - timedelta(days=days)

    if end_date:
        end_cutoff = end_date if end_date.tzinfo else end_date.replace(tzinfo=UTC)
    else:
        end_cutoff = datetime.now(UTC)

    # The selected date range means posts published during the range. Their
    # latest lifetime snapshots remain valid even when fetched outside it.
    post_time = func.coalesce(
        PostVariant.published_at, PostVariant.updated_at, PostVariant.created_at
    )
    variants_query = (
        select(PostVariant)
        .join(Post, PostVariant.post_id == Post.id)
        .where(
            Post.workspace_id == workspace_id,
            PostVariant.status == "published",
            post_time >= start_cutoff,
            post_time <= end_cutoff,
        )
    )
    if account_id:
        variants_query = variants_query.where(PostVariant.connected_account_id == account_id)
    variants = list(db.scalars(variants_query))
    latest_by_variant = _latest_snapshots_by_variant(db, [variant.id for variant in variants])

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
    metrics_available_for_all = set(CORE_METRICS) if variants else set()
    notices: list[str] = []
    any_metrics = False
    all_metrics_available = bool(variants)

    for var_id, platform in variant_platform_map.items():
        snap = latest_by_variant.get(var_id)
        if not snap:
            all_metrics_available = False
            metrics_available_for_all.clear()
            continue
        metric_status, notice, fields = _metric_coverage(
            platform, snap.extras or {}, has_snapshot=True, snapshot=snap
        )
        if notice and notice not in notices:
            notices.append(notice)
        if metric_status == "unavailable":
            all_metrics_available = False
            metrics_available_for_all.clear()
            continue
        any_metrics = True
        if metric_status != "available":
            all_metrics_available = False
        metrics_available_for_all.intersection_update(fields)
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

    if not variants or not any_metrics:
        metrics_status = "unavailable"
        if variants and not notices:
            notices.append("No platform metrics have been synced for posts in this date range.")
    elif all_metrics_available:
        metrics_status = "available"
    else:
        metrics_status = "partial"

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
        timeframe_days=(
            max(1, (end_cutoff - start_cutoff).days)
            if start_date or end_date
            else days
        ),
        start_date=start_cutoff,
        end_date=end_cutoff,
        metrics_status=metrics_status,
        metrics_notice=" ".join(notices) or None,
        available_metrics=sorted(metrics_available_for_all),
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
        metric_status, metric_notice, _ = _metric_coverage(
            acc.platform,
            latest.extras or {} if latest else {},
            has_snapshot=latest is not None,
            snapshot=latest,
        )
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
                metrics_status=metric_status,
                metrics_notice=metric_notice,
                extras=latest.extras if latest else {},
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
        extras=latest_snap.extras if latest_snap else {},
    )


def get_post_analytics(db: Session, workspace_id: str, post_id: str) -> PostAnalyticsResponse:
    """Aggregate metrics across all variants belonging to a post."""
    post = db.scalar(select(Post).where(Post.id == post_id, Post.workspace_id == workspace_id))
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


def get_posts_analytics_feed(
    db: Session,
    workspace_id: str,
    account_id: str | None = None,
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    limit: int = 50,
    offset: int = 0,
) -> list[PostFeedItemAnalytics]:
    """Retrieve published posts with their metrics and engagement rates."""
    post_time = func.coalesce(
        PostVariant.published_at, PostVariant.updated_at, PostVariant.created_at
    )
    query = (
        select(PostVariant, Post, ConnectedAccount)
        .join(Post, PostVariant.post_id == Post.id)
        .outerjoin(ConnectedAccount, PostVariant.connected_account_id == ConnectedAccount.id)
        .where(
            Post.workspace_id == workspace_id,
            PostVariant.status == "published",
        )
    )
    if account_id:
        query = query.where(PostVariant.connected_account_id == account_id)

    if start_date:
        start_tz = start_date if start_date.tzinfo else start_date.replace(tzinfo=UTC)
        query = query.where(post_time >= start_tz)
    if end_date:
        end_tz = end_date if end_date.tzinfo else end_date.replace(tzinfo=UTC)
        query = query.where(post_time <= end_tz)

    query = (
        query.order_by(post_time.desc(), PostVariant.id.desc())
        .offset(offset)
        .limit(limit)
    )
    rows = list(db.execute(query).all())
    latest_by_variant = _latest_snapshots_by_variant(
        db, [variant.id for variant, _post, _account in rows]
    )

    results: list[PostFeedItemAnalytics] = []
    for variant, post, account in rows:
        latest_snap = latest_by_variant.get(variant.id)

        payload = variant.payload or {}
        text = (
            payload.get("text")
            or payload.get("caption")
            or payload.get("body")
            or post.base_text
            or ""
        )
        media_urls = payload.get("media_urls") or []
        if isinstance(media_urls, str):
            media_urls = [media_urls]

        imp = latest_snap.impressions if latest_snap else 0
        reach = latest_snap.reach if latest_snap else 0
        likes = latest_snap.likes if latest_snap else 0
        comments = latest_snap.comments if latest_snap else 0
        shares = latest_snap.shares_reposts if latest_snap else 0
        clicks = latest_snap.clicks if latest_snap else 0
        eng = (
            latest_snap.engagements
            if latest_snap
            else (likes + comments + shares + clicks)
        )
        extras = latest_snap.extras if latest_snap else {}
        metrics_status, metrics_notice, available_metrics = _metric_coverage(
            variant.platform,
            extras or {},
            has_snapshot=latest_snap is not None,
            snapshot=latest_snap,
        )
        bookmarks = int(extras.get("bookmark_count") or extras.get("saved") or 0)
        eng_rate = round((eng / imp * 100), 1) if imp > 0 else 0.0

        results.append(
            PostFeedItemAnalytics(
                variant_id=variant.id,
                post_id=post.id,
                platform=variant.platform,
                connected_account_id=variant.connected_account_id,
                account_display_name=account.display_name if account else None,
                text=str(text),
                media_urls=[str(u) for u in media_urls if u],
                published_at=variant.published_at or variant.updated_at or variant.created_at,
                created_at=variant.created_at,
                status=variant.status,
                external_post_id=variant.external_post_id,
                impressions=imp,
                reach=reach,
                likes=likes,
                comments=comments,
                shares=shares,
                clicks=clicks,
                bookmarks=bookmarks,
                engagements=eng,
                engagement_rate=eng_rate,
                extras=extras,
                metrics_status=metrics_status,
                metrics_notice=metrics_notice,
                available_metrics=available_metrics,
                metrics_fetched_at=latest_snap.fetched_at if latest_snap else None,
            )
        )

    return results


async def trigger_workspace_metrics_sync(db: Session, workspace_id: str) -> dict[str, int]:
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
                func.coalesce(PostVariant.published_at, PostVariant.created_at) >= cutoff,
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
            p_metrics = await adapter.fetch_metrics(
                acc,
                var.external_post_id,
                context={
                    "payload": var.payload or {},
                    "published_at": var.published_at,
                    "variant_id": var.id,
                },
            )
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
