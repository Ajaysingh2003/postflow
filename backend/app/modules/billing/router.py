import json
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, Header, HTTPException, Request, Response
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.dependencies import (
    get_current_user,
    get_current_workspace,
    membership_for,
    require_billing_access,
)
from app.core.security import utcnow
from app.db.session import get_db
from app.modules.billing import service
from app.modules.billing.entitlements import (
    PLAN_DEFAULTS,
    effective_plan,
    get_plan_limits_summary,
    plan_limits,
    sync_entitlements,
)
from app.modules.billing.entitlements import (
    current_subscription as latest_subscription,
)
from app.modules.billing.models import BillingCustomer, BillingWebhookEvent, Plan, Subscription
from app.modules.billing.schemas import (
    BillingUsageResponse,
    CheckoutRequest,
    CheckoutResponse,
    PortalResponse,
    SubscriptionResponse,
)
from app.modules.billing.usage import lock_workspace
from app.modules.identity.models import User, Workspace

router = APIRouter(tags=["billing"])


def parse_datetime(value: object) -> datetime | None:
    if not value or not isinstance(value, str):
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(UTC)
    except ValueError:
        return None


@router.get("/billing/plans")
def get_plans(db: Session = Depends(get_db)) -> dict:
    plans = {
        "starter": {
            "id": "starter",
            "name": "Starter",
            "description": "Ideal for founders & creators scaling their personal brand.",
            "popular": False,
            "trial_days": 0,
            "billing_cycles": {
                "monthly": {
                    "amount": 29,
                    "price_id": "starter_monthly",
                    "currency": "USD",
                    "interval": "month",
                },
                "quarterly": {
                    "amount": 24,
                    "price_id": "starter_quarterly",
                    "currency": "USD",
                    "interval": "quarter",
                },
                "annually": {
                    "amount": 19,
                    "price_id": "starter_annually",
                    "currency": "USD",
                    "interval": "year",
                },
            },
        },
        "pro": {
            "id": "pro",
            "name": "Pro",
            "description": "For growth leaders & high-volume teams running campaigns.",
            "popular": True,
            "trial_days": 0,
            "billing_cycles": {
                "monthly": {
                    "amount": 59,
                    "price_id": "pro_monthly",
                    "currency": "USD",
                    "interval": "month",
                },
                "quarterly": {
                    "amount": 49,
                    "price_id": "pro_quarterly",
                    "currency": "USD",
                    "interval": "quarter",
                },
                "annually": {
                    "amount": 39,
                    "price_id": "pro_annually",
                    "currency": "USD",
                    "interval": "year",
                },
            },
        },
        "business": {
            "id": "business",
            "name": "Business",
            "description": "For agencies managing client workspaces and larger publishing schedules.",
            "popular": False,
            "trial_days": 0,
            "billing_cycles": {
                "monthly": {
                    "amount": 129,
                    "price_id": "business_monthly",
                    "currency": "USD",
                    "interval": "month",
                },
                "quarterly": {
                    "amount": 109,
                    "price_id": "business_quarterly",
                    "currency": "USD",
                    "interval": "quarter",
                },
                "annually": {
                    "amount": 89,
                    "price_id": "business_annually",
                    "currency": "USD",
                    "interval": "year",
                },
            },
        },
    }

    configured = {plan.code: plan for plan in db.scalars(select(Plan).where(Plan.active.is_(True)))}
    for code, details in plans.items():
        details["limits"] = plan_limits(code, configured.get(code))
    return plans


@router.get("/billing/usage", response_model=BillingUsageResponse)
def billing_usage(
    response: Response,
    user: User = Depends(get_current_user),
    workspace: Workspace = Depends(get_current_workspace),
    db: Session = Depends(get_db),
) -> BillingUsageResponse:
    membership = membership_for(db, workspace.id, user.id)
    response.headers["Cache-Control"] = "private, no-store"
    subscription = db.scalar(
        select(Subscription)
        .where(Subscription.workspace_id == workspace.id)
        .order_by(Subscription.updated_at.desc())
    )
    return BillingUsageResponse(
        usage=get_plan_limits_summary(db, workspace.id),
        subscription=SubscriptionResponse.model_validate(subscription) if subscription else None,
        can_manage_billing=membership.role in {"owner", "admin", "billing"},
    )


@router.post(
    "/billing/checkout",
    response_model=CheckoutResponse,
    dependencies=[Depends(require_billing_access)],
)
async def checkout(
    payload: CheckoutRequest,
    user: User = Depends(get_current_user),
    workspace: Workspace = Depends(get_current_workspace),
) -> CheckoutResponse:
    settings = get_settings()
    product_id = settings.dodo_product_id(payload.plan_code)
    if not product_id:
        raise HTTPException(status_code=422, detail="Unknown or unconfigured plan")
    seat_limit = PLAN_DEFAULTS.get(payload.plan_code, {}).get("seats", 1) or 1
    if payload.seats > seat_limit:
        raise HTTPException(status_code=422, detail="Seat quantity exceeds this plan")
    result = await service.create_checkout(
        settings,
        product_id,
        user.id,
        workspace.id,
        payload.plan_code,
        user.email,
        user.name,
        payload.seats,
    )
    checkout_url = result.get("checkout_url")
    if not checkout_url:
        raise HTTPException(status_code=502, detail="Billing provider returned no checkout URL")
    return CheckoutResponse(checkout_url=checkout_url, session_id=result["session_id"])


@router.get(
    "/billing/subscription",
    response_model=SubscriptionResponse | None,
    dependencies=[Depends(require_billing_access)],
)
def current_subscription(
    workspace: Workspace = Depends(get_current_workspace), db: Session = Depends(get_db)
) -> Subscription | None:
    return db.scalar(
        select(Subscription)
        .where(Subscription.workspace_id == workspace.id)
        .order_by(Subscription.created_at.desc())
    )


@router.post(
    "/billing/portal", response_model=PortalResponse, dependencies=[Depends(require_billing_access)]
)
async def customer_portal(
    user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> PortalResponse:
    customer = db.scalar(select(BillingCustomer).where(BillingCustomer.user_id == user.id))
    if customer is None:
        raise HTTPException(status_code=404, detail="Billing customer not found")
    result = await service.create_portal(get_settings(), customer.provider_customer_id)
    return PortalResponse(link=result["link"])


@router.post("/webhooks/dodo", status_code=204)
async def dodo_webhook(
    request: Request,
    webhook_id: str | None = Header(default=None, alias="webhook-id"),
    webhook_timestamp: str | None = Header(default=None, alias="webhook-timestamp"),
    webhook_signature: str | None = Header(default=None, alias="webhook-signature"),
    db: Session = Depends(get_db),
) -> None:
    settings = get_settings()
    if not settings.dodo_webhook_secret:
        raise HTTPException(status_code=503, detail="Dodo webhook is not configured")
    body = await request.body()
    service.verify_webhook(
        settings.dodo_webhook_secret,
        body,
        webhook_id,
        webhook_timestamp,
        webhook_signature,
    )
    try:
        payload = json.loads(body)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail="Invalid JSON payload") from exc
    event_type = str(payload.get("type") or "unknown")
    event = BillingWebhookEvent(
        provider="dodo",
        provider_event_id=webhook_id,
        event_type=event_type,
        payload=payload,
    )
    db.add(event)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        return

    data = payload.get("data") or {}
    obj = (
        data.get("object")
        if isinstance(data, dict) and isinstance(data.get("object"), dict)
        else data
    )
    obj = obj if isinstance(obj, dict) else {}
    metadata = obj.get("metadata") if isinstance(obj.get("metadata"), dict) else {}
    user_id = metadata.get("user_id")
    workspace_id = metadata.get("workspace_id")
    customer_id = (
        obj.get("customer_id") or (obj.get("customer") or {}).get("customer_id")
        if isinstance(obj.get("customer"), dict)
        else obj.get("customer_id")
    )
    subscription_id = obj.get("subscription_id") or obj.get("id")
    provider_updated_at = (
        parse_datetime(payload.get("created_at") or obj.get("updated_at")) or utcnow()
    )

    if user_id and customer_id:
        customer = db.scalar(select(BillingCustomer).where(BillingCustomer.user_id == user_id))
        if customer is None:
            db.add(BillingCustomer(user_id=user_id, provider_customer_id=str(customer_id)))

    if event_type.startswith("subscription.") and user_id and workspace_id and subscription_id:
        lock_workspace(db, str(workspace_id))
        subscription = db.scalar(
            select(Subscription)
            .where(Subscription.provider_subscription_id == str(subscription_id))
            .with_for_update()
        )
        if subscription is None:
            subscription = Subscription(
                user_id=str(user_id),
                workspace_id=str(workspace_id),
                provider_subscription_id=str(subscription_id),
                plan_code=str(metadata.get("plan_code") or "unknown"),
                status=event_type.split(".", 1)[1],
                quantity=int(obj.get("quantity") or 1),
            )
            db.add(subscription)
        else:
            stored_provider_time = subscription.provider_updated_at
            if stored_provider_time and stored_provider_time.tzinfo is None:
                stored_provider_time = stored_provider_time.replace(tzinfo=UTC)
            if stored_provider_time and provider_updated_at < stored_provider_time:
                event.processed_at = utcnow()
                db.commit()
                return
            subscription.status = event_type.split(".", 1)[1]
        subscription.provider_updated_at = provider_updated_at
        subscription.quantity = int(obj.get("quantity") or subscription.quantity or 1)
        subscription.current_period_start = parse_datetime(
            obj.get("previous_billing_date") or obj.get("current_period_start")
        )
        subscription.current_period_end = parse_datetime(
            obj.get("next_billing_date") or obj.get("current_period_end")
        )
        subscription.cancel_at_period_end = bool(obj.get("cancel_at_next_billing_date", False))
        if event_type == "subscription.on_hold":
            subscription.grace_until = utcnow() + timedelta(days=settings.billing_grace_days)
        elif event_type in {"subscription.active", "subscription.renewed"}:
            subscription.grace_until = None
        plan_code = str(metadata.get("plan_code") or subscription.plan_code)
        if plan_code in PLAN_DEFAULTS:
            subscription.plan_code = plan_code
        db.flush()
        current = latest_subscription(db, str(workspace_id))
        sync_entitlements(
            db,
            str(workspace_id),
            effective_plan(db, str(workspace_id)),
            current.quantity if current else 1,
        )

    if event_type.startswith(("refund.", "dispute.")):
        provider_subscription_id = obj.get("subscription_id")
        if provider_subscription_id:
            subscription = db.scalar(
                select(Subscription).where(
                    Subscription.provider_subscription_id == str(provider_subscription_id)
                )
            )
            if subscription and event_type in {
                "refund.succeeded",
                "dispute.opened",
                "dispute.lost",
            }:
                lock_workspace(db, subscription.workspace_id)
                subscription.status = "revoked"
                subscription.grace_until = None
                db.flush()
                current = latest_subscription(db, subscription.workspace_id)
                sync_entitlements(
                    db,
                    subscription.workspace_id,
                    effective_plan(db, subscription.workspace_id),
                    current.quantity if current else 1,
                )
    event.processed_at = utcnow()
    db.commit()
