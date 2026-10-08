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
from app.modules.billing.models import Plan, Subscription, UsageLedger
from app.modules.channels.models import ConnectedAccount
from app.modules.content.models import Post, PostVariant
from app.modules.publishing.service import schedule_variant
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
    workspace, client
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
