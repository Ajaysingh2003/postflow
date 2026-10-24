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
        return Metrics(
            impressions=600,
            reach=450,
            engagements=55,
            likes=40,
            comments=10,
            clicks=5,
            extras={
                "metrics_status": "available",
                "available_metrics": [
                    "impressions",
                    "reach",
                    "engagements",
                    "likes",
                    "comments",
                    "clicks",
                ],
            },
        )

    async def fetch_account_metrics(self, account: ConnectedAccount) -> AccountMetrics:
        return AccountMetrics(
            followers_count=3200,
            profile_views=420,
            impressions=12000,
            reach=8500,
            extras={
                "metrics_status": "available",
                "available_metrics": ["followers_count", "profile_views", "impressions", "reach"],
            },
        )


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


def analytics_account(test_setup, name="account", platform="mock_analytics"):
    with SessionLocal() as db:
        account = ConnectedAccount(
            workspace_id=test_setup["workspace_id"],
            platform=platform,
            external_account_id=name,
            display_name=name,
            status="active",
        )
        db.add(account)
        db.commit()
        return account.id


def analytics_variant(
    test_setup, account_id, identifier="post", published_at=None, platform="mock_analytics"
):
    with SessionLocal() as db:
        post = Post(
            workspace_id=test_setup["workspace_id"],
            author_id=test_setup["user_id"],
            title="Launch",
            status="published",
        )
        db.add(post)
        db.flush()
        variant = PostVariant(
            post_id=post.id,
            connected_account_id=account_id,
            platform=platform,
            status="published",
            external_post_id=identifier,
            published_at=published_at or datetime.now(UTC),
            payload={"text": identifier},
            idempotency_key=str(uuid4()),
        )
        db.add(variant)
        db.commit()
        return variant.id, post.id


def test_post_summary_counts_only_this_workspaces_selected_account(test_setup):
    account = analytics_account(test_setup)
    other = analytics_account(test_setup, "other")
    variant, _ = analytics_variant(test_setup, account)
    analytics_variant(test_setup, other)
    with SessionLocal.begin() as db:
        db.get(PostVariant, variant).status = "draft"
    result = test_setup["client"].get(
        "/api/v1/posts/summary",
        headers=test_setup["headers"],
        params={"connected_account_id": account},
    )
    assert result.status_code == 200
    assert result.json() == {"draft": 1}
    assert (
        test_setup["client"]
        .get(
            "/api/v1/posts/summary",
            headers=test_setup["headers"],
            params={"connected_account_id": str(uuid4())},
        )
        .json()
        == {}
    )


def test_analytics_ignores_stored_metrics_and_never_writes(analytics_adapter, test_setup):
    account = analytics_account(test_setup)
    variant, post = analytics_variant(test_setup, account)
    with SessionLocal() as db:
        db.add(
            MetricSnapshot(
                workspace_id=test_setup["workspace_id"],
                connected_account_id=account,
                variant_id=variant,
                snapshot_type="variant",
                fetched_at=datetime.now(UTC),
                impressions=99999,
            )
        )
        db.commit()
    client, headers = test_setup["client"], test_setup["headers"]
    for url in [
        f"/analytics/variants/{variant}?live=false",
        f"/analytics/feed?account_id={account}",
    ]:
        result = client.get("/api/v1" + url, headers=headers)
        assert result.status_code == 200, result.text
        data = result.json()
        item = data[0] if isinstance(data, list) else data
        assert item["impressions"] == 600
        assert item["likes"] == 40
    overview = client.get("/api/v1/analytics/overview", headers=headers).json()
    assert overview["total_impressions"] == 600
    assert overview["by_platform"]["mock_analytics"]["likes"] == 40
    post_result = client.get(f"/api/v1/analytics/posts/{post}", headers=headers).json()
    assert post_result["total_impressions"] == 600
    account_result = client.get(
        f"/api/v1/analytics/accounts/{account}?live=false", headers=headers
    ).json()
    assert account_result["followers_count"] == 3200
    assert account_result["historical_snapshots"] == []
    assert client.post("/api/v1/analytics/sync-now", headers=headers).status_code == 200
    with SessionLocal() as db:
        assert len(list(db.scalars(select(MetricSnapshot)))) == 1
        assert db.get(ConnectedAccount, account).last_synced_at is None


def test_failed_live_request_never_falls_back_to_snapshot(
    analytics_adapter, test_setup, monkeypatch
):
    account = analytics_account(test_setup)
    variant, _ = analytics_variant(test_setup, account)
    with SessionLocal() as db:
        db.add_all(
            [
                MetricSnapshot(
                    workspace_id=test_setup["workspace_id"],
                    connected_account_id=account,
                    variant_id=variant,
                    snapshot_type="variant",
                    fetched_at=datetime.now(UTC),
                    impressions=99999,
                ),
                MetricSnapshot(
                    workspace_id=test_setup["workspace_id"],
                    connected_account_id=account,
                    snapshot_type="account",
                    fetched_at=datetime.now(UTC),
                    followers_count=88888,
                ),
            ]
        )
        db.commit()

    async def denied(*args, **kwargs):
        from fastapi import HTTPException

        raise HTTPException(403, "Denied")

    monkeypatch.setattr(analytics_adapter, "fetch_metrics", denied)
    monkeypatch.setattr(analytics_adapter, "fetch_account_metrics", denied)
    client, headers = test_setup["client"], test_setup["headers"]
    for endpoint in [f"variants/{variant}", f"accounts/{account}"]:
        response = client.get(f"/api/v1/analytics/{endpoint}", headers=headers)
        assert response.status_code == 200
        assert response.json()["metrics_status"] == "unavailable"
        assert response.json()["available_metrics"] == []
        assert "API access" in response.json()["metrics_notice"]
    result = client.get(f"/api/v1/analytics/dashboard?account_id={account}", headers=headers).json()
    assert result["overview"]["total_impressions"] == 0
    assert result["overview"]["metrics_status"] == "unavailable"
    assert result["accounts"][0]["followers_count"] == 0


def test_dashboard_reads_external_posts_and_full_aggregate(
    analytics_adapter, test_setup, monkeypatch
):
    from app.modules.channels.base import AnalyticsPost, AnalyticsPosts

    account = analytics_account(test_setup)
    calls = []

    async def account_posts(acc, start, end):
        calls.append(acc.id)
        return AnalyticsPosts(
            posts=[
                AnalyticsPost(
                    external_post_id=str(i),
                    text=f"External {i}",
                    published_at=datetime.now(UTC) - timedelta(days=1),
                    metrics=Metrics(
                        impressions=i + 1,
                        likes=2,
                        extras={
                            "metrics_status": "partial",
                            "available_metrics": ["impressions", "likes"],
                        },
                    ),
                )
                for i in range(105)
            ]
        )

    monkeypatch.setattr(analytics_adapter, "fetch_analytics_posts", account_posts, raising=False)
    result = test_setup["client"].get(
        "/api/v1/analytics/dashboard",
        params={"account_id": account, "limit": 50, "offset": 100},
        headers=test_setup["headers"],
    )
    assert result.status_code == 200, result.text
    assert result.headers["cache-control"] == "no-store"
    data = result.json()
    assert data["account_id"] == account
    assert len(data["posts"]) == 5
    assert data["posts"][0]["post_id"] is None
    assert data["overview"]["total_posts_published"] == 105
    assert data["overview"]["total_impressions"] == sum(range(1, 106))
    assert data["overview"]["available_metrics"] == ["impressions", "likes"]
    assert calls == [account]
    with SessionLocal() as db:
        assert list(db.scalars(select(MetricSnapshot))) == []
        assert list(db.scalars(select(Post))) == []


@pytest.mark.parametrize(
    "platform",
    ["x", "linkedin", "reddit", "bluesky", "mastodon", "facebook", "instagram", "threads"],
)
def test_account_feed_keeps_native_posts_alongside_draftva_posts(
    platform, analytics_adapter, test_setup, monkeypatch
):
    from app.modules.channels.base import AnalyticsPost, AnalyticsPosts

    # Exercise account routing for every supported channel. Adapter HTTP pagination
    # and provider-specific fields are covered by test_live_analytics_adapters.py.
    assert callable(channel_registry.require(platform).fetch_analytics_posts)
    monkeypatch.setitem(channel_registry._adapters, platform, analytics_adapter)
    account = analytics_account(test_setup, platform=platform)
    other = analytics_account(test_setup, "other", platform=platform)
    local_variant, local_post = analytics_variant(
        test_setup, account, "from-draftva", platform=platform
    )
    analytics_variant(test_setup, account, "missing-from-api", platform=platform)
    analytics_variant(test_setup, other, "native-post", platform=platform)
    now = datetime.now(UTC)

    def api_post(identifier, days, impressions):
        return AnalyticsPost(
            external_post_id=identifier,
            text=f"Official copy of {identifier}",
            external_url=f"https://social.test/posts/{identifier}",
            published_at=now - timedelta(days=days),
            metrics=Metrics(
                impressions=impressions,
                extras={"metrics_status": "partial", "available_metrics": ["impressions"]},
            ),
        )

    async def account_posts(acc, start, end):
        assert acc.id == account
        return AnalyticsPosts(
            posts=[
                api_post("from-draftva", 1, 10),
                api_post("native-post", 2, 20),
                api_post("another-native", 3, 30),
                api_post("native-post", 2, 20),  # Provider duplicate, counted once.
                api_post("outside-date-range", 45, 999),
            ]
        )

    monkeypatch.setattr(analytics_adapter, "fetch_analytics_posts", account_posts, raising=False)
    client, headers = test_setup["client"], test_setup["headers"]
    params = {"account_id": account, "content_type": "posts", "limit": 1}
    first = client.get("/api/v1/analytics/dashboard", params=params, headers=headers).json()
    assert first["posts"][0]["variant_id"] == local_variant
    assert first["posts"][0]["post_id"] == local_post
    assert first["posts"][0]["text"] == "Official copy of from-draftva"
    second = client.get(
        "/api/v1/analytics/dashboard", params={**params, "offset": 1}, headers=headers
    ).json()
    assert second["posts"][0]["external_post_id"] == "native-post"
    assert second["posts"][0]["platform"] == platform
    assert second["posts"][0]["post_id"] is None
    assert second["posts"][0]["variant_id"].startswith(f"external:{account}:")
    assert second["posts"][0]["external_url"] == "https://social.test/posts/native-post"
    for data in (first, second):
        assert data["feed_total"] == 3
        assert data["overview"]["total_posts_published"] == 3
        assert data["overview"]["total_impressions"] == 60
        assert data["dataset_complete"]
    # The draftva library remains local-only and native API posts are not imported.
    library = client.get(
        "/api/v1/posts/library",
        params={"connected_account_id": account, "category": "posts"},
        headers=headers,
    ).json()
    assert {item["external_post_id"] for item in library["items"]} == {
        "from-draftva",
        "missing-from-api",
    }
    with SessionLocal() as db:
        assert len(list(db.scalars(select(Post)))) == 3
        assert list(db.scalars(select(MetricSnapshot))) == []


def test_dashboard_scope_and_freshness(analytics_adapter, test_setup, monkeypatch):
    from app.modules.channels.base import AnalyticsPost, AnalyticsPosts

    first, second = analytics_account(test_setup, "first"), analytics_account(test_setup, "second")
    calls = []

    async def account_posts(acc, start, end):
        calls.append(acc.id)
        return AnalyticsPosts(
            posts=[
                AnalyticsPost(
                    external_post_id=acc.external_account_id,
                    text=acc.display_name,
                    published_at=datetime.now(UTC) - timedelta(seconds=1),
                    metrics=Metrics(
                        likes=len(calls),
                        extras={"metrics_status": "partial", "available_metrics": ["likes"]},
                    ),
                )
            ]
        )

    monkeypatch.setattr(analytics_adapter, "fetch_analytics_posts", account_posts, raising=False)
    for i, account in enumerate([first, second, first], 1):
        response = test_setup["client"].get(
            "/api/v1/analytics/dashboard",
            params={"account_id": account},
            headers=test_setup["headers"],
        )
        data = response.json()
        assert data["account_id"] == account
        assert data["posts"][0]["connected_account_id"] == account
        assert data["posts"][0]["likes"] == i
        assert [a["account_id"] for a in data["accounts"]] == [account]
    assert calls == [first, second, first]
    missing = test_setup["client"].get(
        "/api/v1/analytics/dashboard",
        params={"account_id": "foreign-account"},
        headers=test_setup["headers"],
    )
    assert missing.status_code == 404
    assert len(calls) == 3


def test_dashboard_dates_and_partial_coverage(analytics_adapter, test_setup, monkeypatch):
    from app.modules.channels.base import AnalyticsPost, AnalyticsPosts

    account = analytics_account(test_setup)
    now = datetime.now(UTC)

    async def posts(acc, start, end):
        return AnalyticsPosts(
            posts=[
                AnalyticsPost(
                    external_post_id=str(days),
                    text="post",
                    published_at=now - timedelta(days=days),
                    metrics=Metrics(
                        likes=12,
                        extras={"metrics_status": "partial", "available_metrics": ["likes"]},
                    ),
                )
                for days in [5, 45]
            ],
            complete=False,
            notice="The API limited this dataset.",
        )

    monkeypatch.setattr(analytics_adapter, "fetch_analytics_posts", posts, raising=False)
    result = test_setup["client"].get(
        "/api/v1/analytics/dashboard",
        params={
            "account_id": account,
            "start_date": (now - timedelta(days=10)).isoformat(),
            "end_date": now.isoformat(),
        },
        headers=test_setup["headers"],
    )
    assert result.status_code == 200
    data = result.json()
    assert len(data["posts"]) == 1
    assert data["posts"][0]["available_metrics"] == ["likes"]
    assert not data["dataset_complete"]
    assert "limited" in data["dataset_notice"]
    assert data["overview"]["available_metrics"] == []
    assert data["overview"]["metrics_status"] == "partial"


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
            workspace_id=ws_id,
            platform="x",
            external_account_id="x1",
            display_name="X 1",
            status="active",
        )
        db.add(acc1)
        db.commit()
        check_connected_accounts_limit(db, ws_id)  # Should not raise

        # Add 2nd account: OK
        acc2 = ConnectedAccount(
            workspace_id=ws_id,
            platform="linkedin",
            external_account_id="l1",
            display_name="L 1",
            status="active",
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
            post = Post(workspace_id=ws_id, author_id=user_id, status="draft")
            db.add(post)
            db.flush()
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
        assert summary["scheduled_posts"]["limit"] is None
        assert summary["ai_credits"]["limit"] == 2000


def test_real_time_official_api_fetching_on_request(analytics_adapter, test_setup):
    """Verify that requests directly invoke the official platform API in real time."""
    client = test_setup["client"]
    headers = test_setup["headers"]
    ws_id = test_setup["workspace_id"]
    user_id = test_setup["user_id"]

    with SessionLocal() as db:
        acc = ConnectedAccount(
            workspace_id=ws_id,
            platform="mock_analytics",
            external_account_id=f"acc_live_{uuid4().hex[:6]}",
            display_name="Live Profile",
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
            external_post_id="post_live_123",
            idempotency_key=str(uuid4()),
        )
        db.add(variant)
        db.commit()

    # 1. Feed request fetches live from adapter (mock adapter returns 600 impressions, 40 likes)
    resp_feed = client.get(f"/api/v1/analytics/feed?account_id={acc.id}&live=true", headers=headers)
    assert resp_feed.status_code == 200
    feed_items = resp_feed.json()
    assert len(feed_items) == 1
    assert feed_items[0]["impressions"] == 600
    assert feed_items[0]["likes"] == 40

    # 2. Account request fetches live from adapter (mock adapter returns 3200 followers)
    resp_acc = client.get(f"/api/v1/analytics/accounts/{acc.id}?live=true", headers=headers)
    assert resp_acc.status_code == 200
    acc_data = resp_acc.json()
    assert acc_data["followers_count"] == 3200


def test_analytics_invalid_interval_is_rejected_without_api_calls(
    analytics_adapter, test_setup, monkeypatch
):
    calls = []

    async def read(account):
        calls.append(account.id)
        return AccountMetrics()

    monkeypatch.setattr(analytics_adapter, "fetch_account_metrics", read)
    account = analytics_account(test_setup)
    for dates in [
        {"start_date": "garbage"},
        {"start_date": "2026-10-07", "end_date": "2026-09-01"},
    ]:
        response = test_setup["client"].get(
            "/api/v1/analytics/dashboard",
            params={"account_id": account, **dates},
            headers=test_setup["headers"],
        )
        assert response.status_code == 422
    assert calls == []


@pytest.mark.anyio
async def test_x_dashboard_and_feed_exclude_replies_from_totals_and_pagination(
    test_setup, monkeypatch
):
    import httpx

    from app.modules.channels.adapters.x import XAdapter

    published = (datetime.now(UTC) - timedelta(days=1)).isoformat()
    entries = [
        {
            "id": identifier,
            "text": identifier,
            "created_at": published,
            "public_metrics": {
                "impression_count": impressions,
                "like_count": likes,
                "reply_count": 2,
                "retweet_count": 0,
                "quote_count": 0,
            },
            **({"referenced_tweets": [{"type": "replied_to", "id": "parent"}]} if reply else {}),
        }
        for identifier, impressions, likes, reply in [
            ("reply", 9999, 999, True),
            ("original-1", 10, 2, False),
            ("original-2", 20, 3, False),
        ]
    ]

    def handler(request):
        if request.url.path.endswith("/users/me"):
            return httpx.Response(200, json={"data": {"public_metrics": {"followers_count": 95}}})
        if "/users/" in request.url.path:
            assert request.url.params["exclude"] == "retweets"
            return httpx.Response(200, json={"data": entries})
        assert request.url.params["ids"] == "original-1,original-2,reply"
        return httpx.Response(200, json={"data": entries})

    with SessionLocal.begin() as db:
        account = ConnectedAccount(
            workspace_id=test_setup["workspace_id"],
            platform="x",
            external_account_id="123",
            display_name="X author",
            status="active",
            encrypted_access_token=encrypt_token("test-access"),
        )
        db.add(account)
        db.flush()
        account_id = account.id

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as http_client:
        adapter = XAdapter(http_client=http_client)
        monkeypatch.setattr(channel_registry, "get", lambda platform: adapter)
        for offset in [0, 1]:
            response = test_setup["client"].get(
                "/api/v1/analytics/dashboard",
                headers=test_setup["headers"],
                params={"account_id": account_id, "limit": 1, "offset": offset},
            )
            assert response.status_code == 200
            data = response.json()
            assert data["overview"]["total_posts_published"] == 2
            assert data["overview"]["total_impressions"] == 30
            assert data["overview"]["total_likes"] == 5
            assert data["inclusive_impressions"] == {
                "total": 10029,
                "post_impressions": 30,
                "reply_impressions": 9999,
                "replies_count": 1,
                "complete": True,
            }
            assert len(data["posts"]) == 1
            assert data["posts"][0]["external_post_id"].startswith("original-")
            assert data["posts"][0]["comments"] == 2
            assert data["dataset_complete"]
        response = test_setup["client"].get(
            "/api/v1/analytics/feed",
            params={"account_id": account_id},
            headers=test_setup["headers"],
        )
        assert response.status_code == 200
        assert {p["external_post_id"] for p in response.json()} == {"original-1", "original-2"}
        for content_type, expected in [("all", 3), ("replies", 1)]:
            data = (
                test_setup["client"]
                .get(
                    "/api/v1/analytics/dashboard",
                    headers=test_setup["headers"],
                    params={"account_id": account_id, "content_type": content_type, "limit": 1},
                )
                .json()
            )
            assert data["feed_total"] == expected
            assert data["overview"]["total_impressions"] == 30
            assert data["replies_count"] == 1
            if content_type == "replies":
                assert data["posts"][0]["is_reply"]


@pytest.mark.anyio
@pytest.mark.parametrize("use_target_metadata", [True, False])
async def test_linkedin_company_dashboard_reads_official_feed_and_metrics(
    test_setup, monkeypatch, use_target_metadata
):
    import httpx

    from app.modules.channels.adapters.linkedin import LinkedInAdapter

    org = "urn:li:organization:42"
    post_id = "urn:li:share:123"
    calls = []

    def handler(request):
        calls.append(request)
        assert request.url.host == "api.linkedin.com"
        if "networkSizes" in request.url.path:
            return httpx.Response(200, json={"firstDegreeSize": 123})
        if request.url.path.endswith("posts"):
            assert request.url.params["author"] == org
            return httpx.Response(
                200,
                json={
                    "elements": [
                        {
                            "id": post_id,
                            "commentary": "Company launch outside draftva",
                            "publishedAt": int(
                                (datetime.now(UTC) - timedelta(hours=1)).timestamp() * 1000
                            ),
                            "lifecycleState": "PUBLISHED",
                        }
                    ]
                },
            )
        if request.url.path.endswith("organizationPageStatistics"):
            return httpx.Response(
                200,
                json={
                    "elements": [
                        {"totalPageStatistics": {"views": {"allPageViews": {"pageViews": 900}}}}
                    ]
                },
            )
        assert request.url.path.endswith("organizationalEntityShareStatistics")
        assert request.url.params["organizationalEntity"] == org
        return httpx.Response(
            200,
            json={
                "elements": [
                    {
                        "share": post_id,
                        "totalShareStatistics": {
                            "impressionCount": 800,
                            "uniqueImpressionsCount": 400,
                            "likeCount": 10,
                            "commentCount": 2,
                            "shareCount": 3,
                            "clickCount": 5,
                        },
                    }
                ]
            },
        )

    with SessionLocal.begin() as db:
        account = ConnectedAccount(
            workspace_id=test_setup["workspace_id"],
            platform="linkedin",
            external_account_id="member-42" if use_target_metadata else org,
            display_name="Company Page",
            account_type="page",
            status="active",
            encrypted_access_token=encrypt_token("test-company-access"),
            account_metadata={"target_org_urn": org} if use_target_metadata else {},
        )
        db.add(account)
        db.flush()
        account_id = account.id

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as http_client:
        adapter = LinkedInAdapter(http_client=http_client)
        monkeypatch.setattr(channel_registry, "get", lambda platform: adapter)
        response = test_setup["client"].get(
            "/api/v1/analytics/dashboard",
            params={"account_id": account_id},
            headers=test_setup["headers"],
        )
    assert response.status_code == 200
    assert response.headers["cache-control"] == "no-store"
    result = response.json()
    assert result["accounts"][0]["followers_count"] == 123
    assert result["overview"]["metrics_status"] == "available"
    assert result["overview"]["total_impressions"] == 800
    assert result["overview"]["total_engagements"] == 20
    assert result["posts"][0]["text"] == "Company launch outside draftva"
    assert result["posts"][0]["post_id"] is None
    assert result["dataset_complete"]
    assert len(calls) == 5
    with SessionLocal() as db:
        assert list(db.scalars(select(MetricSnapshot))) == []
        assert list(db.scalars(select(PostVariant))) == []
