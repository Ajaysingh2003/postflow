from datetime import UTC, datetime, timedelta
from email.utils import format_datetime

import httpx
import pytest
from sqlalchemy import func, select
from sqlalchemy.exc import SQLAlchemyError

from app.core.config import Settings
from app.core.security import as_utc
from app.db.session import SessionLocal
from app.modules.billing import reconciliation as job
from app.modules.billing.entitlements import effective_plan, entitlement_limit
from app.modules.billing.models import BillingReconciliationRetry as Retry
from app.modules.billing.models import BillingReconciliationState as State
from app.modules.billing.models import Subscription
from app.modules.billing.service import reconcile_subscriptions


class Clock:
    def __init__(self):
        self.now = datetime(2026, 10, 15, 12, tzinfo=UTC)
        self.elapsed = 0.0
        self.sleeps = []

    def advance(self, seconds):
        self.now += timedelta(seconds=seconds)
        self.elapsed += seconds

    def sleep(self, seconds):
        self.sleeps.append(seconds)
        self.advance(seconds)


@pytest.fixture
def setup(client, auth, monkeypatch):
    me = client.get("/api/v1/auth/me", headers=auth).json()
    clock = Clock()
    monkeypatch.setattr(job, "utcnow", lambda: clock.now)
    monkeypatch.setattr(job, "monotonic", lambda: clock.elapsed)
    monkeypatch.setattr(job, "sleep", clock.sleep)
    monkeypatch.setattr(job.random, "uniform", lambda *args: 0)
    settings = Settings(
        _env_file=None,
        app_env="test",
        dodo_api_key="test-only-key",
        billing_reconcile_request_interval_seconds=0,
        billing_reconcile_batch_size=7,
        billing_reconcile_max_requests=23,
    )
    calls = []

    def retrieve(settings, provider_id, **kwargs):
        calls.append(provider_id)
        return remote(provider_id)

    monkeypatch.setattr(job, "retrieve_subscription", retrieve)
    return me, settings, clock, calls


def remote(provider_id, **extra):
    return {
        "subscription_id": provider_id,
        "status": "active",
        "quantity": 1,
        "cancel_at_next_billing_date": False,
        "next_billing_date": "2026-11-15T12:00:00Z",
        "previous_billing_date": "2026-10-15T12:00:00Z",
        **extra,
    }


def seed(setup, count, start=1):
    me, _, clock, _ = setup
    with SessionLocal.begin() as db:
        for index in range(start, start + count):
            db.add(
                Subscription(
                    id=f"{index:08d}-0000-4000-8000-000000000000",
                    user_id=me["id"],
                    workspace_id=me["workspace_id"],
                    provider_subscription_id=f"sub_{index}",
                    plan_code="starter",
                    status="active",
                    created_at=clock.now - timedelta(days=1) + timedelta(seconds=index),
                    updated_at=clock.now - timedelta(hours=1),
                )
            )


def tick(setup):
    with SessionLocal() as db:
        return reconcile_subscriptions(setup[1], db)


def test_all_451_subscriptions_are_checked_in_bounded_ticks_across_session_restarts(setup):
    seed(setup, 451)
    successes = 0
    for _ in range(30):
        count = tick(setup)
        assert count <= 23
        successes += count
        with SessionLocal() as db:
            state = db.get(State, "dodo")
            if state.completed_at:
                break
    assert successes == 451
    assert len(setup[3]) == len(set(setup[3])) == 451
    with SessionLocal() as db:
        assert (
            db.scalar(
                select(func.count())
                .select_from(Subscription)
                .where(Subscription.last_reconciled_at.is_not(None))
            )
            == 451
        )
        assert db.get(State, "dodo").upper_bound_id is None
    assert tick(setup) == 0


def test_keyset_survives_deleted_cursor_and_defers_new_ids_outside_pass_to_next_cycle(setup):
    seed(setup, 5, start=10)
    setup[1].billing_reconcile_max_requests = 2
    assert tick(setup) == 2
    with SessionLocal.begin() as db:
        db.delete(db.get(Subscription, "00000011-0000-4000-8000-000000000000"))
    seed(setup, 1, start=1)
    seed(setup, 1, start=99)
    for _ in range(3):
        tick(setup)
    assert set(setup[3]) == {f"sub_{i}" for i in range(10, 15)}
    setup[2].advance(3601)
    for _ in range(4):
        tick(setup)
    assert "sub_1" in setup[3] and "sub_99" in setup[3]


def test_one_malformed_record_keeps_old_access_and_does_not_block_other_subscriptions(
    setup, monkeypatch
):
    seed(setup, 3)

    def retrieve(settings, provider_id, **kwargs):
        setup[3].append(provider_id)
        return (
            {"status": "expired", "quantity": "SECRET invalid"}
            if provider_id == "sub_1"
            else remote(provider_id)
        )

    monkeypatch.setattr(job, "retrieve_subscription", retrieve)
    assert tick(setup) == 2
    with SessionLocal() as db:
        failed = db.get(Subscription, "00000001-0000-4000-8000-000000000000")
        retry = db.get(Retry, failed.id)
        assert failed.status == "active" and failed.last_reconciled_at is None
        assert retry.error_code == "invalid_response" and retry.attempts == 1
        assert as_utc(retry.next_attempt_at) == setup[2].now + timedelta(seconds=60)
    assert tick(setup) == 0
    monkeypatch.setattr(job, "retrieve_subscription", lambda s, p, **kw: remote(p))
    setup[2].advance(61)
    assert tick(setup) == 1  # Retry happens before the next hourly full pass.
    with SessionLocal() as db:
        assert db.scalar(select(Retry)) is None


@pytest.mark.parametrize("status,header", [(429, "120"), (503, "120"), (429, "date"), (401, "120")])
def test_provider_backoff_is_shared_persisted_and_respects_retry_after(
    setup, monkeypatch, status, header
):
    seed(setup, 3)
    calls = []
    value = (
        format_datetime(setup[2].now + timedelta(seconds=120), usegmt=True)
        if header == "date"
        else header
    )

    def limited(settings, provider_id, **kwargs):
        calls.append(provider_id)
        request = httpx.Request("GET", "https://provider.test/subscriptions/id")
        response = httpx.Response(status, headers={"retry-after": value}, request=request)
        raise httpx.HTTPStatusError("SECRET provider details", request=request, response=response)

    monkeypatch.setattr(job, "retrieve_subscription", limited)
    assert tick(setup) == 0 and len(calls) == 1
    assert tick(setup) == 0 and len(calls) == 1
    with SessionLocal() as db:
        state = db.get(State, "dodo")
        delay = (as_utc(state.next_request_at) - setup[2].now).total_seconds()
        assert delay >= (3600 if status == 401 else 120)
        assert state.cursor_id == "00000001-0000-4000-8000-000000000000"
        assert db.scalar(select(Retry)).error_code == f"provider_{status}"
    setup[2].advance(delay + 1)
    monkeypatch.setattr(job, "retrieve_subscription", lambda s, p, **kw: remote(p))
    assert tick(setup) == 3


def test_network_failure_pauses_provider_and_preserves_local_entitlements(setup, monkeypatch):
    seed(setup, 1)

    def timeout(*args, **kwargs):
        raise httpx.ReadTimeout("private infrastructure")

    monkeypatch.setattr(job, "retrieve_subscription", timeout)
    assert tick(setup) == 0
    with SessionLocal() as db:
        assert db.scalar(select(Retry)).error_code == "provider_network"
        assert effective_plan(db, setup[0]["workspace_id"]) == "starter"


def test_retry_attempts_back_off_without_holding_other_records_or_hourly_schedule(
    setup, monkeypatch
):
    seed(setup, 2)
    monkeypatch.setattr(
        job,
        "retrieve_subscription",
        lambda s, p, **kw: remote(p, quantity=0) if p == "sub_1" else remote(p),
    )
    assert tick(setup) == 1
    for attempt, seconds in ((2, 120), (3, 240)):
        with SessionLocal() as db:
            due = as_utc(db.scalar(select(Retry)).next_attempt_at)
        setup[2].advance((due - setup[2].now).total_seconds() + 1)
        assert tick(setup) == 0
        with SessionLocal() as db:
            retry = db.scalar(select(Retry))
            assert retry.attempts == attempt
            assert as_utc(retry.next_attempt_at) == setup[2].now + timedelta(seconds=seconds)


def test_pacing_and_time_budget_yield_without_long_sleep(setup):
    seed(setup, 5)
    setup[1].billing_reconcile_request_interval_seconds = 2
    setup[1].billing_reconcile_time_budget_seconds = 3
    assert tick(setup) == 2
    assert setup[2].sleeps == [2]
    assert setup[2].elapsed < 3
    setup[2].advance(2)
    assert tick(setup) == 2


def test_second_scheduler_cannot_run_while_first_holds_a_lease(setup, monkeypatch):
    seed(setup, 1)

    def concurrent(settings, provider_id, **kwargs):
        with SessionLocal() as other:
            assert reconcile_subscriptions(settings, other) == 0
        return remote(provider_id)

    monkeypatch.setattr(job, "retrieve_subscription", concurrent)
    assert tick(setup) == 1


def test_expired_crash_lease_resumes_from_committed_cursor(setup):
    seed(setup, 3)
    setup[1].billing_reconcile_max_requests = 1
    assert tick(setup) == 1
    with SessionLocal.begin() as db:
        state = db.get(State, "dodo")
        state.lease_owner = "crashed-scheduler"
        state.lease_expires_at = setup[2].now + timedelta(seconds=90)
    assert tick(setup) == 0
    setup[2].advance(91)
    assert tick(setup) == 1
    assert setup[3] == ["sub_1", "sub_2"]


def test_lost_lease_cannot_apply_result_or_clear_new_owners_lease(setup, monkeypatch):
    seed(setup, 1)

    def stolen(settings, provider_id, **kwargs):
        with SessionLocal.begin() as db:
            state = db.get(State, "dodo")
            state.lease_owner = "new-owner"
            state.lease_expires_at = setup[2].now + timedelta(minutes=5)
        return remote(provider_id, status="expired")

    monkeypatch.setattr(job, "retrieve_subscription", stolen)
    assert tick(setup) == 0
    with SessionLocal() as db:
        assert db.get(State, "dodo").lease_owner == "new-owner"
        assert db.scalar(select(Subscription)).status == "active"


def test_new_webhook_during_http_wins_over_stale_snapshot(setup, monkeypatch):
    seed(setup, 1)

    def webhook(settings, provider_id, **kwargs):
        with SessionLocal.begin() as db:
            row = db.scalar(select(Subscription))
            row.status = "cancelled"
            row.quantity = 4
            row.updated_at = setup[2].now + timedelta(seconds=1)
        return remote(provider_id)

    monkeypatch.setattr(job, "retrieve_subscription", webhook)
    assert tick(setup) == 0
    with SessionLocal() as db:
        row = db.scalar(select(Subscription))
        assert row.status == "cancelled" and row.quantity == 4
        assert db.scalar(select(Retry)).error_code == "stale_or_unknown_product"


def test_reconciling_older_subscription_never_overrides_current_workspace_plan(setup, monkeypatch):
    seed(setup, 2)
    with SessionLocal.begin() as db:
        db.get(Subscription, "00000002-0000-4000-8000-000000000000").plan_code = "pro"
    monkeypatch.setattr(
        job,
        "retrieve_subscription",
        lambda s, p, **kw: remote(p, status="expired") if p == "sub_1" else remote(p),
    )
    assert tick(setup) == 2
    with SessionLocal() as db:
        assert effective_plan(db, setup[0]["workspace_id"]) == "pro"
        assert entitlement_limit(db, setup[0]["workspace_id"], "ai_credits") == 1000
        assert entitlement_limit(db, setup[0]["workspace_id"], "scheduled_posts") is None


def test_expiry_and_hold_grace_are_applied_without_extending_grace_on_every_check(
    setup, monkeypatch
):
    seed(setup, 1)
    monkeypatch.setattr(
        job, "retrieve_subscription", lambda s, p, **kw: remote(p, status="on_hold")
    )
    assert tick(setup) == 1
    with SessionLocal() as db:
        grace = as_utc(db.scalar(select(Subscription)).grace_until)
    setup[2].advance(3601)
    assert tick(setup) == 1
    with SessionLocal() as db:
        assert as_utc(db.scalar(select(Subscription)).grace_until) == grace
    setup[2].advance(3601)
    monkeypatch.setattr(
        job, "retrieve_subscription", lambda s, p, **kw: remote(p, status="expired")
    )
    assert tick(setup) == 1
    with SessionLocal() as db:
        assert effective_plan(db, setup[0]["workspace_id"]) == "free"
        assert entitlement_limit(db, setup[0]["workspace_id"], "scheduled_posts") == 5


def test_database_failure_rolls_back_business_changes_but_saves_retry_and_keeps_scanning(
    setup, monkeypatch
):
    seed(setup, 2)
    actual = job.sync_entitlements
    calls = []

    def failure_once(*args):
        calls.append(1)
        if len(calls) == 1:
            raise SQLAlchemyError("private database details")
        return actual(*args)

    monkeypatch.setattr(job, "sync_entitlements", failure_once)
    monkeypatch.setattr(
        job, "retrieve_subscription", lambda s, p, **kw: remote(p, status="expired")
    )
    assert tick(setup) == 1
    with SessionLocal() as db:
        assert db.get(Subscription, "00000001-0000-4000-8000-000000000000").status == "active"
        assert db.scalar(select(Retry)).error_code == "database_update"


def test_disabled_billing_is_a_noop_and_retry_after_parser_is_bounded(setup):
    setup[1].dodo_api_key = None
    assert tick(setup) == 0
    with SessionLocal() as db:
        assert db.get(State, "dodo") is None
    now = setup[2].now
    assert job.retry_after_seconds({"retry-after-ms": "1500"}, now) == 1.5
    for value in ("garbage", "NaN", "Infinity", "9999999999999999999", "-1"):
        assert job.retry_after_seconds({"retry-after": value}, now) == 0


def test_official_http_lookup_uses_one_request_with_timeout_and_provider_rate_headers(
    setup, monkeypatch
):
    from app.modules.billing.service import retrieve_subscription

    seed(setup, 1)
    captured = []
    actual_client = httpx.Client

    def handler(request):
        captured.append(request)
        assert request.method == "GET" and request.url.path == "/subscriptions/sub_1"
        assert request.headers["authorization"] == "Bearer test-only-key"
        assert request.extensions["timeout"]["read"] == 10
        return httpx.Response(429, headers={"retry-after-ms": "120000"}, json={"error": "PRIVATE"})

    monkeypatch.setattr(job, "retrieve_subscription", retrieve_subscription)
    monkeypatch.setattr(
        job.httpx,
        "Client",
        lambda **options: actual_client(transport=httpx.MockTransport(handler), **options),
    )
    assert tick(setup) == 0
    assert len(captured) == 1
    with SessionLocal() as db:
        assert as_utc(db.get(State, "dodo").next_request_at) == setup[2].now + timedelta(
            seconds=120
        )


def test_provider_product_changes_update_plan_and_unknown_products_preserve_last_valid_state(
    setup, monkeypatch
):
    seed(setup, 1)
    setup[1].dodo_product_starter = "pdt_starter"
    setup[1].dodo_product_pro = "pdt_pro"
    monkeypatch.setattr(
        job, "retrieve_subscription", lambda s, p, **kw: remote(p, product_id="pdt_pro")
    )
    assert tick(setup) == 1
    with SessionLocal() as db:
        assert effective_plan(db, setup[0]["workspace_id"]) == "pro"
    setup[2].advance(3601)
    monkeypatch.setattr(
        job, "retrieve_subscription", lambda s, p, **kw: remote(p, product_id="unknown-product")
    )
    assert tick(setup) == 0
    with SessionLocal() as db:
        assert effective_plan(db, setup[0]["workspace_id"]) == "pro"
        assert db.scalar(select(Retry)).error_code == "stale_or_unknown_product"
    setup[2].advance(61)
    monkeypatch.setattr(
        job,
        "retrieve_subscription",
        lambda s, p, **kw: remote(p, status="expired", product_id="unknown-product"),
    )
    assert tick(setup) == 1
    with SessionLocal() as db:
        assert effective_plan(db, setup[0]["workspace_id"]) == "free"


def test_identity_mismatch_and_revocation_during_fetch_cannot_grant_access(setup, monkeypatch):
    seed(setup, 1)
    monkeypatch.setattr(
        job, "retrieve_subscription", lambda s, p, **kw: remote("different-subscription")
    )
    assert tick(setup) == 0
    with SessionLocal() as db:
        assert db.scalar(select(Retry)).error_code == "identity_mismatch"
    setup[2].advance(61)

    def revoked(settings, provider_id, **kwargs):
        with SessionLocal.begin() as db:
            db.scalar(select(Subscription)).status = "revoked"
        return remote(provider_id)

    monkeypatch.setattr(job, "retrieve_subscription", revoked)
    assert tick(setup) == 0
    with SessionLocal() as db:
        assert effective_plan(db, setup[0]["workspace_id"]) == "free"
        assert db.scalar(select(Retry)) is None


def test_old_subscription_webhooks_and_refunds_cannot_downgrade_newer_plan(setup, client):
    from test_webhook_security import _post_signed

    seed(setup, 2)
    with SessionLocal.begin() as db:
        db.get(Subscription, "00000002-0000-4000-8000-000000000000").plan_code = "pro"
    me = setup[0]
    payload = {
        "type": "subscription.expired",
        "data": {
            "subscription_id": "sub_1",
            "metadata": {"user_id": me["id"], "workspace_id": me["workspace_id"]},
        },
    }
    assert _post_signed(client, payload, "old-subscription-expired").status_code == 204
    refund = {"type": "refund.succeeded", "data": {"subscription_id": "sub_1"}}
    assert _post_signed(client, refund, "old-subscription-refund").status_code == 204
    with SessionLocal() as db:
        assert effective_plan(db, me["workspace_id"]) == "pro"
        assert entitlement_limit(db, me["workspace_id"], "ai_credits") == 1000


def test_tick_can_be_interrupted_mid_lookup_without_advancing_unfinished_cursor(setup, monkeypatch):
    seed(setup, 3)
    actual = job.retrieve_subscription

    def interrupted(settings, provider_id, **kwargs):
        if provider_id == "sub_2":
            raise KeyboardInterrupt
        return actual(settings, provider_id, **kwargs)

    monkeypatch.setattr(job, "retrieve_subscription", interrupted)
    with pytest.raises(KeyboardInterrupt):
        tick(setup)
    with SessionLocal() as db:
        assert db.get(State, "dodo").cursor_id == "00000001-0000-4000-8000-000000000000"
    monkeypatch.setattr(job, "retrieve_subscription", actual)
    assert tick(setup) == 2


def test_operator_summary_exposes_progress_and_retry_counts_without_provider_secrets(
    setup, monkeypatch
):
    seed(setup, 1)
    monkeypatch.setattr(job, "retrieve_subscription", lambda s, p, **kw: {})
    assert tick(setup) == 0
    with SessionLocal() as db:
        summary = job.reconciliation_status(db)
        assert summary["retry_count"] == 1 and summary["due_retry_count"] == 0
        assert "test-only-key" not in str(summary)
        assert summary["progress"]["lease_expires_at"] is None
