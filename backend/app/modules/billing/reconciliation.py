"""Bounded, leased billing checks with durable keyset progress and retry records."""

import logging
import math
import random
from collections import deque
from datetime import datetime, timedelta
from email.utils import parsedate_to_datetime
from time import monotonic, sleep
from typing import Literal
from uuid import uuid4

import httpx
from pydantic import BaseModel, Field, ValidationError
from sqlalchemy import delete, func, or_, select, update
from sqlalchemy.exc import IntegrityError, SQLAlchemyError

from app.core.security import as_utc, utcnow
from app.modules.billing.entitlements import (
    PLAN_DEFAULTS,
    current_subscription,
    effective_plan,
    sync_entitlements,
)
from app.modules.billing.models import BillingReconciliationRetry as Retry
from app.modules.billing.models import BillingReconciliationState as State
from app.modules.billing.models import Subscription
from app.modules.billing.service import retrieve_subscription
from app.modules.billing.usage import lock_workspace

logger = logging.getLogger(__name__)


class RemoteSubscription(BaseModel):
    subscription_id: str
    status: Literal["pending", "active", "on_hold", "cancelled", "failed", "expired"]
    quantity: int = Field(gt=0, le=100_000, strict=True)
    cancel_at_next_billing_date: bool = Field(strict=True)
    next_billing_date: datetime | None = None
    previous_billing_date: datetime | None = None
    product_id: str | None = None
    updated_at: datetime | None = None


class LeaseLost(Exception):
    pass


def retry_after_seconds(headers, now):
    """Accept seconds, HTTP-date or the SDK's retry-after-ms convention."""
    raw = headers.get("retry-after-ms")
    try:
        if raw is not None:
            seconds = float(raw) / 1000
        else:
            raw = headers.get("retry-after")
            if raw is None:
                return 0.0
            try:
                seconds = float(raw)
            except ValueError:
                seconds = (as_utc(parsedate_to_datetime(raw)) - now).total_seconds()
        return max(0.0, seconds) if math.isfinite(seconds) and seconds < 31_536_000 else 0.0
    except (TypeError, ValueError, OverflowError):
        return 0.0


def _backoff(settings, attempts):
    base = min(
        settings.billing_reconcile_retry_max_seconds,
        settings.billing_reconcile_retry_base_seconds * 2 ** min(attempts - 1, 16),
    )
    return base + random.uniform(0, base * 0.2)


def _lease_seconds(settings):
    return (
        settings.billing_reconcile_time_budget_seconds
        + settings.billing_reconcile_http_timeout_seconds * 2
        + 30
    )


def _claim(db, settings, owner):
    if db.get(State, "dodo") is None:
        try:
            with db.begin_nested():
                db.add(State(provider="dodo"))
                db.flush()
        except IntegrityError:
            pass  # Another scheduler created the singleton first.
        db.commit()
    now = utcnow()
    claimed = db.execute(
        update(State)
        .execution_options(synchronize_session="fetch")
        .where(
            State.provider == "dodo",
            or_(State.lease_expires_at.is_(None), State.lease_expires_at <= now),
        )
        .values(
            lease_owner=owner, lease_expires_at=now + timedelta(seconds=_lease_seconds(settings))
        )
    )
    db.commit()
    return claimed.rowcount == 1


def _fence(db, owner, settings):
    now = utcnow()
    result = db.execute(
        update(State)
        .execution_options(synchronize_session="fetch")
        .where(
            State.provider == "dodo",
            State.lease_owner == owner,
            State.lease_expires_at > now,
        )
        .values(lease_expires_at=now + timedelta(seconds=_lease_seconds(settings)))
    )
    if result.rowcount != 1:
        raise LeaseLost


def _advance(db, owner, settings, cursor=None):
    _fence(db, owner, settings)
    if cursor is not None:
        db.execute(
            update(State)
            .execution_options(synchronize_session="fetch")
            .where(State.provider == "dodo")
            .values(cursor_id=cursor)
        )
    db.commit()


def _next_retry(db, seen):
    query = (
        select(Retry.subscription_id)
        .join(Subscription)
        .where(
            Retry.next_attempt_at <= utcnow(),
            Subscription.status != "revoked",
        )
        .order_by(Retry.next_attempt_at, Retry.subscription_id)
        .limit(1)
    )
    if seen:
        query = query.where(Retry.subscription_id.not_in(seen))
    return db.scalar(query)


def _start_pass(db, state, owner, settings):
    if state.upper_bound_id is not None:
        return True
    if state.next_run_at and as_utc(state.next_run_at) > utcnow():
        return False
    _fence(db, owner, settings)
    upper = db.scalar(select(func.max(Subscription.id)).where(Subscription.status != "revoked"))
    db.execute(
        update(State)
        .execution_options(synchronize_session="fetch")
        .where(State.provider == "dodo")
        .values(
            upper_bound_id=upper,
            cursor_id=None,
            started_at=utcnow(),
            next_run_at=utcnow() + timedelta(seconds=settings.billing_reconcile_interval_seconds),
            completed_at=None if upper else utcnow(),
        )
    )
    db.commit()
    return upper is not None


def _next_normal(db, state, pending, owner, settings):
    if not pending:
        query = (
            select(Subscription.id)
            .where(
                Subscription.status != "revoked",
                Subscription.id <= state.upper_bound_id,
            )
            .order_by(Subscription.id)
            .limit(settings.billing_reconcile_batch_size)
        )
        if state.cursor_id:
            query = query.where(Subscription.id > state.cursor_id)
        pending.extend(db.scalars(query))
    if pending:
        return pending.popleft()
    _fence(db, owner, settings)
    db.execute(
        update(State)
        .execution_options(synchronize_session="fetch")
        .where(State.provider == "dodo")
        .values(
            cursor_id=None,
            upper_bound_id=None,
            completed_at=utcnow(),
            next_run_at=utcnow() + timedelta(seconds=settings.billing_reconcile_interval_seconds),
        )
    )
    db.commit()
    return None


def _plan_code(settings, subscription, remote):
    if not remote.product_id:
        return subscription.plan_code
    cycles = ("monthly", "quarterly", "annually")
    if any(
        settings.dodo_product_id(subscription.plan_code, cycle) == remote.product_id
        for cycle in cycles
    ):
        return subscription.plan_code
    for code in PLAN_DEFAULTS:
        if code != "free" and any(
            settings.dodo_product_id(code, cycle) == remote.product_id for cycle in cycles
        ):
            return code
    if remote.status != "active":
        # Unknown product mapping must not hide a verified loss of paid access.
        return subscription.plan_code
    raise ValueError("Unknown provider product")


def _apply(db, settings, snapshot, remote):
    lock_workspace(db, snapshot["workspace_id"])
    row = db.scalar(
        select(Subscription)
        .where(Subscription.id == snapshot["id"])
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    if row is None or row.status == "revoked":
        return False
    if row.updated_at != snapshot["version"]:
        raise ValueError("Stale local state")
    if (
        remote.updated_at
        and row.provider_updated_at
        and as_utc(remote.updated_at) < as_utc(row.provider_updated_at)
    ):
        raise ValueError("Stale provider state")
    plan_code = _plan_code(settings, row, remote)
    previous_status = row.status
    row.status = remote.status
    row.quantity = remote.quantity
    row.plan_code = plan_code
    row.cancel_at_period_end = remote.cancel_at_next_billing_date
    if "next_billing_date" in remote.model_fields_set:
        row.current_period_end = (
            as_utc(remote.next_billing_date) if remote.next_billing_date else None
        )
    if "previous_billing_date" in remote.model_fields_set:
        row.current_period_start = (
            as_utc(remote.previous_billing_date) if remote.previous_billing_date else None
        )
    if remote.updated_at:
        row.provider_updated_at = as_utc(remote.updated_at)
    if remote.status == "on_hold" and previous_status != "on_hold":
        row.grace_until = utcnow() + timedelta(days=settings.billing_grace_days)
    elif remote.status in {"active", "failed", "expired", "cancelled"}:
        row.grace_until = None
    row.last_reconciled_at = utcnow()
    db.flush()
    current = current_subscription(db, row.workspace_id)
    sync_entitlements(
        db,
        row.workspace_id,
        effective_plan(db, row.workspace_id),
        current.quantity if current else 1,
    )
    return True


def _save_failure(db, settings, local_id, code, provider_wide, retry_after):
    if db.get(Subscription, local_id) is None:
        return
    retry = db.get(Retry, local_id)
    if retry is None:
        retry = Retry(subscription_id=local_id, attempts=0)
        db.add(retry)
    retry.attempts += 1
    retry.last_attempt_at = utcnow()
    delay = max(_backoff(settings, retry.attempts), retry_after)
    if code in {"provider_401", "provider_403", "provider_404"}:
        delay = max(delay, settings.billing_reconcile_interval_seconds)
    retry.next_attempt_at = utcnow() + timedelta(seconds=delay)
    retry.error_code = code
    if provider_wide:
        state = db.get(State, "dodo", populate_existing=True)
        state.provider_failures += 1
        state.next_request_at = utcnow() + timedelta(
            seconds=max(
                delay,
                _backoff(settings, state.provider_failures),
            )
        )
    logger.warning(
        "Billing reconciliation deferred: subscription=%s error=%s attempt=%s",
        local_id,
        code,
        retry.attempts,
    )


def _request(settings, snapshot, client):
    try:
        raw = retrieve_subscription(settings, snapshot["provider_id"], client=client)
        remote = RemoteSubscription.model_validate(raw)
        if remote.subscription_id != snapshot["provider_id"]:
            return None, "identity_mismatch", False, 0
        return remote, None, False, 0
    except httpx.HTTPStatusError as exc:
        status = exc.response.status_code
        return (
            None,
            f"provider_{status}",
            status in {401, 403, 408, 429} or status >= 500,
            retry_after_seconds(exc.response.headers, utcnow()),
        )
    except httpx.HTTPError:
        return None, "provider_network", True, 0
    except (ValueError, ValidationError):
        return None, "invalid_response", False, 0


def run_reconciliation(settings, db):
    if not settings.dodo_api_key:
        return 0
    owner = str(uuid4())
    if not _claim(db, settings, owner):
        return 0
    pending, seen = deque(), set()
    deadline = monotonic() + settings.billing_reconcile_time_budget_seconds
    attempts = successes = 0
    try:
        with httpx.Client(follow_redirects=False) as client:
            while attempts < settings.billing_reconcile_max_requests and monotonic() < deadline:
                state = db.get(State, "dodo", populate_existing=True)
                if state.next_request_at and as_utc(state.next_request_at) > utcnow():
                    wait = (as_utc(state.next_request_at) - utcnow()).total_seconds()
                    if (
                        wait > settings.billing_reconcile_request_interval_seconds + 0.05
                        or wait >= deadline - monotonic()
                    ):
                        break
                    db.rollback()
                    sleep(wait)
                    continue
                ongoing = _start_pass(db, state, owner, settings)
                local_id = _next_retry(db, seen) if attempts % 2 == 0 else None
                normal = local_id is None and ongoing
                if normal:
                    state = db.get(State, "dodo", populate_existing=True)
                    local_id = _next_normal(db, state, pending, owner, settings)
                if local_id is None:
                    local_id, normal = _next_retry(db, seen), False
                if local_id is None:
                    break
                row = db.get(Subscription, local_id, populate_existing=True)
                retry = db.get(Retry, local_id)
                already_checked = bool(
                    normal
                    and row
                    and row.last_reconciled_at
                    and state.started_at
                    and as_utc(row.last_reconciled_at) >= as_utc(state.started_at)
                )
                if (
                    not row
                    or row.status == "revoked"
                    or already_checked
                    or (retry and as_utc(retry.next_attempt_at) > utcnow())
                ):
                    _advance(db, owner, settings, local_id if normal else None)
                    continue
                snapshot = {
                    "id": row.id,
                    "provider_id": row.provider_subscription_id,
                    "workspace_id": row.workspace_id,
                    "version": row.updated_at,
                }
                _fence(db, owner, settings)
                db.commit()  # No transaction or subscription/workspace lock during HTTP.
                remote, error, provider_wide, retry_after = _request(settings, snapshot, client)
                attempts += 1
                seen.add(local_id)
                _fence(db, owner, settings)  # A stale lease holder cannot apply provider results.
                applied = False
                if remote:
                    try:
                        with db.begin_nested():
                            applied = _apply(db, settings, snapshot, remote)
                    except ValueError:
                        error = "stale_or_unknown_product"
                    except SQLAlchemyError:
                        error = "database_update"
                if error:
                    _save_failure(db, settings, local_id, error, provider_wide, retry_after)
                else:
                    db.execute(delete(Retry).where(Retry.subscription_id == local_id))
                    db.execute(
                        update(State)
                        .execution_options(synchronize_session="fetch")
                        .where(State.provider == "dodo")
                        .values(provider_failures=0)
                    )
                if not provider_wide:
                    db.execute(
                        update(State)
                        .execution_options(synchronize_session="fetch")
                        .where(State.provider == "dodo")
                        .values(
                            next_request_at=utcnow()
                            + timedelta(seconds=settings.billing_reconcile_request_interval_seconds)
                        )
                    )
                if normal:
                    db.execute(
                        update(State)
                        .execution_options(synchronize_session="fetch")
                        .where(State.provider == "dodo")
                        .values(cursor_id=local_id)
                    )
                db.commit()  # Entitlements, retry state and cursor are one atomic outcome.
                successes += int(applied)
                if provider_wide:
                    break
    except LeaseLost:
        db.rollback()
        logger.warning("Billing reconciliation lease lost; result discarded")
    finally:
        db.rollback()
        db.execute(
            update(State)
            .execution_options(synchronize_session="fetch")
            .where(State.provider == "dodo", State.lease_owner == owner)
            .values(lease_owner=None, lease_expires_at=None)
        )
        db.commit()
    return successes


def reconciliation_status(db):
    """Operator summary with local progress only; no credentials/provider payloads."""
    state = db.get(State, "dodo")
    fields = (
        "cursor_id",
        "upper_bound_id",
        "started_at",
        "completed_at",
        "next_run_at",
        "next_request_at",
        "lease_expires_at",
        "provider_failures",
    )
    progress = {name: getattr(state, name) for name in fields} if state else None
    return {
        "progress": progress,
        "retry_count": db.scalar(select(func.count()).select_from(Retry)) or 0,
        "due_retry_count": db.scalar(
            select(func.count())
            .select_from(Retry)
            .join(Subscription)
            .where(Retry.next_attempt_at <= utcnow(), Subscription.status != "revoked")
        )
        or 0,
    }


def main():
    import argparse
    import json

    from app.core.config import get_settings
    from app.core.logging import configure_safe_logging
    from app.db import models as _models  # noqa: F401
    from app.db.session import SessionLocal

    parser = argparse.ArgumentParser(
        description="Inspect or execute a bounded billing recovery tick"
    )
    parser.add_argument("command", choices=("status", "tick"), nargs="?", default="status")
    args = parser.parse_args()
    configure_safe_logging()
    settings = get_settings()
    with SessionLocal() as db:
        if args.command == "tick":
            print(json.dumps({"reconciled": run_reconciliation(settings, db)}))
        print(
            json.dumps(
                {"enabled": bool(settings.dodo_api_key), **reconciliation_status(db)},
                default=lambda value: value.isoformat(),
                indent=2,
            )
        )


if __name__ == "__main__":
    main()
