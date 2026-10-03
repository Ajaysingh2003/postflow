"""Billing entitlements and plan quotas enforcement.

Tracks and limits:
- Maximum connected accounts
- Monthly scheduled posts
- Monthly AI assistant runs / credits
- Workspace seats
"""

from datetime import UTC, datetime
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.core.security import as_utc
from app.modules.billing.models import EntitlementGrant, Plan, Subscription
from app.modules.billing.usage import lock_workspace

PLAN_DEFAULTS = {
    "free": {
        "ai_credits": 20,
        "scheduled_posts": 5,
        "seats": 1,
        "workspaces": 1,
        "connected_accounts": 2,
    },
    "starter": {
        "ai_credits": 250,
        "scheduled_posts": 50,
        "seats": 3,
        "workspaces": 3,
        "connected_accounts": 5,
    },
    "creator": {
        "ai_credits": 250,
        "scheduled_posts": 50,
        "seats": 1,
        "workspaces": 1,
        "connected_accounts": 5,
    },
    "pro": {
        "ai_credits": 1000,
        "scheduled_posts": 250,
        "seats": 5,
        "workspaces": 5,
        "connected_accounts": 15,
    },
    "business": {
        "ai_credits": 5000,
        "scheduled_posts": 1000,
        "seats": 15,
        "workspaces": 10,
        "connected_accounts": 50,
    },
    "agency": {
        "ai_credits": 5000,
        "scheduled_posts": 1000,
        "seats": 25,
        "workspaces": 25,
        "connected_accounts": 100,
    },
}


def current_subscription(db: Session, workspace_id: str) -> Subscription | None:
    return db.scalar(
        select(Subscription)
        .where(Subscription.workspace_id == workspace_id)
        .order_by(Subscription.updated_at.desc())
    )


def has_paid_access(subscription: Subscription | None, now: datetime | None = None) -> bool:
    if subscription is None:
        return False
    now = now or datetime.now(UTC)
    if subscription.status in {"active", "trialing", "renewed", "updated", "plan_changed"}:
        return True
    if (
        subscription.status == "on_hold"
        and subscription.grace_until
        and as_utc(subscription.grace_until) > now
    ):
        return True
    return bool(
        subscription.status == "cancelled"
        and subscription.current_period_end
        and as_utc(subscription.current_period_end) > now
    )


def effective_plan(db: Session, workspace_id: str) -> str:
    subscription = current_subscription(db, workspace_id)
    return (
        subscription.plan_code
        if has_paid_access(subscription)
        and (
            subscription.plan_code in PLAN_DEFAULTS
            or db.scalar(
                select(Plan).where(Plan.code == subscription.plan_code, Plan.active.is_(True))
            )
        )
        else "free"
    )


def sync_entitlements(
    db: Session, workspace_id: str, plan_code: str, quantity: int | None = None
) -> None:
    plan = db.scalar(select(Plan).where(Plan.code == plan_code, Plan.active.is_(True)))
    values = plan.limits if plan else PLAN_DEFAULTS.get(plan_code, PLAN_DEFAULTS["free"])
    db.execute(
        delete(EntitlementGrant).where(
            EntitlementGrant.workspace_id == workspace_id, EntitlementGrant.source == "plan"
        )
    )
    for capability, limit in values.items():
        if capability == "seats" and quantity is not None:
            limit = max(1, min(quantity, limit or quantity))
        db.add(
            EntitlementGrant(
                workspace_id=workspace_id, capability=capability, limit_value=limit, source="plan"
            )
        )


def entitlement_limit(db: Session, workspace_id: str, capability: str) -> int | None:
    grant = db.scalar(
        select(EntitlementGrant)
        .where(
            EntitlementGrant.workspace_id == workspace_id,
            EntitlementGrant.capability == capability,
            (
                EntitlementGrant.expires_at.is_(None)
                | (EntitlementGrant.expires_at > datetime.now(UTC))
            ),
        )
        .order_by((EntitlementGrant.source != "plan").desc(), EntitlementGrant.created_at.desc())
    )
    if grant:
        return grant.limit_value
    code = effective_plan(db, workspace_id)
    plan = db.scalar(select(Plan).where(Plan.code == code, Plan.active.is_(True)))
    return (plan.limits if plan else PLAN_DEFAULTS[code]).get(capability)


def usage_cycle_start(db: Session, workspace_id: str, now: datetime | None = None) -> datetime:
    subscription = current_subscription(db, workspace_id)
    if subscription and subscription.current_period_start:
        return subscription.current_period_start
    now = now or datetime.now(UTC)
    return now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)


def check_connected_accounts_limit(db: Session, workspace_id: str) -> None:
    """Enforce workspace connected accounts limit."""
    lock_workspace(db, workspace_id)
    from app.modules.channels.models import ConnectedAccount

    limit = entitlement_limit(db, workspace_id, "connected_accounts")
    if limit is None:
        return

    count = (
        db.scalar(
            select(func.count())
            .select_from(ConnectedAccount)
            .where(
                ConnectedAccount.workspace_id == workspace_id,
                ConnectedAccount.status == "active",
            )
        )
        or 0
    )

    if count >= limit:
        plan = effective_plan(db, workspace_id)
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Workspace has reached the limit of {limit} connected accounts for the '{plan}' plan. Please upgrade to connect more channels.",
        )


def check_scheduled_posts_limit(db: Session, workspace_id: str) -> None:
    """Enforce workspace monthly scheduled posts quota."""
    lock_workspace(db, workspace_id)
    from app.modules.content.models import Post, PostVariant

    limit = entitlement_limit(db, workspace_id, "scheduled_posts")
    if limit is None:
        return

    cycle_start = usage_cycle_start(db, workspace_id)
    count = (
        db.scalar(
            select(func.count())
            .select_from(PostVariant)
            .join(Post, PostVariant.post_id == Post.id)
            .where(
                Post.workspace_id == workspace_id,
                PostVariant.status.in_(["scheduled", "publishing", "published"]),
                (PostVariant.scheduled_time >= cycle_start)
                | (PostVariant.published_at >= cycle_start)
                | (
                    (PostVariant.scheduled_time.is_(None)) & (PostVariant.created_at >= cycle_start)
                ),
            )
        )
        or 0
    )

    if count >= limit:
        plan = effective_plan(db, workspace_id)
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Workspace has reached the monthly limit of {limit} scheduled posts for the '{plan}' plan. Please upgrade to schedule more posts.",
        )


def check_assistant_usage_limit(db: Session, workspace_id: str) -> None:
    """Enforce workspace monthly AI assistant runs quota."""
    lock_workspace(db, workspace_id)
    from app.modules.assistant.models import AssistantRun

    limit = entitlement_limit(db, workspace_id, "ai_credits")
    if limit is None:
        return

    cycle_start = usage_cycle_start(db, workspace_id)
    count = (
        db.scalar(
            select(func.count())
            .select_from(AssistantRun)
            .where(
                AssistantRun.workspace_id == workspace_id,
                AssistantRun.created_at >= cycle_start,
            )
        )
        or 0
    )

    if count >= limit:
        plan = effective_plan(db, workspace_id)
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Workspace has reached the monthly limit of {limit} AI assistant runs for the '{plan}' plan. Please upgrade to continue generating content.",
        )


def get_plan_limits_summary(db: Session, workspace_id: str) -> dict[str, Any]:
    """Retrieve current usage vs plan quota summary for a workspace."""
    from app.modules.assistant.models import AssistantRun
    from app.modules.channels.models import ConnectedAccount
    from app.modules.content.models import Post, PostVariant

    plan = effective_plan(db, workspace_id)
    cycle_start = usage_cycle_start(db, workspace_id)

    conn_limit = entitlement_limit(db, workspace_id, "connected_accounts")
    conn_used = (
        db.scalar(
            select(func.count())
            .select_from(ConnectedAccount)
            .where(
                ConnectedAccount.workspace_id == workspace_id,
                ConnectedAccount.status == "active",
            )
        )
        or 0
    )

    posts_limit = entitlement_limit(db, workspace_id, "scheduled_posts")
    posts_used = (
        db.scalar(
            select(func.count())
            .select_from(PostVariant)
            .join(Post, PostVariant.post_id == Post.id)
            .where(
                Post.workspace_id == workspace_id,
                PostVariant.status.in_(["scheduled", "publishing", "published"]),
                (PostVariant.scheduled_time >= cycle_start)
                | (PostVariant.published_at >= cycle_start)
                | (
                    (PostVariant.scheduled_time.is_(None)) & (PostVariant.created_at >= cycle_start)
                ),
            )
        )
        or 0
    )

    ai_limit = entitlement_limit(db, workspace_id, "ai_credits")
    ai_used = (
        db.scalar(
            select(func.count())
            .select_from(AssistantRun)
            .where(
                AssistantRun.workspace_id == workspace_id,
                AssistantRun.created_at >= cycle_start,
            )
        )
        or 0
    )

    return {
        "plan_code": plan,
        "cycle_start": cycle_start,
        "connected_accounts": {
            "used": conn_used,
            "limit": conn_limit,
            "remaining": None if conn_limit is None else max(0, conn_limit - conn_used),
        },
        "scheduled_posts": {
            "used": posts_used,
            "limit": posts_limit,
            "remaining": None if posts_limit is None else max(0, posts_limit - posts_used),
        },
        "ai_credits": {
            "used": ai_used,
            "limit": ai_limit,
            "remaining": None if ai_limit is None else max(0, ai_limit - ai_used),
        },
    }
