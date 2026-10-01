import base64
import hashlib
import hmac
import time
from datetime import UTC, datetime

import httpx
from fastapi import HTTPException

from app.core.config import Settings
from app.core.security import utcnow
from app.modules.billing.entitlements import sync_entitlements
from app.modules.billing.models import Subscription


def _api_headers(settings: Settings) -> dict[str, str]:
    if not settings.dodo_api_key:
        raise HTTPException(status_code=503, detail="Dodo Payments is not configured")
    return {"Authorization": f"Bearer {settings.dodo_api_key}", "Content-Type": "application/json"}


async def create_checkout(
    settings: Settings,
    product_id: str,
    user_id: str,
    workspace_id: str,
    plan_code: str,
    email: str,
    name: str,
    seats: int = 1,
) -> dict:
    if not settings.dodo_api_key:
        return {
            "checkout_url": f"{settings.dodo_return_url}?checkout=success&plan={plan_code}&trial_days=3",
            "session_id": f"mock_dodo_sess_{user_id}_{plan_code}",
        }

    body = {
        "product_cart": [{"product_id": product_id, "quantity": seats}],
        "subscription_data": {
            "trial_period_days": 3,
        },
        "customer": {"email": email, "name": name},
        "return_url": settings.dodo_return_url,
        "metadata": {
            "user_id": user_id,
            "workspace_id": workspace_id,
            "plan_code": plan_code,
        },
    }
    async with httpx.AsyncClient(timeout=20) as client:
        response = await client.post(
            f"{settings.dodo_api_base.rstrip('/')}/checkouts",
            headers=_api_headers(settings),
            json=body,
        )
    if response.is_error:
        try:
            err_data = response.json()
            detail = err_data.get("message") or err_data.get("detail") or "Unable to create billing checkout"
        except Exception:  # noqa: BLE001
            detail = "Unable to create billing checkout"
        raise HTTPException(status_code=502, detail=str(detail))
    return response.json()


def retrieve_subscription(settings: Settings, subscription_id: str) -> dict:
    response = httpx.get(
        f"{settings.dodo_api_base.rstrip('/')}/subscriptions/{subscription_id}",
        headers=_api_headers(settings),
        timeout=20,
    )
    response.raise_for_status()
    return response.json()


def reconcile_subscriptions(settings: Settings, db) -> int:
    if not settings.dodo_api_key:
        return 0
    subscriptions = list(
        db.query(Subscription)
        .filter(Subscription.status.in_(["active", "trialing", "on_hold", "cancelled"]))
        .limit(200)
    )
    reconciled = 0
    for subscription in subscriptions:
        try:
            remote = retrieve_subscription(settings, subscription.provider_subscription_id)
            subscription.status = str(remote.get("status") or subscription.status)
            subscription.quantity = int(remote.get("quantity") or subscription.quantity or 1)
            next_date = remote.get("next_billing_date")
            previous_date = remote.get("previous_billing_date")
            if next_date:
                subscription.current_period_end = datetime.fromisoformat(
                    str(next_date).replace("Z", "+00:00")
                ).astimezone(UTC)
            if previous_date:
                subscription.current_period_start = datetime.fromisoformat(
                    str(previous_date).replace("Z", "+00:00")
                ).astimezone(UTC)
            subscription.cancel_at_period_end = bool(
                remote.get("cancel_at_next_billing_date", False)
            )
            subscription.last_reconciled_at = utcnow()
            sync_entitlements(
                db, subscription.workspace_id, subscription.plan_code, subscription.quantity
            )
            reconciled += 1
        except Exception:  # noqa: BLE001, S112
            continue
    return reconciled


async def create_portal(settings: Settings, customer_id: str) -> dict:
    async with httpx.AsyncClient(timeout=20) as client:
        response = await client.post(
            f"{settings.dodo_api_base.rstrip('/')}/customers/{customer_id}/customer-portal/session",
            params={"return_url": settings.dodo_return_url},
            headers=_api_headers(settings),
        )
    if response.is_error:
        raise HTTPException(status_code=502, detail="Unable to create customer portal session")
    return response.json()


def verify_webhook(
    secret: str,
    body: bytes,
    webhook_id: str | None,
    timestamp: str | None,
    signature_header: str | None,
    tolerance_seconds: int = 300,
) -> None:
    if not webhook_id or not timestamp or not signature_header:
        raise HTTPException(status_code=400, detail="Missing webhook signature headers")
    try:
        timestamp_int = int(timestamp)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid webhook timestamp") from exc
    if abs(int(time.time()) - timestamp_int) > tolerance_seconds:
        raise HTTPException(status_code=400, detail="Webhook timestamp is outside tolerance")
    encoded_secret = secret.removeprefix("whsec_")
    try:
        secret_bytes = base64.b64decode(encoded_secret)
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Webhook secret is invalid") from exc
    signed = f"{webhook_id}.{timestamp}.".encode() + body
    expected = base64.b64encode(hmac.new(secret_bytes, signed, hashlib.sha256).digest()).decode()
    candidates = []
    for item in signature_header.replace(",", " ").split():
        candidates.append(
            item.split("=", 1)[-1] if item.startswith("v1=") else item.removeprefix("v1,")
        )
    if not any(hmac.compare_digest(expected, candidate) for candidate in candidates):
        raise HTTPException(status_code=400, detail="Invalid webhook signature")
