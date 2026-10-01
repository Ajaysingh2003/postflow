import base64
import hashlib
import hmac
import json
import time
from datetime import UTC, datetime, timedelta

import pytest
from fastapi import HTTPException

from app.core.config import get_settings
from app.db.session import SessionLocal
from app.modules.billing.models import EntitlementGrant, Subscription
from app.modules.billing.service import verify_webhook


def test_standard_webhook_signature_verification():
    raw_secret = b"test-webhook-secret"
    secret = "whsec_" + base64.b64encode(raw_secret).decode()
    body = b'{"type":"subscription.active"}'
    webhook_id = "msg_test"
    timestamp = str(int(time.time()))
    signed = f"{webhook_id}.{timestamp}.".encode() + body
    signature = base64.b64encode(hmac.new(raw_secret, signed, hashlib.sha256).digest()).decode()

    verify_webhook(secret, body, webhook_id, timestamp, f"v1,{signature}")

    with pytest.raises(HTTPException):
        verify_webhook(secret, body + b"x", webhook_id, timestamp, f"v1,{signature}")


def _post_signed(client, payload: dict, event_id: str):
    secret_bytes = b"lifecycle-test-secret"
    get_settings().dodo_webhook_secret = "whsec_" + base64.b64encode(secret_bytes).decode()
    body = json.dumps(payload, separators=(",", ":")).encode()
    timestamp = str(int(time.time()))
    signed = f"{event_id}.{timestamp}.".encode() + body
    signature = base64.b64encode(hmac.new(secret_bytes, signed, hashlib.sha256).digest()).decode()
    return client.post(
        "/api/v1/webhooks/dodo",
        content=body,
        headers={
            "content-type": "application/json",
            "webhook-id": event_id,
            "webhook-timestamp": timestamp,
            "webhook-signature": f"v1,{signature}",
        },
    )


def test_subscription_upgrade_hold_out_of_order_failure_and_refund(client, auth):
    me = client.get("/api/v1/auth/me", headers=auth).json()
    base = datetime.now(UTC)

    def event(kind: str, at: datetime, plan: str = "creator") -> dict:
        return {
            "type": kind,
            "created_at": at.isoformat(),
            "data": {
                "subscription_id": "sub_lifecycle",
                "customer_id": "cus_lifecycle",
                "quantity": 3,
                "next_billing_date": (base + timedelta(days=30)).isoformat(),
                "metadata": {
                    "user_id": me["id"],
                    "workspace_id": me["workspace_id"],
                    "plan_code": plan,
                },
            },
        }

    assert (
        _post_signed(
            client, event("subscription.active", base, "creator"), "evt_active"
        ).status_code
        == 204
    )
    assert (
        _post_signed(
            client,
            event("subscription.plan_changed", base + timedelta(minutes=2), "pro"),
            "evt_upgrade",
        ).status_code
        == 204
    )
    assert (
        _post_signed(
            client,
            event("subscription.on_hold", base + timedelta(minutes=1), "pro"),
            "evt_old_hold",
        ).status_code
        == 204
    )
    with SessionLocal() as db:
        subscription = (
            db.query(Subscription).filter_by(provider_subscription_id="sub_lifecycle").one()
        )
        assert subscription.status == "plan_changed"
        assert subscription.plan_code == "pro"
        seats = (
            db.query(EntitlementGrant)
            .filter_by(workspace_id=me["workspace_id"], capability="seats")
            .one()
        )
        assert seats.limit_value == 3

    assert (
        _post_signed(
            client,
            event("payment.failed", base + timedelta(minutes=3), "pro"),
            "evt_payment_failed",
        ).status_code
        == 204
    )
    assert (
        _post_signed(
            client, event("subscription.on_hold", base + timedelta(minutes=4), "pro"), "evt_hold"
        ).status_code
        == 204
    )
    with SessionLocal() as db:
        subscription = (
            db.query(Subscription).filter_by(provider_subscription_id="sub_lifecycle").one()
        )
        assert subscription.status == "on_hold"
        assert subscription.grace_until is not None

    refund = {
        "type": "refund.succeeded",
        "created_at": (base + timedelta(minutes=5)).isoformat(),
        "data": {"subscription_id": "sub_lifecycle"},
    }
    assert _post_signed(client, refund, "evt_refund").status_code == 204
    with SessionLocal() as db:
        subscription = (
            db.query(Subscription).filter_by(provider_subscription_id="sub_lifecycle").one()
        )
        assert subscription.status == "revoked"
