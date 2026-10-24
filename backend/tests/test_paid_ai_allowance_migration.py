import importlib.util
from datetime import UTC, datetime, timedelta

import pytest
from alembic.migration import MigrationContext
from alembic.operations import Operations
from sqlalchemy import select

from app.db.session import SessionLocal
from app.modules.billing.credits import balance_for_update
from app.modules.billing.entitlements import entitlement_limit, plan_limits
from app.modules.billing.models import AICreditBalance, EntitlementGrant, Plan, Subscription


def run_migration(connection):
    spec = importlib.util.spec_from_file_location(
        "paid_ai_allowance_migration", "migrations/versions/20261024_paid_ai_allowances.py"
    )
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    module.op = Operations(MigrationContext.configure(connection))
    module.upgrade()


@pytest.mark.parametrize(
    "code,expected",
    [("starter", 300), ("creator", 300), ("pro", 2000), ("business", 5000), ("agency", 5000)],
)
@pytest.mark.parametrize("manual", [False, True])
def test_allowance_migration_changes_effective_limits_without_refilling_credits(
    client, auth, code, expected, manual
):
    post = client.post("/api/v1/posts", headers=auth, json={"base_text": "Draft"}).json()
    ws, user = post["workspace_id"], post["author_id"]
    now = datetime.now(UTC)
    with SessionLocal.begin() as db:
        for plan_code in ("free", code, "custom"):
            plan = db.scalar(select(Plan).where(Plan.code == plan_code))
            if plan is None:
                plan = Plan(code=plan_code, name=plan_code, active=True)
                db.add(plan)
            plan.limits = {"ai_credits": 9000, "brand_profiles": 7, "connected_accounts": 12}
        # The most recent subscription wins, including an identical timestamp.
        for subscription_id, plan_code in [("a", "pro"), ("b", code)]:
            db.add(
                Subscription(
                    id=subscription_id,
                    workspace_id=ws,
                    user_id=user,
                    provider_subscription_id=subscription_id,
                    plan_code=plan_code,
                    status="active",
                    current_period_start=now - timedelta(days=1),
                    current_period_end=now + timedelta(days=29),
                    created_at=now,
                )
            )
        db.add_all(
            [
                EntitlementGrant(
                    workspace_id=ws,
                    capability="ai_credits",
                    source="manual" if manual else "plan",
                    limit_value=9000,
                ),
                EntitlementGrant(
                    workspace_id=ws, capability="seats", source="plan", limit_value=17
                ),
            ]
        )
        db.flush()
        balance = balance_for_update(db, ws, now)
        balance.monthly_used, balance.monthly_reserved = 400, 1
        balance.bonus_credits, balance.bonus_reserved, balance.bonus_used = 50, 1, 2
    with SessionLocal.begin() as db:
        before = dict(db.execute(select(AICreditBalance.__table__)).mappings().one())
        run_migration(db.connection())
        run_migration(db.connection())  # A repeated operation must not refill anything.
        db.expire_all()
        assert entitlement_limit(db, ws, "ai_credits") == (9000 if manual else expected)
        assert (
            db.scalar(
                select(EntitlementGrant.limit_value).where(
                    EntitlementGrant.workspace_id == ws, EntitlementGrant.capability == "seats"
                )
            )
            == 17
        )
        plan = db.scalar(select(Plan).where(Plan.code == code))
        assert plan.limits == {
            "ai_credits": expected,
            "brand_profiles": 7,
            "connected_accounts": 12,
        }
        if code in {"starter", "pro", "business"}:
            assert plan_limits(code)["ai_credits"] == expected
        for untouched in ("free", "custom"):
            assert (
                db.scalar(select(Plan).where(Plan.code == untouched)).limits["ai_credits"] == 9000
            )
        assert dict(db.execute(select(AICreditBalance.__table__)).mappings().one()) == before


def test_allowance_migration_accepts_empty_catalog_without_creating_plans():
    with SessionLocal.begin() as db:
        run_migration(db.connection())
        assert list(db.scalars(select(Plan))) == []
