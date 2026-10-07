"""Comprehensive test suite for Phase 7: Analytics and Billing Limits.
Covers:
- Overview analytics aggregation across channels
- Whole-account metrics aggregation and historical snapshots
- Post and variant performance metrics
- Manual sync trigger endpoint
- Plan limits summary endpoint
- Quota enforcement: connected accounts limit (HTTP 403)
- Quota enforcement: monthly scheduled posts limit (HTTP 403)
- Quota enforcement: monthly AI assistant usage limit (HTTP 403)
"""

import hashlib
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.db.session import SessionLocal
from app.main import app
from app.modules.analytics.models import MetricSnapshot
from app.modules.assistant.models import AssistantRun
from app.modules.billing.entitlements import (
    check_assistant_usage_limit,
    check_connected_accounts_limit,
    check_scheduled_posts_limit,
    get_plan_limits_summary,
    sync_entitlements,
)
from app.modules.billing.models import Subscription
from app.modules.channels.base import (
    AccountMetrics,
    AuthStart,
    Capabilities,
    Metrics,
    PublishResult,
    Target,
)
from app.modules.channels.models import ConnectedAccount
from app.modules.channels.oauth import encrypt_token
from app.modules.channels.registry import channel_registry
from app.modules.content.models import Post, PostVariant
from app.modules.identity.models import PasswordCredential, SessionToken, User
from app.modules.publishing.service import schedule_variant
from app.modules.workspaces.models import Workspace, WorkspaceMembership


class AnalyticsMockAdapter:
    """Mock platform adapter for testing analytics synchronization."""

    def __init__(self, platform: str = "mock_analytics") -> None:
        self.platform = platform
        self.capabilities = Capabilities(
            platform=platform,
            display_name="Analytics Mock",
            max_text_length=500,
            supports_media=True,
            supports_account_metrics=True,
        )

    async def build_auth_url(self, workspace_id: str, state: str, **opts: Any) -> AuthStart:
        return AuthStart(auth_url=f"https://mock.test/auth?state={state}", state=state)

    async def handle_callback(
        self, workspace_id: str, params: dict[str, Any], state: str, **opts: Any
    ) -> ConnectedAccount:
        return ConnectedAccount(
            workspace_id=workspace_id,
            platform=self.platform,
            external_account_id=f"ext_{uuid4().hex[:8]}",
            display_name="Analytics Tester",
            encrypted_access_token=encrypt_token("tok_analytics"),
            status="active",
        )

    async def refresh_tokens(self, account: ConnectedAccount) -> ConnectedAccount:
        return account

    async def revoke(self, account: ConnectedAccount) -> None:
        pass

    async def list_targets(self, account: ConnectedAccount) -> list[Target]:
        return []

    async def validate(self, variant: Any, **opts: Any) -> list:
        return []

    async def publish(self, account: ConnectedAccount, variant: Any) -> PublishResult:
        return PublishResult(success=True, external_post_id="post_ext_123")

    async def delete_post(self, account: ConnectedAccount, external_post_id: str) -> None:
        pass

    async def fetch_metrics(
        self,
        account: ConnectedAccount,
        external_post_id: str,
        context: dict[str, Any] | None = None,
    ) -> Metrics:
        return Metrics(impressions=600, reach=450, engagements=55, likes=40, comments=10, clicks=5)

    async def fetch_account_metrics(self, account: ConnectedAccount) -> AccountMetrics:
        return AccountMetrics(followers_count=3200, profile_views=420, impressions=12000, reach=8500)


@pytest.fixture
def analytics_adapter():
    adapter = AnalyticsMockAdapter(platform="mock_analytics")
    channel_registry.register(adapter)
    yield adapter
    channel_registry.unregister("mock_analytics")


@pytest.fixture
def test_setup():
    user_id = str(uuid4())
    ws_id = str(uuid4())
    raw_token = f"tok_analytics_{uuid4().hex}"

    with SessionLocal.begin() as db:
        user = User(
            id=user_id,
            email=f"analytics_tester_{uuid4().hex[:8]}@example.com",
            name="Analytics Tester",
            email_verified=True,
            is_active=True,
        )
        ws = Workspace(
            id=ws_id,
            name="Analytics Workspace",
            slug=f"analytics-ws-{uuid4().hex[:8]}",
            owner_user_id=user_id,
        )
        cred = PasswordCredential(user_id=user_id, password_hash="secret")
        mem = WorkspaceMembership(workspace_id=ws_id, user_id=user_id, role="owner")
        session = SessionToken(
            user_id=user_id,
            token_hash=hashlib.sha256(raw_token.encode("utf-8")).hexdigest(),
            expires_at=datetime.now(UTC) + timedelta(days=1),
        )
        # Default Free subscription
        sub = Subscription(
            user_id=user_id,
            workspace_id=ws_id,
            provider_subscription_id=f"sub_{uuid4().hex[:8]}",
            plan_code="free",
            status="active",
            current_period_start=datetime.now(UTC) - timedelta(days=5),
            current_period_end=datetime.now(UTC) + timedelta(days=25),
        )
        db.add_all([user, ws, cred, mem, session, sub])
        sync_entitlements(db, ws_id, "free")

    client = TestClient(app)
    headers = {
        "Authorization": f"Bearer {raw_token}",
        "X-Workspace-ID": ws_id,
    }

    return {
        "client": client,
        "headers": headers,
        "user_id": user_id,
        "workspace_id": ws_id,
    }


# ==============================================================================
# 1. Analytics Aggregation & Endpoints Tests
# ==============================================================================


def test_analytics_overview_and_platform_breakdown(analytics_adapter, test_setup):
    client = test_setup["client"]
    headers = test_setup["headers"]
    ws_id = test_setup["workspace_id"]
    user_id = test_setup["user_id"]

    with SessionLocal() as db:
        # Create an account
        account = ConnectedAccount(
            workspace_id=ws_id,
            platform="mock_analytics",
            external_account_id="acc_ext_1",
            display_name="Tester",
            status="active",
        )
        db.add(account)
        db.flush()

        # Create published post with variant
        post = Post(workspace_id=ws_id, author_id=user_id, title="Analytics Post", status="published")
        db.add(post)
        db.flush()

        variant = PostVariant(
            post_id=post.id,
            connected_account_id=account.id,
            platform="mock_analytics",
            status="published",
            external_post_id="ext_p1",
            idempotency_key=str(uuid4()),
        )
        db.add(variant)
        db.flush()

        # Add a variant metric snapshot
        snap = MetricSnapshot(
            workspace_id=ws_id,
            connected_account_id=account.id,
            variant_id=variant.id,
            snapshot_type="variant",
            fetched_at=datetime.now(UTC),
            impressions=1500,
            reach=1200,
            engagements=130,
            likes=100,
            comments=20,
            shares_reposts=10,
            clicks=15,
        )
        db.add(snap)
        db.commit()

    resp = client.get("/api/v1/analytics/overview?days=30", headers=headers)
    assert resp.status_code == 200
    data = resp.json()

    assert data["total_impressions"] == 1500
    assert data["total_reach"] == 1200
    assert data["total_likes"] == 100
    assert data["total_comments"] == 20
    assert data["total_posts_published"] == 1

    # Verify platform breakdown
    assert "mock_analytics" in data["by_platform"]
    p_data = data["by_platform"]["mock_analytics"]
    assert p_data["impressions"] == 1500
    assert p_data["likes"] == 100
    assert p_data["posts_count"] == 1


def test_whole_account_analytics_endpoints(analytics_adapter, test_setup):
    client = test_setup["client"]
    headers = test_setup["headers"]
    ws_id = test_setup["workspace_id"]

    with SessionLocal() as db:
        account = ConnectedAccount(
            workspace_id=ws_id,
            platform="mock_analytics",
            external_account_id="acc_whole_1",
            display_name="Growth Profile",
            account_type="creator",
            status="active",
        )
        db.add(account)
        db.flush()
        account_id = account.id

        # Add historical account snapshots
        snap1 = MetricSnapshot(
            workspace_id=ws_id,
            connected_account_id=account.id,
            variant_id=None,
            snapshot_type="account",
            fetched_at=datetime.now(UTC) - timedelta(days=2),
            followers_count=3000,
            profile_views=250,
            impressions=8000,
            reach=5000,
        )
        snap2 = MetricSnapshot(
            workspace_id=ws_id,
            connected_account_id=account.id,
            variant_id=None,
            snapshot_type="account",
            fetched_at=datetime.now(UTC),
            followers_count=3200,
            profile_views=310,
            impressions=10000,
            reach=6500,
        )
        db.add_all([snap1, snap2])
        db.commit()

    # 1. List accounts analytics
    resp = client.get("/api/v1/analytics/accounts", headers=headers)
    assert resp.status_code == 200
    accounts_data = resp.json()
    assert len(accounts_data) == 1
    acc_entry = accounts_data[0]
    assert acc_entry["account_id"] == account_id
    assert acc_entry["followers_count"] == 3200  # latest
    assert len(acc_entry["historical_snapshots"]) == 2

    # 2. Get single account analytics
    resp_single = client.get(f"/api/v1/analytics/accounts/{account_id}", headers=headers)
    assert resp_single.status_code == 200
    assert resp_single.json()["followers_count"] == 3200


def test_post_and_variant_analytics_endpoints(analytics_adapter, test_setup):
    client = test_setup["client"]
    headers = test_setup["headers"]
    ws_id = test_setup["workspace_id"]
    user_id = test_setup["user_id"]

    with SessionLocal() as db:
        post = Post(workspace_id=ws_id, author_id=user_id, title="Multi-variant Launch", status="published")
        db.add(post)
        db.flush()

        v1 = PostVariant(post_id=post.id, platform="mock_analytics", status="published", idempotency_key=str(uuid4()))
        v2 = PostVariant(post_id=post.id, platform="mock_analytics", status="published", idempotency_key=str(uuid4()))
        db.add_all([v1, v2])
        db.flush()

        # Add metric snapshot to v1
        db.add(
            MetricSnapshot(
                workspace_id=ws_id,
                connected_account_id="acc_dummy",
                variant_id=v1.id,
                snapshot_type="variant",
                fetched_at=datetime.now(UTC),
                impressions=800,
                likes=60,
                comments=10,
                extras={"bookmark_count": 7, "unavailable_metrics": ["reach"]},
            )
        )
        # Add metric snapshot to v2
        db.add(
            MetricSnapshot(
                workspace_id=ws_id,
                connected_account_id="acc_dummy",
                variant_id=v2.id,
                snapshot_type="variant",
                fetched_at=datetime.now(UTC),
                impressions=400,
                likes=25,
                comments=5,
            )
        )
        db.commit()
        post_id = post.id
        v1_id = v1.id

    # 1. Variant analytics
    resp_v = client.get(f"/api/v1/analytics/variants/{v1_id}", headers=headers)
    assert resp_v.status_code == 200
    assert resp_v.json()["impressions"] == 800
    assert resp_v.json()["likes"] == 60
    assert resp_v.json()["extras"] == {"bookmark_count": 7, "unavailable_metrics": ["reach"]}

    # 2. Post aggregated analytics
    resp_p = client.get(f"/api/v1/analytics/posts/{post_id}", headers=headers)
    assert resp_p.status_code == 200
    p_data = resp_p.json()
    assert p_data["total_impressions"] == 1200  # 800 + 400
    assert p_data["total_likes"] == 85          # 60 + 25
    assert len(p_data["variants"]) == 2


def test_sync_metrics_endpoint(analytics_adapter, test_setup):
    client = test_setup["client"]
    headers = test_setup["headers"]
    ws_id = test_setup["workspace_id"]
    user_id = test_setup["user_id"]

    with SessionLocal() as db:
        acc = ConnectedAccount(
            workspace_id=ws_id,
            platform="mock_analytics",
            external_account_id="acc_sync_1",
            display_name="Sync Target",
            status="active",
        )
        db.add(acc)
        db.flush()

        post = Post(workspace_id=ws_id, author_id=user_id, status="published")
        db.add(post)
        db.flush()

        variant = PostVariant(
            post_id=post.id,
            connected_account_id=acc.id,
            platform="mock_analytics",
            status="published",
            external_post_id="post_sync_1",
            idempotency_key=str(uuid4()),
        )
        db.add(variant)
        db.commit()

    resp = client.post("/api/v1/analytics/sync-now", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["accounts_synced"] == 1
    assert data["variants_synced"] == 1


def test_analytics_feed_and_overview_date_filtering(analytics_adapter, test_setup):
    """Verify that start_date and end_date correctly filter feed posts and workspace overview."""
    client = test_setup["client"]
    headers = test_setup["headers"]
    ws_id = test_setup["workspace_id"]
    user_id = test_setup["user_id"]

    now = datetime.now(UTC)
    recent_date = now - timedelta(days=5)
    older_date = now - timedelta(days=45)

    with SessionLocal() as db:
        acc = ConnectedAccount(
            workspace_id=ws_id,
            platform="mock_analytics",
            external_account_id=f"acc_{uuid4().hex[:6]}",
            display_name="Date Filter Profile",
            status="active",
        )
        db.add(acc)
        db.flush()

        # Recent post
        p_recent = Post(workspace_id=ws_id, author_id=user_id, status="published")
        db.add(p_recent)
        db.flush()
        v_recent = PostVariant(
            post_id=p_recent.id,
            connected_account_id=acc.id,
            platform="mock_analytics",
            status="published",
            published_at=recent_date,
            updated_at=recent_date,
            payload={"text": "Recent post from 5 days ago"},
            idempotency_key=str(uuid4()),
        )
        db.add(v_recent)
        db.flush()
        db.add(
            MetricSnapshot(
                workspace_id=ws_id,
                connected_account_id=acc.id,
                variant_id=v_recent.id,
                snapshot_type="variant",
                # Snapshot retrieval time is independent of the post's selected date range.
                fetched_at=recent_date - timedelta(days=60),
                impressions=500,
                likes=50,
            )
        )

        # Older post
        p_old = Post(workspace_id=ws_id, author_id=user_id, status="published")
        db.add(p_old)
        db.flush()
        v_old = PostVariant(
            post_id=p_old.id,
            connected_account_id=acc.id,
            platform="mock_analytics",
            status="published",
            published_at=older_date,
            updated_at=older_date,
            payload={"text": "Old post from 45 days ago"},
            idempotency_key=str(uuid4()),
        )
        db.add(v_old)
        db.flush()
        db.add(
            MetricSnapshot(
                workspace_id=ws_id,
                connected_account_id=acc.id,
                variant_id=v_old.id,
                snapshot_type="variant",
                # A fresh snapshot for an old post must not bring it into the selected range.
                fetched_at=now,
                impressions=1000,
                likes=100,
            )
        )
        db.commit()

    # 1. Query feed without filter: returns both
    resp_all = client.get(f"/api/v1/analytics/feed?account_id={acc.id}", headers=headers)
    assert resp_all.status_code == 200
    items_all = resp_all.json()
    assert len(items_all) == 2

    # 2. Query feed with date filter covering last 10 days only
    start_filter = (now - timedelta(days=10)).isoformat()
    end_filter = now.isoformat()
    resp_filtered = client.get(
        f"/api/v1/analytics/feed?account_id={acc.id}&start_date={start_filter}&end_date={end_filter}",
        headers=headers,
    )
    assert resp_filtered.status_code == 200
    items_filtered = resp_filtered.json()
    assert len(items_filtered) == 1
    assert items_filtered[0]["text"] == "Recent post from 5 days ago"
    assert items_filtered[0]["impressions"] == 500

    # 3. Query overview with custom date filter
    resp_ov = client.get(
        f"/api/v1/analytics/overview?account_id={acc.id}&start_date={start_filter}&end_date={end_filter}",
        headers=headers,
    )
    assert resp_ov.status_code == 200
    ov_data = resp_ov.json()
    assert ov_data["start_date"] is not None
    assert ov_data["end_date"] is not None
    assert ov_data["total_posts_published"] == 1
    assert ov_data["total_impressions"] == 500
    assert ov_data["total_likes"] == 50


# ==============================================================================
# 2. Plan Limits Summary & Enforcement Tests
# ==============================================================================


def test_plan_limits_summary_endpoint(test_setup):
    client = test_setup["client"]
    headers = test_setup["headers"]

    resp = client.get("/api/v1/analytics/plan-limits", headers=headers)
    assert resp.status_code == 200
    data = resp.json()

    assert data["plan_code"] == "free"
    assert data["connected_accounts"]["limit"] == 2
    assert data["scheduled_posts"]["limit"] == 5
    assert data["ai_credits"]["limit"] == 20
    assert "cycle_start" in data


def test_connected_accounts_limit_enforcement(test_setup):
    ws_id = test_setup["workspace_id"]

    with SessionLocal() as db:
        # Free plan limit is 2
        # Add 1st account: OK
        acc1 = ConnectedAccount(
            workspace_id=ws_id, platform="x", external_account_id="x1", display_name="X 1", status="active"
        )
        db.add(acc1)
        db.commit()
        check_connected_accounts_limit(db, ws_id)  # Should not raise

        # Add 2nd account: OK
        acc2 = ConnectedAccount(
            workspace_id=ws_id, platform="linkedin", external_account_id="l1", display_name="L 1", status="active"
        )
        db.add(acc2)
        db.commit()

        # Workspace now has 2 accounts (limit = 2). Attempting to add a 3rd must raise 403 Forbidden
        with pytest.raises(Exception) as exc_info:
            check_connected_accounts_limit(db, ws_id)
        assert exc_info.value.status_code == 403
        assert "limit of 2 connected accounts" in exc_info.value.detail


@pytest.mark.anyio
async def test_scheduled_posts_limit_enforcement(test_setup):
    ws_id = test_setup["workspace_id"]
    user_id = test_setup["user_id"]

    with SessionLocal() as db:
        post = Post(workspace_id=ws_id, author_id=user_id, status="draft")
        db.add(post)
        db.flush()

        # Free plan has limit of 5 scheduled posts
        variants = []
        for i in range(5):
            v = PostVariant(
                post_id=post.id,
                platform="x",
                status="draft",
                payload={"text": f"Tweet {i}"},
                idempotency_key=str(uuid4()),
            )
            db.add(v)
            variants.append(v)
        db.commit()

        # Schedule all 5 variants
        for v in variants:
            await schedule_variant(db, v.id, bypass_validation=True)

        # 6th variant: should be blocked by check_scheduled_posts_limit
        v6 = PostVariant(
            post_id=post.id,
            platform="x",
            status="draft",
            payload={"text": "Tweet 6"},
            idempotency_key=str(uuid4()),
        )
        db.add(v6)
        db.commit()

        with pytest.raises(Exception) as exc_info:
            check_scheduled_posts_limit(db, ws_id)
        assert exc_info.value.status_code == 403
        assert "monthly limit of 5 scheduled posts" in exc_info.value.detail


def test_assistant_usage_limit_enforcement(test_setup):
    ws_id = test_setup["workspace_id"]
    user_id = test_setup["user_id"]

    with SessionLocal() as db:
        # Free plan limit is 20 runs
        runs = [
            AssistantRun(
                workspace_id=ws_id,
                user_id=user_id,
                platform="x",
                feature_id="x_hook_variants",
                tokens_used=100,
                cost_micros=500,
                status="succeeded",
                created_at=datetime.now(UTC),
            )
            for _ in range(20)
        ]
        db.add_all(runs)
        db.commit()

        # 21st run should trigger 403
        with pytest.raises(Exception) as exc_info:
            check_assistant_usage_limit(db, ws_id)
        assert exc_info.value.status_code == 403
        assert "monthly limit of 20 AI assistant runs" in exc_info.value.detail


def test_plan_upgrade_relaxes_limits(test_setup):
    ws_id = test_setup["workspace_id"]

    with SessionLocal() as db:
        # Upgrade to Pro
        sub = db.scalar(select(Subscription).where(Subscription.workspace_id == ws_id))
        sub.plan_code = "pro"
        db.commit()
        sync_entitlements(db, ws_id, "pro")

        summary = get_plan_limits_summary(db, ws_id)
        assert summary["plan_code"] == "pro"
        assert summary["connected_accounts"]["limit"] == 15
        assert summary["scheduled_posts"]["limit"] == 250
        assert summary["ai_credits"]["limit"] == 1000
