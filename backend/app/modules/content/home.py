"""Bounded workspace Home summary. No platform calls or token serialization."""

from datetime import UTC, datetime, timedelta

from sqlalchemy import and_, case, func, or_, select

from app.modules.billing.entitlements import get_plan_limits_summary
from app.modules.channels.models import ConnectedAccount
from app.modules.content.models import Post, PostVariant
from app.modules.content.schemas import HomeAccount, HomePost, HomeSummary


def _text(payload, base_text):
    thread = payload.get("thread")
    if isinstance(thread, list) and thread:
        first = thread[0]
        value = (
            first
            if isinstance(first, str)
            else first.get("text", "")
            if isinstance(first, dict)
            else ""
        )
    else:
        value = payload.get("text") or payload.get("caption") or payload.get("body") or base_text
    return str(value or "")[:600]


def home_summary(db, workspace, can_edit, now=None, can_manage_channels=False):
    now = now or datetime.now(UTC)
    draft = or_(
        PostVariant.status == "draft",
        and_(PostVariant.id.is_(None), Post.status == "draft"),
    )
    scheduled = PostVariant.status.in_(("scheduled", "publishing"))
    published = PostVariant.status == "published"
    failed = PostVariant.status.in_(("failed", "rejected"))
    counts = db.execute(
        select(
            func.sum(case((draft, 1), else_=0)),
            func.sum(case((scheduled, 1), else_=0)),
            func.sum(
                case(
                    (
                        and_(
                            published,
                            PostVariant.published_at >= now - timedelta(days=7),
                            PostVariant.published_at <= now,
                        ),
                        1,
                    ),
                    else_=0,
                )
            ),
            func.sum(case((published, 1), else_=0)),
            func.sum(case((failed, 1), else_=0)),
        )
        .select_from(Post)
        .outerjoin(PostVariant, PostVariant.post_id == Post.id)
        .where(Post.workspace_id == workspace.id)
    ).one()
    accounts = list(
        db.execute(
            select(
                ConnectedAccount.id,
                ConnectedAccount.platform,
                ConnectedAccount.display_name,
                ConnectedAccount.status,
            )
            .where(ConnectedAccount.workspace_id == workspace.id)
            .order_by(ConnectedAccount.created_at.asc(), ConnectedAccount.id.asc())
        ).mappings()
    )

    def items(condition, ordering, limit):
        # Explicit fields keep full payloads, encrypted tokens, and ORM relationships
        # out of the response. Each section has a fixed limit, regardless of history.
        rows = db.execute(
            select(Post.id, Post.title, Post.base_text, Post.updated_at, PostVariant)
            .outerjoin(PostVariant, PostVariant.post_id == Post.id)
            .where(Post.workspace_id == workspace.id, condition)
            .order_by(*ordering, Post.id.asc(), PostVariant.id.asc())
            .limit(limit)
        )
        return [
            HomePost(
                post_id=post_id,
                variant_id=variant.id if variant else None,
                connected_account_id=variant.connected_account_id if variant else None,
                platform=variant.platform if variant else None,
                title=title,
                text=_text(variant.payload or {} if variant else {}, base_text),
                status=variant.status if variant else "draft",
                updated_at=variant.updated_at if variant else updated_at,
                scheduled_time=variant.scheduled_time if variant else None,
                published_at=variant.published_at if variant else None,
                last_error=variant.last_error[:300] if variant and variant.last_error else None,
            )
            for post_id, title, base_text, updated_at, variant in rows
        ]

    recent = (func.coalesce(PostVariant.updated_at, Post.updated_at).desc(),)
    return HomeSummary(
        workspace_id=workspace.id,
        workspace_name=workspace.name,
        fetched_at=now,
        can_edit=can_edit,
        can_manage_channels=can_manage_channels,
        usage=get_plan_limits_summary(db, workspace.id, now),
        counts=dict(
            zip(
                ("drafts", "scheduled", "published_week", "published", "failed"),
                (int(n or 0) for n in counts),
                strict=True,
            )
        ),
        accounts=[HomeAccount.model_validate(a) for a in accounts],
        drafts=items(draft, recent, 3),
        upcoming=items(
            scheduled,
            (
                case((PostVariant.status == "publishing", 0), else_=1),
                PostVariant.scheduled_time.asc().nullsfirst(),
            ),
            5,
        ),
        published=items(
            published, (func.coalesce(PostVariant.published_at, PostVariant.updated_at).desc(),), 4
        ),
        failed=items(failed, recent, 3),
    )
