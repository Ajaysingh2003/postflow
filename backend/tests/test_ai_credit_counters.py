from argparse import Namespace
from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest
from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError

from app.core.security import as_utc
from app.db.session import SessionLocal
from app.modules.assistant.models import AssistantRun
from app.modules.billing.credit_admin import run as operator
from app.modules.billing.credits import adjust, balance_for_update, finish_run, reserve_run, summary
from app.modules.billing.entitlements import check_assistant_usage_limit, get_plan_limits_summary
from app.modules.billing.models import (
    AICreditBalance,
    AICreditEvent,
    AICreditReservation,
    EntitlementGrant,
    Subscription,
)
from app.modules.identity.models import User
from app.modules.workspaces.models import Workspace


@pytest.fixture
def scope(client, auth):
    with SessionLocal() as db:
        user = db.scalar(select(User).where(User.email == "owner@example.com"))
        workspace = db.scalar(select(Workspace).where(Workspace.owner_user_id == user.id))
        return workspace.id, user.id


def new_run(scope):
    return AssistantRun(
        workspace_id=scope[0],
        user_id=scope[1],
        platform="x",
        feature_id="rewrite",
        status="running",
    )


def award(db, ws, amount=100, key=None, now=None):
    return adjust(
        db,
        ws,
        "grant",
        amount=amount,
        actor="operator",
        reason="Marketing gift",
        request_key=key or str(uuid4()),
        now=now,
    )


def test_numeric_counter_is_authoritative_and_reset_does_not_erase_history(scope):
    ws, user = scope
    with SessionLocal() as db:
        db.add_all(
            [
                AssistantRun(
                    workspace_id=ws,
                    user_id=user,
                    platform="x",
                    feature_id="rewrite",
                    status="succeeded",
                )
                for _ in range(20)
            ]
        )
        db.commit()
        balance = balance_for_update(db, ws)
        assert balance.monthly_used == 20
        with pytest.raises(HTTPException):
            check_assistant_usage_limit(db, ws)
        adjust(
            db, ws, "reset", actor="support", reason="Customer compensation", request_key="reset-1"
        )
        db.commit()
        assert db.scalar(select(func.count()).select_from(AssistantRun)) == 20
        assert summary(db, ws)[1] == {"used": 0, "limit": 20, "remaining": 20}
        item = new_run(scope)
        reserve_run(db, item)
        finish_run(db, item.id, ws, success=True)
        item.status = "succeeded"
        db.commit()
        assert summary(db, ws)[1]["used"] == 1
        # An operator retry must not reset usage a second time.
        adjust(
            db, ws, "reset", actor="support", reason="Retry same operation", request_key="reset-1"
        )
        assert summary(db, ws)[1]["used"] == 1


def test_monthly_credits_are_consumed_before_bonus_and_refunds_do_not_create_credits(scope):
    ws, _ = scope
    with SessionLocal() as db:
        balance = award(db, ws, 3)
        balance.monthly_used = 19
        db.commit()
        monthly = new_run(scope)
        reserve_run(db, monthly)
        bonus = new_run(scope)
        reserve_run(db, bonus)
        db.commit()
        assert db.get(AICreditReservation, monthly.id).source == "monthly"
        assert db.get(AICreditReservation, bonus.id).source == "bonus"
        assert summary(db, ws)[1] == {"used": 21, "limit": 23, "remaining": 2}
        finish_run(db, bonus.id, ws, success=False)
        finish_run(db, bonus.id, ws, success=False)
        bonus.status = "failed"
        finish_run(db, monthly.id, ws, success=True)
        monthly.status = "succeeded"
        db.commit()
        assert summary(db, ws)[1] == {"used": 20, "limit": 23, "remaining": 3}
        paid_bonus = new_run(scope)
        reserve_run(db, paid_bonus)
        finish_run(db, paid_bonus.id, ws, success=True)
        finish_run(db, paid_bonus.id, ws, success=True)
        paid_bonus.status = "succeeded"
        db.commit()
        assert summary(db, ws)[1] == {"used": 21, "limit": 23, "remaining": 2}
        assert balance.bonus_credits == 2
        assert balance.bonus_used == 1


def test_reset_preserves_inflight_reservations(scope):
    ws, _ = scope
    with SessionLocal() as db:
        balance = balance_for_update(db, ws)
        balance.monthly_used = 19
        db.commit()
        run = new_run(scope)
        reserve_run(db, run)
        adjust(db, ws, "reset", actor="support", reason="Reset used credits", request_key="reset")
        db.commit()
        assert summary(db, ws)[1]["used"] == 1
        assert balance.monthly_reserved == 1
        finish_run(db, run.id, ws, success=True)
        run.status = "succeeded"
        db.commit()
        assert balance.monthly_used == 1 and balance.monthly_reserved == 0


def test_bonus_gifts_and_plan_changes_do_not_reset_current_usage(scope):
    ws, user = scope
    with SessionLocal() as db:
        balance = award(db, ws, 25)
        balance.monthly_used = 20
        old_end = balance.cycle_end
        db.add(
            Subscription(
                workspace_id=ws,
                user_id=user,
                provider_subscription_id="upgrade",
                status="active",
                plan_code="starter",
                current_period_start=datetime.now(UTC),
            )
        )
        db.commit()
        usage = get_plan_limits_summary(db, ws)
        assert usage["ai_credits"] == {"used": 20, "limit": 1025, "remaining": 1005}
        assert as_utc(balance.cycle_end) == as_utc(old_end)
        sub = db.scalar(select(Subscription))
        sub.status = "expired"
        db.commit()
        assert summary(db, ws)[1] == {"used": 20, "limit": 45, "remaining": 25}
        check_assistant_usage_limit(db, ws)


def test_rollover_preserves_bonus_and_old_inflight_monthly_cannot_spend_new_month(scope):
    ws, _ = scope
    when = datetime(2026, 10, 31, 23, 59, tzinfo=UTC)
    with SessionLocal() as db:
        balance = award(db, ws, 15, now=when)
        monthly = new_run(scope)
        reserve_run(db, monthly, now=when)
        db.commit()
        after = when + timedelta(minutes=2)
        balance_for_update(db, ws, after)
        assert balance.monthly_reserved == balance.monthly_used == 0
        assert balance.bonus_credits == 15
        finish_run(db, monthly.id, ws, success=True, now=after)
        monthly.status = "succeeded"
        db.commit()
        assert summary(db, ws, after)[1] == {"used": 0, "limit": 35, "remaining": 35}


def test_bonus_reservations_cross_months_without_refill_or_double_spend(scope):
    ws, _ = scope
    when = datetime(2026, 10, 31, 23, 59, tzinfo=UTC)
    with SessionLocal() as db:
        balance = award(db, ws, 2, now=when)
        balance.monthly_used = 20
        db.commit()
        run = new_run(scope)
        reserve_run(db, run, now=when)
        db.commit()
        after = when + timedelta(minutes=2)
        assert summary(db, ws, after)[1]["remaining"] == 21
        assert balance.bonus_reserved == 1
        finish_run(db, run.id, ws, success=False, now=after)
        run.status = "failed"
        db.commit()
        assert summary(db, ws, after)[1]["remaining"] == 22


def test_crashed_reservations_expire_and_late_output_is_rejected(scope):
    ws, _ = scope
    now = datetime.now(UTC)
    with SessionLocal() as db:
        balance = balance_for_update(db, ws, now)
        run = new_run(scope)
        reserve_run(db, run, now=now)
        db.commit()
        later = now + timedelta(minutes=31)
        assert summary(db, ws, later)[1]["remaining"] == 20
        assert run.status == "failed"
        with pytest.raises(HTTPException, match="expired"):
            finish_run(db, run.id, ws, success=True, now=later)
        db.commit()
        assert balance.monthly_reserved == 0
        assert db.get(AICreditReservation, run.id).state == "expired"


def test_idempotent_marketing_grants_keep_auditable_actor_reason_and_reject_key_reuse(scope):
    ws, _ = scope
    with SessionLocal() as db:
        award(db, ws, 500, key="campaign-user-1")
        award(db, ws, 500, key="campaign-user-1")
        db.commit()
        assert summary(db, ws)[1]["remaining"] == 520
        event = db.scalar(
            select(AICreditEvent).where(AICreditEvent.request_key == "campaign-user-1")
        )
        assert event.actor == "operator" and event.reason == "Marketing gift"
        assert event.after["bonus_credits"] - event.before["bonus_credits"] == 500
        with pytest.raises(ValueError, match="different"):
            award(db, ws, 600, key="campaign-user-1")
        with pytest.raises(ValueError):
            adjust(
                db,
                ws,
                "reset",
                actor="support",
                reason="Other operation",
                request_key="campaign-user-1",
            )


@pytest.mark.parametrize("amount", [0, -1, True, 1.5, 1_000_001])
def test_invalid_grants_cannot_create_a_balance_or_event(scope, amount):
    with SessionLocal() as db:
        with pytest.raises(ValueError):
            award(db, scope[0], amount)
        assert db.get(AICreditBalance, scope[0]) is None


def test_database_constraints_reject_negative_or_over_reserved_balances(scope):
    with SessionLocal() as db:
        balance = award(db, scope[0], 10)
        db.commit()
        balance.bonus_reserved = 11
        with pytest.raises(IntegrityError):
            db.commit()
        db.rollback()
        balance.monthly_used = -1
        with pytest.raises(IntegrityError):
            db.commit()


def test_operator_cli_targets_one_workspace_and_has_no_public_grant_endpoint(client, auth, scope):
    args = Namespace(
        action="grant",
        workspace=scope[0],
        email=None,
        amount=42,
        actor="marketing",
        reason="Welcome campaign",
        key="welcome",
    )
    assert operator(args)["details"]["bonus_remaining"] == 42
    assert operator(args)["details"]["bonus_remaining"] == 42
    assert (
        client.post("/api/v1/billing/credits/grant", headers=auth, json={"amount": 999}).status_code
        == 404
    )
    audit = operator(Namespace(action="audit", workspace=scope[0], email=None))
    assert any(event["action"] == "grant" and event["actor"] == "marketing" for event in audit)
    other = client.post(
        "/api/v1/auth/register",
        json={"email": "other@example.com", "password": "a valid secure password", "name": "Other"},
    ).json()
    response = client.get(
        "/api/v1/billing/usage",
        headers={"Authorization": f"Bearer {other['access_token']}", "X-Workspace-ID": scope[0]},
    )
    assert response.status_code == 403


def test_monthly_override_and_gift_are_separate_and_manual_limit_survives_sync(scope):
    from app.modules.billing.entitlements import sync_entitlements

    ws, _ = scope
    with SessionLocal() as db:
        db.add(
            EntitlementGrant(
                workspace_id=ws, capability="ai_credits", limit_value=50, source="manual"
            )
        )
        db.commit()
        award(db, ws, 30)
        sync_entitlements(db, ws, "free")
        db.commit()
        assert summary(db, ws)[1] == {"used": 0, "limit": 80, "remaining": 80}


def test_counter_checks_do_not_recount_history_after_initialization(scope, monkeypatch):
    from sqlalchemy import event

    ws, _ = scope
    with SessionLocal() as db:
        balance_for_update(db, ws)
        db.commit()
        statements = []

        def capture(conn, cursor, statement, parameters, context, executemany):
            statements.append(statement)

        event.listen(db.bind, "before_cursor_execute", capture)
        try:
            check_assistant_usage_limit(db, ws)
        finally:
            event.remove(db.bind, "before_cursor_execute", capture)
        assert not any(
            "count(" in sql.lower() and "assistant_runs" in sql.lower() for sql in statements
        )


def test_postgres_concurrent_last_credit_grants_and_resets(scope):
    from concurrent.futures import ThreadPoolExecutor

    ws, _ = scope
    with SessionLocal() as db:
        if db.bind.dialect.name != "postgresql":
            pytest.skip("PostgreSQL row-lock concurrency test")
        balance = balance_for_update(db, ws)
        balance.monthly_used = 19
        db.commit()

    def reserve(_):
        with SessionLocal() as db:
            run = new_run(scope)
            try:
                reserve_run(db, run)
                db.commit()
                return 200
            except HTTPException:
                db.rollback()
                return 403

    with ThreadPoolExecutor(max_workers=4) as pool:
        assert sorted(pool.map(reserve, range(4))) == [200, 403, 403, 403]

    def gift(_):
        with SessionLocal() as db:
            award(db, ws, 500, key="concurrent-gift")
            db.commit()

    with ThreadPoolExecutor(max_workers=4) as pool:
        list(pool.map(gift, range(4)))
    with SessionLocal() as db:
        assert db.get(AICreditBalance, ws).bonus_credits == 500
        assert (
            db.scalar(
                select(func.count())
                .select_from(AICreditEvent)
                .where(AICreditEvent.request_key == "concurrent-gift")
            )
            == 1
        )


@pytest.mark.anyio
async def test_all_generation_uses_bonus_wallet_and_failure_returns_the_bonus(scope):
    from app.modules.assistant.base import LLMResponse
    from app.modules.assistant.service import execute_feature

    ws, user = scope

    class LLM:
        fail = False

        async def generate_structured(self, messages, response_model):
            if self.fail:
                raise ValueError("provider failed")
            return response_model(rewritten_text="A useful short post"), LLMResponse(
                content="", total_tokens=5
            )

    llm = LLM()
    with SessionLocal() as db:
        balance = award(db, ws, 1)
        balance.monthly_used = 20
        db.commit()
        kwargs = {
            "workspace_id": ws,
            "user_id": user,
            "feature_id": "rewrite_with_tone",
            "input_data": {"text": "An idea", "tone": "Clear"},
            "platform": "x",
            "db": db,
            "llm": llm,
        }
        llm.fail = True
        with pytest.raises(ValueError, match="provider failed"):
            await execute_feature(**kwargs)
        assert summary(db, ws)[2]["bonus_remaining"] == 1
        llm.fail = False
        await execute_feature(**kwargs)
        assert summary(db, ws)[2]["bonus_remaining"] == 0
        with pytest.raises(HTTPException):
            await execute_feature(**kwargs)


@pytest.mark.anyio
async def test_final_commit_failure_refunds_without_losing_provider_cost_or_double_charging(
    scope, monkeypatch
):
    from app.modules.assistant.base import LLMResponse
    from app.modules.assistant.service import execute_feature
    from app.modules.billing.models import UsageLedger

    ws, user = scope

    class LLM:
        async def generate_structured(self, messages, response_model):
            return response_model(rewritten_text="A useful post"), LLMResponse(
                content="", total_tokens=8
            )

    with SessionLocal() as db:
        original = db.commit
        commits = {"n": 0}

        def commit():
            commits["n"] += 1
            if commits["n"] == 2:
                raise RuntimeError("database disconnected before commit")
            return original()

        monkeypatch.setattr(db, "commit", commit)
        with pytest.raises(RuntimeError, match="disconnected"):
            await execute_feature(
                ws,
                user,
                "rewrite_with_tone",
                {"text": "Idea", "tone": "Clear"},
                platform="x",
                db=db,
                llm=LLM(),
            )
        assert summary(db, ws)[1] == {"used": 0, "limit": 20, "remaining": 20}
        assert (
            db.scalar(select(UsageLedger.amount).where(UsageLedger.kind == "assistant_tokens")) == 8
        )
        assert db.scalar(select(AssistantRun.status)) == "failed"


def test_operator_command_starts_in_a_fresh_process(scope):
    import json
    import subprocess
    import sys

    result = subprocess.run(
        [
            sys.executable,
            "-m",
            "app.modules.billing.credit_admin",
            "balance",
            "--workspace",
            scope[0],
        ],
        capture_output=True,
        text=True,
        timeout=20,
        check=False,
    )
    assert result.returncode == 0, result.stderr
    assert json.loads(result.stdout)["ai_credits"] == {"used": 0, "limit": 20, "remaining": 20}


def test_operator_backfill_keeps_existing_manual_resets_and_bonus_balances(scope):
    ws, _ = scope
    with SessionLocal() as db:
        award(db, ws, 200)
        db.commit()
    result = operator(Namespace(action="backfill"))
    assert result["initialized_or_refreshed"] == 1
    with SessionLocal() as db:
        assert summary(db, ws)[1] == {"used": 0, "limit": 220, "remaining": 220}


def test_scheduler_recovery_releases_crashed_requests_without_waiting_for_a_customer_read(scope):
    from app.modules.billing.credits import recover_expired

    ws, _ = scope
    with SessionLocal() as db:
        item = new_run(scope)
        reserve_run(db, item)
        db.commit()
        reservation = db.get(AICreditReservation, item.id)
        reservation.expires_at = datetime.now(UTC) - timedelta(seconds=1)
        db.commit()
        assert recover_expired(db) == 1
        assert db.get(AICreditBalance, ws).monthly_reserved == 0
        assert db.get(AssistantRun, item.id).status == "failed"
        assert recover_expired(db) == 0
