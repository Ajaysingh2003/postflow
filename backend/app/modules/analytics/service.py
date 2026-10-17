"""Official analytics with short-lived shared Redis datasets, never SQL snapshots."""

import asyncio
import logging
from datetime import UTC, datetime, timedelta

import httpx
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.modules.analytics.cache import cached_dashboard
from app.modules.analytics.schemas import (
    AccountAnalyticsResponse,
    AnalyticsDashboardResponse,
    InclusiveImpressions,
    PlatformMetricsSummary,
    PostAnalyticsResponse,
    PostFeedItemAnalytics,
    VariantAnalyticsResponse,
    WorkspaceOverviewResponse,
)
from app.modules.channels.base import AccountMetrics, AnalyticsPost, Metrics
from app.modules.channels.models import ConnectedAccount
from app.modules.channels.registry import channel_registry
from app.modules.content.models import Post, PostVariant

logger = logging.getLogger("analytics.service")
CORE_METRICS = [
    "impressions",
    "views",
    "reach",
    "engagements",
    "likes",
    "comments",
    "shares",
    "clicks",
    "bookmarks",
    "profile_clicks",
]


def _utc(value: datetime) -> datetime:
    return value.replace(tzinfo=UTC) if value.tzinfo is None else value.astimezone(UTC)


def _coverage(extras: dict) -> tuple[str, str | None, list[str]]:
    status = extras.get("metrics_status", "partial")
    fields = extras.get("available_metrics", [])
    if status == "unavailable" or not fields:
        return (
            "unavailable",
            extras.get("metrics_notice") or "Analytics is not available for this account.",
            [],
        )
    return status, extras.get("metrics_notice"), list(fields)


def _unavailable(notice: str) -> dict:
    return {"metrics_status": "unavailable", "metrics_notice": notice, "available_metrics": []}


def _failure_notice(exc: Exception) -> str:
    if (
        isinstance(exc, HTTPException)
        and isinstance(exc.detail, str)
        and exc.detail.startswith(
            ("Analytics read budget", "Daily analytics read budget", "Analytics cost protection")
        )
    ):
        return exc.detail
    code = getattr(exc, "status_code", None)
    if isinstance(exc, httpx.HTTPStatusError):
        code = exc.response.status_code
    if code == 402:
        return "The platform requires API credits or a paid API plan before analytics can be retrieved."
    if code == 429:
        return "The platform's analytics rate limit was reached. Please try again later."
    if code in {401, 403}:
        return "Analytics is not available with this account's current API access. Check permissions or reconnect."
    return "Live analytics could not be retrieved from the platform. Please try again."


def _accounts(db: Session, workspace_id: str, account_id: str | None) -> list[ConnectedAccount]:
    query = select(ConnectedAccount).where(ConnectedAccount.workspace_id == workspace_id)
    if account_id:
        query = query.where(ConnectedAccount.id == account_id)
    accounts = list(db.scalars(query.order_by(ConnectedAccount.created_at.desc())))
    if account_id and not accounts:
        raise HTTPException(404, "Connected account not found in current workspace")
    return accounts


async def _account_metrics(
    account: ConnectedAccount, semaphore: asyncio.Semaphore
) -> AccountAnalyticsResponse:
    adapter = channel_registry.get(account.platform)
    extras = _unavailable("Analytics is not available for this account.")
    metrics = AccountMetrics(extras=extras)
    fetched_at = None
    if account.status != "active":
        metrics.extras = _unavailable("Reconnect this account to view live analytics.")
    elif adapter:
        try:
            async with semaphore:
                metrics = await asyncio.wait_for(adapter.fetch_account_metrics(account), timeout=45)
            fetched_at = datetime.now(UTC)
        except Exception as exc:  # noqa: BLE001
            logger.warning(
                "Live account analytics failed for %s (%s)", account.id, type(exc).__name__
            )
            metrics.extras = _unavailable(_failure_notice(exc))
    status, notice, fields = _coverage(metrics.extras)
    return AccountAnalyticsResponse(
        account_id=account.id,
        platform=account.platform,
        display_name=account.display_name,
        account_type=account.account_type,
        followers_count=metrics.followers_count,
        following_count=metrics.following_count,
        posts_count=metrics.posts_count,
        profile_views=metrics.profile_views,
        impressions=metrics.impressions,
        views=metrics.views,
        reach=metrics.reach,
        engagements=metrics.engagements,
        last_synced_at=fetched_at,
        metrics_status=status,
        metrics_notice=notice,
        available_metrics=fields,
        extras=metrics.extras,
    )


async def get_account_analytics(db, workspace_id, account_id=None, live=True):
    accounts = _accounts(db, workspace_id, account_id)
    identity = ["accounts", workspace_id, [(a.id, a.status, str(a.updated_at)) for a in accounts]]

    async def build():
        semaphore = asyncio.Semaphore(6)
        result = await asyncio.gather(*[_account_metrics(a, semaphore) for a in accounts])
        return [a.model_dump(mode="json") for a in result]

    data, _, _, _ = await cached_dashboard(workspace_id, identity, False, build)
    return [AccountAnalyticsResponse.model_validate(a) for a in data]


async def _post_metrics(account, external_id, payload, published_at, semaphore) -> Metrics:
    adapter = channel_registry.get(account.platform) if account else None
    if not account or account.status != "active" or not adapter or not external_id:
        return Metrics(extras=_unavailable("Analytics is not available for this post or account."))
    try:
        async with semaphore:
            return await asyncio.wait_for(
                adapter.fetch_metrics(
                    account, external_id, context={"payload": payload, "published_at": published_at}
                ),
                timeout=45,
            )
    except Exception as exc:  # noqa: BLE001
        logger.warning("Live post analytics failed for %s (%s)", external_id, type(exc).__name__)
        return Metrics(extras=_unavailable(_failure_notice(exc)))


async def _feed_item(account, item: AnalyticsPost, local, semaphore) -> PostFeedItemAnalytics:
    metrics = item.metrics or await _post_metrics(
        account, item.external_post_id, item.payload, item.published_at, semaphore
    )
    status, notice, fields = _coverage(metrics.extras)
    exposure = next((getattr(metrics, key) for key in ("impressions", "views") if key in fields), 0)
    variant, post = local if local else (None, None)
    return PostFeedItemAnalytics(
        variant_id=variant.id if variant else f"external:{account.id}:{item.external_post_id}",
        post_id=post.id if post else None,
        platform=account.platform,
        connected_account_id=account.id,
        account_display_name=account.display_name,
        text=item.text,
        media_urls=item.media_urls,
        published_at=item.published_at,
        created_at=variant.created_at if variant else item.published_at,
        status="published",
        external_post_id=item.external_post_id,
        external_url=item.external_url,
        is_reply=item.is_reply,
        impressions=metrics.impressions,
        views=metrics.views,
        reach=metrics.reach,
        likes=metrics.likes,
        comments=metrics.comments,
        shares=metrics.shares_reposts,
        clicks=metrics.clicks,
        profile_clicks=int(metrics.extras.get("user_profile_clicks") or 0),
        engagements=metrics.engagements,
        bookmarks=int(metrics.extras.get("bookmark_count") or metrics.extras.get("saved") or 0),
        engagement_rate=(
            round(metrics.engagements / exposure * 100, 1)
            if exposure and "engagements" in fields
            else 0
        ),
        metrics_status=status,
        metrics_notice=notice,
        available_metrics=fields,
        extras=metrics.extras,
        metrics_fetched_at=datetime.now(UTC) if status != "unavailable" else None,
    )


def _local_posts(db, workspace_id, account_id, external_ids=None):
    """Optional studio links, scoped to identifiers already returned by the API."""
    query = (
        select(PostVariant, Post)
        .join(Post, PostVariant.post_id == Post.id)
        .where(
            Post.workspace_id == workspace_id,
            PostVariant.connected_account_id == account_id,
            PostVariant.status == "published",
            PostVariant.external_post_id.is_not(None),
        )
    )
    if external_ids is None:
        return list(db.execute(query))
    # Keep SQL parameters bounded for long account histories; no query for an empty feed.
    ids = list(external_ids)
    return [
        row
        for offset in range(0, len(ids), 500)
        for row in db.execute(
            query.where(PostVariant.external_post_id.in_(ids[offset : offset + 500]))
        )
    ]


async def _account_posts(db, workspace_id, account, start, end, semaphore):
    # The official account feed defines membership, regardless of publishing client.
    adapter = channel_registry.get(account.platform)
    read_posts = getattr(adapter, "fetch_analytics_posts", None)
    if account.status != "active":
        return [], [], False, False, "Reconnect this account to view live analytics."
    if read_posts:
        try:
            async with semaphore:
                dataset = await asyncio.wait_for(read_posts(account, start, end), timeout=45)
            items, reply_items, supported, complete, notice = (
                dataset.posts,
                dataset.replies,
                dataset.supports_replies,
                dataset.complete,
                dataset.notice,
            )
        except Exception as exc:  # noqa: BLE001
            logger.warning("Live account posts failed for %s (%s)", account.id, type(exc).__name__)
            return [], [], False, False, _failure_notice(exc)
    else:
        local_rows = _local_posts(db, workspace_id, account.id)
        items = [
            AnalyticsPost(
                external_post_id=variant.external_post_id,
                text=str(
                    (variant.payload or {}).get("text")
                    or (variant.payload or {}).get("caption")
                    or (variant.payload or {}).get("body")
                    or post.base_text
                    or ""
                ),
                published_at=variant.published_at or variant.updated_at or variant.created_at,
                media_urls=(variant.payload or {}).get("media_urls") or [],
                payload=variant.payload or {},
            )
            for variant, post in local_rows
        ]
        complete, notice = (
            False,
            "This integration can retrieve live metrics only for posts published through draftva.",
        )
        reply_items, supported = [], False
    max_posts = get_settings().analytics_max_posts_per_account
    if len(items) + len(reply_items) > max_posts:
        bounded = sorted(items + reply_items, key=lambda p: _utc(p.published_at), reverse=True)[
            :max_posts
        ]
        items = [p for p in bounded if not p.is_reply]
        reply_items = [p for p in bounded if p.is_reply]
        complete = False
        notice = "Analytics post limit reached. Narrow the date range for complete totals."
    unique = {
        item.external_post_id: item
        for item in items + reply_items
        if start <= _utc(item.published_at) <= end
    }
    if read_posts:
        local_rows = _local_posts(db, workspace_id, account.id, unique)
    local = {variant.external_post_id: (variant, post) for variant, post in local_rows}
    rows = await asyncio.gather(
        *[
            _feed_item(account, item, local.get(item.external_post_id), semaphore)
            for item in unique.values()
        ]
    )
    return (
        [r for r in rows if not r.is_reply],
        [r for r in rows if r.is_reply],
        supported,
        complete,
        notice,
    )


def inclusive_impressions(posts, replies, complete):
    def total(rows):
        return (
            sum(row.impressions for row in rows)
            if all(
                "impressions" in row.available_metrics and row.metrics_status != "unavailable"
                for row in rows
            )
            else None
        )

    post_total, reply_total = total(posts), total(replies)
    value = post_total + reply_total if post_total is not None and reply_total is not None else None
    # An empty, incomplete response is unavailable, never a reported zero.
    if not complete and not posts and not replies:
        value = post_total = reply_total = None
    return InclusiveImpressions(
        total=value,
        post_impressions=post_total,
        reply_impressions=reply_total,
        replies_count=len(replies),
        complete=complete and value is not None,
    )


def _overview(posts, start, end, complete, notice):
    summaries = {}
    fields = set(CORE_METRICS) if posts and complete else set()
    notices = [notice] if notice else []
    any_available = False
    for post in posts:
        summary = summaries.setdefault(
            post.platform, PlatformMetricsSummary(platform=post.platform)
        )
        summary.posts_count += 1
        fields.intersection_update(post.available_metrics)
        any_available |= post.metrics_status != "unavailable" and bool(post.available_metrics)
        if post.metrics_notice and post.metrics_notice not in notices:
            notices.append(post.metrics_notice)
        for metric in CORE_METRICS:
            if metric in post.available_metrics:
                setattr(summary, metric, getattr(summary, metric) + getattr(post, metric))
    status = (
        "available"
        if posts and complete and all(p.metrics_status == "available" for p in posts)
        else "partial"
    )
    if not any_available:
        status = "unavailable"
    return WorkspaceOverviewResponse(
        **{
            f"total_{metric}": sum(getattr(s, metric) for s in summaries.values())
            for metric in CORE_METRICS
        },
        total_posts_published=len(posts),
        by_platform=summaries,
        timeframe_days=max(1, (end - start).days),
        start_date=start,
        end_date=end,
        metrics_status=status,
        metrics_notice=" ".join(notices) or None,
        available_metrics=sorted(fields),
    )


async def _build_dashboard(
    db: Session,
    workspace_id: str,
    account_id: str | None = None,
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    days: int = 30,
    limit: int = 50,
    offset: int = 0,
    content_type: str = "posts",
) -> AnalyticsDashboardResponse:
    now = datetime.now(UTC)
    start = _utc(start_date) if start_date else now - timedelta(days=days)
    end = min(_utc(end_date), now) if end_date else now
    if start > end:
        raise HTTPException(422, "Start date must precede end date")
    accounts = _accounts(db, workspace_id, account_id)
    semaphore = asyncio.Semaphore(6)
    account_results, datasets = await asyncio.gather(
        asyncio.gather(*[_account_metrics(a, semaphore) for a in accounts]),
        asyncio.gather(
            *[_account_posts(db, workspace_id, a, start, end, semaphore) for a in accounts]
        ),
    )
    posts = sorted(
        [p for rows, _, _, _, _ in datasets for p in rows],
        key=lambda p: _utc(p.published_at),
        reverse=True,
    )
    replies = [p for _, rows, _, _, _ in datasets for p in rows]
    supported = bool(datasets) and all(supported for _, _, supported, _, _ in datasets)
    complete = all(complete for _, _, _, complete, _ in datasets)
    notice = " ".join(dict.fromkeys(notice for _, _, _, _, notice in datasets if notice)) or None
    feed = sorted(
        replies
        if content_type == "replies"
        else posts + replies
        if content_type == "all"
        else posts,
        key=lambda p: _utc(p.published_at),
        reverse=True,
    )
    return AnalyticsDashboardResponse(
        account_id=account_id,
        accounts=list(account_results),
        overview=_overview(posts, start, end, complete, notice),
        posts=feed[offset : offset + limit],
        inclusive_impressions=inclusive_impressions(posts, replies, complete)
        if supported
        else None,
        replies_supported=supported,
        replies_count=len(replies),
        feed_total=len(feed),
        fetched_at=datetime.now(UTC),
        dataset_complete=complete,
        dataset_notice=notice,
    )


async def get_dashboard(
    db,
    workspace_id,
    account_id=None,
    start_date=None,
    end_date=None,
    days=30,
    limit=50,
    offset=0,
    content_type="posts",
    refresh=False,
):
    # Resolve accounts before Redis: removed members/accounts can never read an old cache entry.
    accounts = _accounts(db, workspace_id, account_id)
    now = datetime.now(UTC)
    if start_date and end_date and _utc(start_date) > _utc(end_date):
        raise HTTPException(422, "Start date must precede end date")
    identity = [
        workspace_id,
        account_id,
        str(start_date) if start_date else f"last-{days}:{now.date()}",
        str(end_date) if end_date else str(now.date()),
        [(a.id, a.status, str(a.updated_at)) for a in accounts],
    ]

    async def build():
        result = await _build_dashboard(
            db,
            workspace_id,
            account_id,
            start_date,
            end_date,
            days,
            get_settings().analytics_max_posts_per_account * max(1, len(accounts)),
            0,
            "all",
        )
        return result.model_dump(mode="json")

    data, hit, reads, daily_used = await cached_dashboard(workspace_id, identity, refresh, build)
    result = AnalyticsDashboardResponse.model_validate(data)
    feed = [
        p
        for p in result.posts
        if content_type == "all" or p.is_reply == (content_type == "replies")
    ]
    result.posts = feed[offset : offset + limit]
    result.feed_total = len(feed)
    result.cache_hit = hit
    result.cache_expires_at = result.fetched_at + timedelta(
        seconds=get_settings().analytics_cache_ttl_seconds
    )
    result.refresh_available_at = result.fetched_at + timedelta(
        seconds=get_settings().analytics_refresh_cooldown_seconds
    )
    result.provider_reads = reads
    result.daily_provider_reads = daily_used
    result.daily_read_limit = get_settings().analytics_daily_read_limit
    return result


async def get_workspace_overview(
    db, workspace_id, days=30, start_date=None, end_date=None, account_id=None
):
    return (await get_dashboard(db, workspace_id, account_id, start_date, end_date, days)).overview


async def get_posts_analytics_feed(
    db, workspace_id, account_id=None, start_date=None, end_date=None, limit=50, offset=0, live=True
):
    return (
        await get_dashboard(
            db, workspace_id, account_id, start_date, end_date, limit=limit, offset=offset
        )
    ).posts


async def _get_variant_analytics_live(
    db, workspace_id, variant_id, live=True
) -> VariantAnalyticsResponse:
    variant = db.scalar(
        select(PostVariant)
        .join(Post, PostVariant.post_id == Post.id)
        .where(PostVariant.id == variant_id, Post.workspace_id == workspace_id)
    )
    if not variant:
        raise HTTPException(404, "Variant not found")
    account = db.scalar(
        select(ConnectedAccount).where(
            ConnectedAccount.id == variant.connected_account_id,
            ConnectedAccount.workspace_id == workspace_id,
        )
    )
    metrics = await _post_metrics(
        account,
        variant.external_post_id,
        variant.payload or {},
        variant.published_at,
        asyncio.Semaphore(6),
    )
    status, notice, fields = _coverage(metrics.extras)
    return VariantAnalyticsResponse(
        variant_id=variant.id,
        post_id=variant.post_id,
        platform=variant.platform,
        external_post_id=variant.external_post_id,
        published_at=variant.published_at,
        impressions=metrics.impressions,
        views=metrics.views,
        reach=metrics.reach,
        engagements=metrics.engagements,
        likes=metrics.likes,
        comments=metrics.comments,
        shares=metrics.shares_reposts,
        clicks=metrics.clicks,
        latest_snapshot_at=datetime.now(UTC) if status != "unavailable" else None,
        extras=metrics.extras,
        metrics_status=status,
        metrics_notice=notice,
        available_metrics=fields,
    )


async def get_variant_analytics(db, workspace_id, variant_id, live=True):
    variant = db.scalar(
        select(PostVariant)
        .join(Post)
        .where(PostVariant.id == variant_id, Post.workspace_id == workspace_id)
    )
    if variant is None:
        raise HTTPException(404, "Variant not found")
    account = (
        db.get(ConnectedAccount, variant.connected_account_id)
        if variant.connected_account_id
        else None
    )
    identity = [
        "variant",
        workspace_id,
        variant_id,
        str(variant.updated_at),
        [account.id, account.status, str(account.updated_at)] if account else None,
    ]

    async def build():
        return (await _get_variant_analytics_live(db, workspace_id, variant_id)).model_dump(
            mode="json"
        )

    data, _, _, _ = await cached_dashboard(workspace_id, identity, False, build)
    return VariantAnalyticsResponse.model_validate(data)


async def get_post_analytics(db, workspace_id, post_id, live=True) -> PostAnalyticsResponse:
    post = db.scalar(select(Post).where(Post.id == post_id, Post.workspace_id == workspace_id))
    if not post:
        raise HTTPException(404, "Post not found")
    variants = await asyncio.gather(
        *[get_variant_analytics(db, workspace_id, v.id) for v in post.variants]
    )
    return PostAnalyticsResponse(
        post_id=post.id,
        title=post.title,
        status=post.status,
        variants=variants,
        **{
            f"total_{metric}": sum(
                getattr(v, metric) for v in variants if metric in v.available_metrics
            )
            for metric in ["impressions", "views", "engagements", "likes", "comments"]
        },
    )


async def trigger_workspace_metrics_sync(db: Session, workspace_id: str) -> dict[str, int]:
    """Compatibility endpoint: read fresh data without recording any snapshots."""
    result = await get_dashboard(db, workspace_id, refresh=True)
    return {
        "accounts_synced": sum(a.metrics_status != "unavailable" for a in result.accounts),
        "variants_synced": sum(p.metrics_status != "unavailable" for p in result.posts),
    }
