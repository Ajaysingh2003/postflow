import asyncio
from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi import HTTPException
from sqlalchemy import select

from app.db.session import SessionLocal
from app.modules.assistant.base import LLMResponse
from app.modules.assistant.llm_client import LLMGenerationError
from app.modules.assistant.models import AssistantRun
from app.modules.assistant.service import execute_feature
from app.modules.billing.entitlements import (
    check_assistant_usage_limit,
    check_scheduled_posts_limit,
    entitlement_limit,
    get_plan_limits_summary,
    sync_entitlements,
    usage_window,
)
from app.modules.billing.models import EntitlementGrant, Plan, Subscription, UsageLedger
from app.modules.channels.base import Capabilities, PublishResult
from app.modules.channels.models import ConnectedAccount
from app.modules.channels.registry import channel_registry
from app.modules.content.models import Post, PostVariant
from app.modules.publishing.service import publish_variant_job, schedule_variant
from app.modules.workspaces.models import WorkspaceMembership


@pytest.fixture
def workspace(client, auth):
    post = client.post("/api/v1/posts", headers=auth, json={"base_text": "An idea"}).json()
    return post["workspace_id"], post["author_id"]


@pytest.mark.parametrize(
    "now,start,end",
    [
        ("2024-02-29T09:59:00", "2024-01-31T10:00:00", "2024-02-29T10:00:00"),
        ("2024-02-29T10:00:00", "2024-02-29T10:00:00", "2024-03-31T10:00:00"),
        ("2024-04-30T12:00:00", "2024-04-30T10:00:00", "2024-05-31T10:00:00"),
        ("2024-12-31T10:00:00", "2024-12-31T10:00:00", "2025-01-31T10:00:00"),
    ],
)
def test_annual_plan_resets_monthly_without_billing_day_drift(now, start, end):
    sub = SimpleNamespace(
        status="active", current_period_start=datetime(2024, 1, 31, 10, tzinfo=UTC)
    )
    parse = lambda value: datetime.fromisoformat(value).replace(tzinfo=UTC)
    assert usage_window(sub, parse(now)) == (parse(start), parse(end))
    assert usage_window(None, parse(now))[0].day == 1


def test_billing_and_home_share_live_usage_and_require_workspace_membership(
    client, auth, workspace
):
    ws, user = workspace
    now = datetime.now(UTC)
    with SessionLocal.begin() as db:
        db.add_all(
            [
                AssistantRun(
                    workspace_id=ws,
                    user_id=user,
                    platform="x",
                    feature_id="rewrite",
                    status=status,
                    created_at=now - age,
                )
                for status, age in [
                    ("failed", timedelta()),
                    ("succeeded", timedelta()),
                    ("running", timedelta(minutes=1)),
                    ("running", timedelta(hours=1)),
                    ("cancelled", timedelta()),
                ]
            ]
        )
        db.add(
            ConnectedAccount(
                workspace_id=ws,
                platform="x",
                external_account_id="x",
                display_name="Needs reconnecting",
                status="needs_reauth",
            )
        )
    usage = client.get("/api/v1/billing/usage", headers=auth)
    assert usage.status_code == 200
    assert usage.headers["cache-control"] == "private, no-store"
    body = usage.json()
    assert body["can_manage_billing"] and body["subscription"] is None
    assert body["usage"]["ai_credits"] == {"used": 2, "limit": 20, "remaining": 18}
    assert body["usage"]["connected_accounts"]["used"] == 1
    home = client.get("/api/v1/posts/home", headers=auth).json()
    assert home["usage"] == body["usage"]
    assert client.get("/api/v1/billing/usage").status_code == 401
    assert (
        client.get(
            "/api/v1/billing/usage", headers={**auth, "X-Workspace-ID": str(uuid4())}
        ).status_code
        == 403
    )
    other = client.post(
        "/api/v1/auth/register",
        json={
            "email": "usage-viewer@example.com",
            "password": "another secure password",
            "name": "Viewer",
        },
    ).json()
    with SessionLocal.begin() as db:
        from app.modules.identity.models import User

        viewer = db.scalar(select(User).where(User.email == "usage-viewer@example.com"))
        db.add(WorkspaceMembership(workspace_id=ws, user_id=viewer.id, role="viewer"))
    headers = {"Authorization": f"Bearer {other['access_token']}", "X-Workspace-ID": ws}
    assert (
        client.get("/api/v1/billing/usage", headers=headers).json()["can_manage_billing"] is False
    )
    assert client.post("/api/v1/billing/portal", headers=headers).status_code == 403


@pytest.mark.anyio
@pytest.mark.parametrize("failure", ["provider", "validation", "cancelled"])
async def test_failed_ai_releases_credit_but_preserves_actual_provider_usage(workspace, failure):
    ws, user = workspace

    class FailingLLM:
        async def generate_structured(self, messages, response_model):
            if failure == "cancelled":
                raise asyncio.CancelledError()
            if failure == "provider":
                raise LLMGenerationError(77)
            return response_model(rewritten_text="x" * 400), LLMResponse(
                content="", total_tokens=77
            )

    class SuccessLLM:
        async def generate_structured(self, messages, response_model):
            return response_model(rewritten_text="A useful idea"), LLMResponse(
                content="", total_tokens=9
            )

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
                for _ in range(19)
            ]
        )
        db.commit()
        kwargs = {
            "workspace_id": ws,
            "user_id": user,
            "feature_id": "rewrite_with_tone",
            "input_data": {"text": "Hello", "tone": "Clear"},
            "platform": "x",
            "db": db,
        }
        with pytest.raises((ValueError, HTTPException, asyncio.CancelledError)):
            await execute_feature(**kwargs, llm=FailingLLM())
        summary = get_plan_limits_summary(db, ws)
        assert summary["ai_credits"]["remaining"] == 1
        failed = db.scalar(select(AssistantRun).where(AssistantRun.status == "failed"))
        assert failed is not None
        if failure != "cancelled":
            assert failed.tokens_used == 77
            assert db.scalar(select(UsageLedger)).amount == 77
        await execute_feature(**kwargs, llm=SuccessLLM())
        assert get_plan_limits_summary(db, ws)["ai_credits"]["remaining"] == 0
        with pytest.raises(HTTPException):
            check_assistant_usage_limit(db, ws)


@pytest.mark.anyio
async def test_post_allowance_counts_one_post_across_channels_and_reschedule_cannot_bypass(
    workspace,
):
    ws, user = workspace
    now = datetime.now(UTC)
    with SessionLocal() as db:
        variants = []
        for _ in range(5):
            post = Post(workspace_id=ws, author_id=user)
            db.add(post)
            db.flush()
            pair = [
                PostVariant(
                    post_id=post.id,
                    platform=p,
                    status="draft",
                    payload={"text": "Hello"},
                    idempotency_key=str(uuid4()),
                )
                for p in ("x", "threads")
            ]
            db.add_all(pair)
            variants.extend(pair)
        db.commit()
        for variant in variants:
            await schedule_variant(db, variant.id, now, bypass_validation=True)
        assert get_plan_limits_summary(db, ws)["scheduled_posts"]["used"] == 5
        check_scheduled_posts_limit(db, ws, variants[0].post_id)
        with pytest.raises(HTTPException):
            check_scheduled_posts_limit(db, ws)
        # A scheduled post moving into a month already full of other posts must fail.
        other_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0) - timedelta(
            days=1
        )
        for _ in range(5):
            post = Post(workspace_id=ws, author_id=user)
            db.add(post)
            db.flush()
            db.add(
                PostVariant(
                    post_id=post.id,
                    platform="x",
                    status="scheduled",
                    scheduled_time=other_month,
                    idempotency_key=str(uuid4()),
                )
            )
        db.commit()
        with pytest.raises(HTTPException):
            await schedule_variant(db, variants[0].id, other_month, bypass_validation=True)


def test_expired_subscription_does_not_keep_paid_entitlements(workspace):
    ws, user = workspace
    with SessionLocal() as db:
        db.add(
            Subscription(
                workspace_id=ws,
                user_id=user,
                provider_subscription_id="expired",
                plan_code="pro",
                status="cancelled",
                current_period_start=datetime.now(UTC) - timedelta(days=60),
                current_period_end=datetime.now(UTC) - timedelta(days=1),
            )
        )
        sync_entitlements(db, ws, "pro")
        db.commit()
        assert entitlement_limit(db, ws, "ai_credits") == 20
        summary = get_plan_limits_summary(db, ws)
        assert summary["plan_code"] == "free"
        assert summary["ai_credits"]["limit"] == 20


def test_running_request_reserves_last_credit_until_failure(workspace):
    ws, user = workspace
    with SessionLocal() as db:
        rows = [
            AssistantRun(
                workspace_id=ws,
                user_id=user,
                platform="x",
                feature_id="rewrite",
                status="succeeded",
            )
            for _ in range(19)
        ]
        pending = AssistantRun(
            workspace_id=ws, user_id=user, platform="x", feature_id="rewrite", status="running"
        )
        db.add_all([*rows, pending])
        db.commit()
        with pytest.raises(HTTPException):
            check_assistant_usage_limit(db, ws)
        pending.status = "failed"
        db.commit()
        check_assistant_usage_limit(db, ws)
        assert get_plan_limits_summary(db, ws)["ai_credits"]["remaining"] == 1


def test_annual_usage_only_counts_current_month_and_public_plans_use_configured_limits(
    workspace, client, billing_catalog
):
    ws, user = workspace
    now = datetime(2026, 10, 8, 12, tzinfo=UTC)
    with SessionLocal() as db:
        db.add(
            Subscription(
                workspace_id=ws,
                user_id=user,
                provider_subscription_id="annual",
                plan_code="pro",
                status="active",
                current_period_start=datetime(2026, 1, 31, 10, tzinfo=UTC),
            )
        )
        db.add(
            Plan(
                code="pro",
                name="Pro",
                limits={"ai_credits": 123, "scheduled_posts": 250, "connected_accounts": 15},
            )
        )
        db.add_all(
            [
                AssistantRun(
                    workspace_id=ws,
                    user_id=user,
                    platform="x",
                    feature_id="rewrite",
                    status="succeeded",
                    created_at=date,
                )
                for date in [
                    datetime(2026, 8, 8, tzinfo=UTC),
                    datetime(2026, 10, 1, tzinfo=UTC),
                    datetime(2026, 10, 31, 11, tzinfo=UTC),
                ]
            ]
        )
        db.commit()
        summary = get_plan_limits_summary(db, ws, now)
        assert summary["ai_credits"] == {"used": 1, "limit": 123, "remaining": 122}
        assert summary["cycle_start"] == datetime(2026, 9, 30, 10, tzinfo=UTC)
        assert summary["cycle_end"] == datetime(2026, 10, 31, 10, tzinfo=UTC)
    assert client.get("/api/v1/billing/plans").json()["pro"]["limits"]["ai_credits"] == 123


@pytest.mark.anyio
@pytest.mark.parametrize("plan_code", ["starter", "creator", "pro", "business", "agency", "custom"])
async def test_paid_posts_are_unlimited_despite_stored_plan_and_grant_caps(
    workspace, client, auth, monkeypatch, plan_code
):
    ws, user = workspace

    class FakeAdapter:
        capabilities = Capabilities(platform="threads", display_name="Threads", max_text_length=500)

        async def validate(self, variant):
            return []

        async def publish(self, account, variant):
            return PublishResult(success=True, external_post_id=f"posted-{variant.id}")

    monkeypatch.setitem(channel_registry._adapters, "threads", FakeAdapter())
    with SessionLocal() as db:
        db.add_all(
            [
                Plan(
                    code=plan_code,
                    name=plan_code,
                    limits={"scheduled_posts": 1, "ai_credits": 123, "connected_accounts": 4},
                ),
                Subscription(
                    workspace_id=ws,
                    user_id=user,
                    provider_subscription_id="paid",
                    plan_code=plan_code,
                    status="active",
                ),
                EntitlementGrant(
                    workspace_id=ws, capability="scheduled_posts", limit_value=1, source="plan"
                ),
            ]
        )
        account = ConnectedAccount(
            workspace_id=ws,
            platform="threads",
            external_account_id="paid-threads",
            display_name="Paid account",
            status="active",
        )
        db.add(account)
        db.flush()
        variants = []
        for index in range(5):
            post = Post(workspace_id=ws, author_id=user)
            db.add(post)
            db.flush()
            variant = PostVariant(
                post_id=post.id,
                connected_account_id=account.id,
                platform="threads",
                status="published" if index < 3 else "draft",
                payload={"text": "A new idea"},
                idempotency_key=str(uuid4()),
                published_at=datetime.now(UTC) if index < 3 else None,
            )
            db.add(variant)
            variants.append(variant)
        db.commit()

        # Unlimited access overrides old caps without a backfill or renewal.
        assert entitlement_limit(db, ws, "scheduled_posts") is None
        assert get_plan_limits_summary(db, ws)["scheduled_posts"] == {
            "used": 3,
            "limit": None,
            "remaining": None,
        }
        assert entitlement_limit(db, ws, "ai_credits") == 123
        await schedule_variant(db, variants[3].id, bypass_validation=True)
        attempt = await publish_variant_job(variants[4].id, db)
        assert attempt.result == "success"
        assert variants[3].status == "scheduled"
        assert variants[4].status == "published"

        grant = db.scalar(select(EntitlementGrant).where(EntitlementGrant.workspace_id == ws))
        grant.source = "manual"
        grant.limit_value = 0
        db.commit()
        assert entitlement_limit(db, ws, "scheduled_posts") is None
        assert get_plan_limits_summary(db, ws)["scheduled_posts"]["limit"] is None
        grant.source = "plan"
        db.flush()
        sync_entitlements(db, ws, plan_code)
        db.flush()
        assert (
            db.scalar(
                select(EntitlementGrant).where(
                    EntitlementGrant.workspace_id == ws,
                    EntitlementGrant.capability == "scheduled_posts",
                )
            ).limit_value
            is None
        )
        db.commit()

    for endpoint in (
        "/api/v1/billing/usage",
        "/api/v1/posts/home",
        "/api/v1/analytics/plan-limits",
    ):
        response = client.get(endpoint, headers=auth)
        assert response.status_code == 200, response.text
        body = response.json()
        usage = body if endpoint.endswith("plan-limits") else body["usage"]
        assert usage["scheduled_posts"] == {"used": 5, "limit": None, "remaining": None}
        assert usage["ai_credits"]["limit"] == 123


@pytest.mark.parametrize(
    "status,plan_code",
    [
        ("expired", "pro"),
        ("failed", "pro"),
        ("revoked", "pro"),
        ("on_hold", "pro"),
        ("cancelled", "pro"),
        ("active", "unknown"),
        ("active", "free"),
    ],
)
def test_free_or_ineligible_subscriptions_cannot_keep_unlimited_posts(workspace, status, plan_code):
    ws, user = workspace
    with SessionLocal() as db:
        db.add(
            Subscription(
                workspace_id=ws,
                user_id=user,
                provider_subscription_id="ended",
                plan_code=plan_code,
                status=status,
                current_period_end=datetime.now(UTC) - timedelta(days=1),
                grace_until=datetime.now(UTC) - timedelta(days=1),
            )
        )
        # Stale unlimited entitlement from the previous paid subscription.
        sync_entitlements(db, ws, "pro")
        for _ in range(5):
            post = Post(workspace_id=ws, author_id=user)
            db.add(post)
            db.flush()
            db.add(
                PostVariant(
                    post_id=post.id,
                    platform="threads",
                    status="published",
                    published_at=datetime.now(UTC),
                    idempotency_key=str(uuid4()),
                )
            )
        db.commit()
        assert entitlement_limit(db, ws, "scheduled_posts") == 5
        summary = get_plan_limits_summary(db, ws)
        assert summary["plan_code"] == "free"
        assert summary["scheduled_posts"] == {"used": 5, "limit": 5, "remaining": 0}
        assert summary["ai_credits"]["limit"] == 20
        with pytest.raises(HTTPException) as raised:
            check_scheduled_posts_limit(db, ws)
        assert raised.value.status_code == 403


@pytest.mark.parametrize("status", ["trialing", "on_hold", "cancelled"])
def test_paid_trial_grace_and_remaining_term_include_unlimited_posts(workspace, status):
    ws, user = workspace
    with SessionLocal() as db:
        db.add(
            Subscription(
                workspace_id=ws,
                user_id=user,
                provider_subscription_id="eligible",
                plan_code="starter",
                status=status,
                current_period_end=datetime.now(UTC) + timedelta(days=1),
                grace_until=datetime.now(UTC) + timedelta(days=1),
            )
        )
        db.commit()
        assert entitlement_limit(db, ws, "scheduled_posts") is None
        assert get_plan_limits_summary(db, ws)["scheduled_posts"]["limit"] is None


def test_public_paid_plans_normalize_old_limits_without_changing_ai_or_prices(
    client, billing_catalog
):
    original = client.get("/api/v1/billing/plans").json()
    with SessionLocal.begin() as db:
        for code in ("starter", "pro", "business"):
            db.add(Plan(code=code, name=code, limits={"scheduled_posts": 1, "ai_credits": 123}))
    catalog = client.get("/api/v1/billing/plans").json()
    for plan in catalog.values():
        assert plan["limits"]["scheduled_posts"] is None
        assert plan["limits"]["ai_credits"] == 123
    for code, plan in catalog.items():
        assert plan["billing_cycles"] == original[code]["billing_cycles"]


@pytest.mark.parametrize(
    "plan_code,allowance", [("starter", 300), ("pro", 2000), ("business", 5000)]
)
def test_yearly_paid_credits_renew_at_monthly_boundary_in_billing_home_and_enforcement(
    workspace, client, auth, monkeypatch, plan_code, allowance
):
    from app.modules.billing import entitlements

    ws, user = workspace
    boundary = datetime(2026, 2, 28, 10, tzinfo=UTC)
    clock = {"now": boundary - timedelta(microseconds=1)}

    class Clock(datetime):
        @classmethod
        def now(cls, tz=None):
            return clock["now"] if tz else clock["now"].replace(tzinfo=None)

    monkeypatch.setattr(entitlements, "datetime", Clock)
    monkeypatch.setattr("app.modules.content.home.datetime", Clock)
    with SessionLocal.begin() as db:
        db.add(
            Subscription(
                workspace_id=ws,
                user_id=user,
                provider_subscription_id=f"yearly-{plan_code}",
                plan_code=plan_code,
                status="active",
                current_period_start=datetime(2026, 1, 31, 10, tzinfo=UTC),
                current_period_end=datetime(2027, 1, 31, 10, tzinfo=UTC),
            )
        )
        db.add_all(
            [
                AssistantRun(
                    workspace_id=ws,
                    user_id=user,
                    platform="x",
                    feature_id="rewrite",
                    status="succeeded",
                    created_at=datetime(2026, 2, 15, tzinfo=UTC),
                )
                for _ in range(allowance)
            ]
        )
    with SessionLocal() as db:
        assert get_plan_limits_summary(db, ws)["ai_credits"]["remaining"] == 0
        with pytest.raises(HTTPException, match="monthly limit"):
            check_assistant_usage_limit(db, ws)
    clock["now"] = boundary
    with SessionLocal() as db:
        check_assistant_usage_limit(db, ws)
        summary = get_plan_limits_summary(db, ws)
        assert summary["ai_credits"] == {"used": 0, "limit": allowance, "remaining": allowance}
        assert summary["cycle_start"] == boundary
        assert summary["cycle_end"] == datetime(2026, 3, 31, 10, tzinfo=UTC)
        assert len(list(db.scalars(select(AssistantRun)))) == allowance
    for path in ["/api/v1/billing/usage", "/api/v1/posts/home"]:
        response = client.get(path, headers=auth)
        assert response.status_code == 200, response.text
        usage = response.json()["usage"]
        assert usage["ai_credits"]["remaining"] == allowance
        assert datetime.fromisoformat(usage["cycle_end"].replace("Z", "+00:00")) == datetime(
            2026, 3, 31, 10, tzinfo=UTC
        )
    clock["now"] = datetime(2026, 3, 31, 10, tzinfo=UTC)
    with SessionLocal() as db:
        assert get_plan_limits_summary(db, ws)["ai_credits"]["remaining"] == allowance
        check_assistant_usage_limit(db, ws)
