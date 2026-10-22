"""Billing entitlements and plan quotas enforcement.

Tracks and limits:
- Maximum connected accounts
- Monthly scheduled posts
- Monthly AI assistant runs / credits
- Workspace seats
"""

from calendar import monthrange
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
        "brand_profiles": 0,
        "ai_credits": 20,
        "scheduled_posts": 5,
        "seats": 1,
        "workspaces": 1,
        "connected_accounts": 2,
    },
    "starter": {
        "brand_profiles": 3,
        "ai_credits": 1000,
        "scheduled_posts": None,
        "seats": 3,
        "workspaces": 3,
        "connected_accounts": 5,
    },
    "creator": {
        "brand_profiles": 3,
        "ai_credits": 1000,
        "scheduled_posts": None,
        "seats": 1,
        "workspaces": 1,
        "connected_accounts": 5,
    },
    "pro": {
        "brand_profiles": 5,
        "ai_credits": 5000,
        "scheduled_posts": None,
        "seats": 5,
        "workspaces": 5,
        "connected_accounts": 15,
    },
    "business": {
        "brand_profiles": 10,
        "ai_credits": 8000,
        "scheduled_posts": None,
        "seats": 15,
        "workspaces": 10,
        "connected_accounts": 50,
    },
    "agency": {
        "brand_profiles": 10,
        "ai_credits": 8000,
        "scheduled_posts": None,
        "seats": 25,
        "workspaces": 25,
        "connected_accounts": 100,
    },
}


def plan_limits(plan_code: str, plan: Plan | None = None) -> dict[str, int | None]:
    """Paid publishing is unlimited, including plans with legacy stored quotas."""
    values = {
        **PLAN_DEFAULTS.get(plan_code, PLAN_DEFAULTS["free"]),
        **(plan.limits if plan else {}),
    }
    if plan_code != "free" and (plan_code in PLAN_DEFAULTS or plan is not None):
        values["scheduled_posts"] = None
    return values


def current_subscription(db: Session, workspace_id: str) -> Subscription | None:
    return db.scalar(
        select(Subscription)
        .where(Subscription.workspace_id == workspace_id)
        .order_by(Subscription.created_at.desc(), Subscription.id.desc())
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
    db.flush()
    plan = db.scalar(select(Plan).where(Plan.code == plan_code, Plan.active.is_(True)))
    values = plan_limits(plan_code, plan)
    db.execute(
        delete(EntitlementGrant).where(
            EntitlementGrant.workspace_id == workspace_id, EntitlementGrant.source == "plan"
        )
    )
    overrides = set(
        db.scalars(
            select(EntitlementGrant.capability).where(
                EntitlementGrant.workspace_id == workspace_id, EntitlementGrant.source != "plan"
            )
        )
    )
    for capability, limit in values.items():
        # A product quantity is not the number of included team seats.
        if capability in overrides:
            continue
        db.add(
            EntitlementGrant(
                workspace_id=workspace_id, capability=capability, limit_value=limit, source="plan"
            )
        )

    db.flush()


def entitlement_limit(db: Session, workspace_id: str, capability: str) -> int | None:
    code = effective_plan(db, workspace_id)
    if capability == "scheduled_posts" and code != "free":
        # Old plan grants and custom limits must not reintroduce a paid post cap.
        return None
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
    if grant and grant.source != "plan":
        return grant.limit_value
    if grant and code != "free" and capability != "seats":
        return grant.limit_value
    # Recompute included seats so old quantity=1 grants do not strand paid teams.
    plan = db.scalar(select(Plan).where(Plan.code == code, Plan.active.is_(True)))
    return plan_limits(code, plan).get(capability)


def usage_window(subscription, now=None):
    """Monthly windows anchored to the original billing day, including yearly plans."""
    now = as_utc(now or datetime.now(UTC))
    anchor = (
        as_utc(subscription.current_period_start)
        if has_paid_access(subscription, now) and subscription.current_period_start
        else now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    )
    if anchor > now:
        anchor = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    def anniversary(offset):
        absolute = anchor.year * 12 + anchor.month - 1 + offset
        year, month = divmod(absolute, 12)
        month += 1
        return anchor.replace(
            year=year, month=month, day=min(anchor.day, monthrange(year, month)[1])
        )

    offset = (now.year - anchor.year) * 12 + now.month - anchor.month
    if anniversary(offset) > now:
        offset -= 1
    return anniversary(offset), anniversary(offset + 1)


def usage_cycle_start(db: Session, workspace_id: str, now: datetime | None = None) -> datetime:
    return usage_window(current_subscription(db, workspace_id), now)[0]


def _post_usage_query(workspace_id, start, end):
    from app.modules.content.models import Post, PostVariant

    # Each parent post consumes one slot across all its destinations.
    return (
        select(Post.id)
        .join(PostVariant, PostVariant.post_id == Post.id)
        .where(
            Post.workspace_id == workspace_id,
            PostVariant.status.in_(["scheduled", "publishing", "published"]),
            func.coalesce(
                PostVariant.scheduled_time, PostVariant.published_at, PostVariant.created_at
            )
            >= start,
            func.coalesce(
                PostVariant.scheduled_time, PostVariant.published_at, PostVariant.created_at
            )
            < end,
        )
        .distinct()
    )


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
                ConnectedAccount.status.in_(["active", "needs_reauth"]),
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


def check_scheduled_posts_limit(
    db: Session, workspace_id: str, post_id=None, scheduled_time=None
) -> None:
    """One slot per post, per monthly publication window."""
    lock_workspace(db, workspace_id)
    limit = entitlement_limit(db, workspace_id, "scheduled_posts")
    if limit is None:
        return
    start, end = usage_window(current_subscription(db, workspace_id), scheduled_time)
    query = _post_usage_query(workspace_id, start, end)
    ids = query.subquery()
    if post_id and db.scalar(select(ids.c.id).where(ids.c.id == post_id)):
        return
    count = db.scalar(select(func.count()).select_from(ids)) or 0
    if count >= limit:
        plan = effective_plan(db, workspace_id)
        raise HTTPException(
            403,
            f"Workspace has reached the monthly limit of {limit} scheduled posts for the '{plan}' plan. Please upgrade to schedule more posts.",
        )


def check_assistant_usage_limit(db: Session, workspace_id: str) -> None:
    """Read numeric monthly/bonus counters under the workspace lock."""
    from app.modules.billing.credits import check_available

    check_available(db, workspace_id, datetime.now(UTC))


def get_plan_limits_summary(db: Session, workspace_id: str, now=None) -> dict[str, Any]:
    """Bounded queries shared by Home, Billing and composer usage displays."""
    from app.modules.channels.models import ConnectedAccount

    now = as_utc(now or datetime.now(UTC))
    subscription = current_subscription(db, workspace_id)
    paid = has_paid_access(subscription, now)
    code = subscription.plan_code if paid else "free"
    plan = db.scalar(select(Plan).where(Plan.code == code, Plan.active.is_(True)))
    if not plan and code not in PLAN_DEFAULTS:
        code = "free"
    limits = plan_limits(code, plan)
    grants = db.scalars(
        select(EntitlementGrant).where(
            EntitlementGrant.workspace_id == workspace_id,
            (EntitlementGrant.expires_at.is_(None)) | (EntitlementGrant.expires_at > now),
        )
    )
    for grant in grants:
        if grant.capability == "scheduled_posts" and code != "free":
            continue
        if grant.source != "plan" or code != "free":
            limits[grant.capability] = grant.limit_value
    start, end = usage_window(subscription, now)
    accounts = (
        db.scalar(
            select(func.count())
            .select_from(ConnectedAccount)
            .where(
                ConnectedAccount.workspace_id == workspace_id,
                ConnectedAccount.status.in_(["active", "needs_reauth"]),
            )
        )
        or 0
    )
    posts = (
        db.scalar(
            select(func.count()).select_from(_post_usage_query(workspace_id, start, end).subquery())
        )
        or 0
    )
    from app.modules.billing.credits import summary as credit_summary

    balance, ai, credit_details = credit_summary(db, workspace_id, now)
    start, end = as_utc(balance.cycle_start), as_utc(balance.cycle_end)

    def detail(capability, used):
        limit = limits.get(capability)
        return {
            "used": used,
            "limit": limit,
            "remaining": None if limit is None else max(0, limit - used),
        }

    return {
        "plan_code": code,
        "cycle_start": start,
        "cycle_end": end,
        "connected_accounts": detail("connected_accounts", accounts),
        "scheduled_posts": detail("scheduled_posts", posts),
        "ai_credits": ai,
        "ai_credit_details": credit_details,
    }
