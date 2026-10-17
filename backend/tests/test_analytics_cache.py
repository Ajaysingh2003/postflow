import asyncio
import json
import time
from datetime import UTC, datetime
from types import SimpleNamespace

import httpx
import pytest
from fastapi import HTTPException
from redis.exceptions import ConnectionError as RedisConnectionError

from app.core.config import Settings
from app.modules.analytics import cache
from app.modules.channels.support import AdapterHTTP


@pytest.fixture
def anyio_backend():
    return "asyncio"


class MemoryRedis:
    def __init__(self):
        self.data = {}
        self.expiry = {}

    async def get(self, key):
        if self.expiry.get(key, float("inf")) <= time.time():
            self.data.pop(key, None)
        return self.data.get(key)

    async def set(self, key, value, nx=False, ex=None):
        if nx and await self.get(key) is not None:
            return False
        self.data[key] = value
        if ex:
            self.expiry[key] = time.time() + ex
        return True

    async def eval(self, script, count, key, *args):
        value = await self.get(key)
        if script == cache.RELEASE:
            if value == args[0]:
                return self.data.pop(key, None) is not None
            return 0
        if script == cache.RESERVE and int(value or 0) >= int(args[1]):
            return -1
        value = int(value or 0) + 1
        await self.set(key, str(value), ex=int(args[0]))
        return value

    async def aclose(self):
        pass


@pytest.fixture
def redis_cache(monkeypatch):
    memory = MemoryRedis()
    settings = Settings(_env_file=None, app_env="development")
    monkeypatch.setattr(cache, "connection", lambda: memory)
    monkeypatch.setattr(cache, "get_settings", lambda: settings)
    return memory, settings


@pytest.mark.anyio
async def test_cache_reuses_dataset_across_requests_and_scope_isolated(redis_cache):
    memory, _settings = redis_cache
    calls = 0

    async def build():
        nonlocal calls
        calls += 1
        return {"posts": [1, 2, 3], "fetched_at": str(datetime.now(UTC))}

    identity = ["workspace-one", "account-one", "range-one"]
    first = await cache.cached_dashboard("workspace-one", identity, False, build)
    second = await cache.cached_dashboard("workspace-one", identity, False, build)
    assert first[0] == second[0]
    assert second[1] is True
    assert calls == 1
    await cache.cached_dashboard(
        "workspace-two", ["workspace-two", "account-one", "range-one"], False, build
    )
    assert calls == 2
    await cache.cached_dashboard("workspace-one", identity, True, build)
    assert calls == 3
    with pytest.raises(HTTPException) as exc:
        await cache.cached_dashboard(
            "workspace-one", ["workspace-one", "another-range"], True, build
        )
    assert exc.value.status_code == 429
    assert all(
        "account-one" not in key for key in memory.data
    )  # cache keys contain no content or credentials
    assert any(key in memory.expiry for key in memory.data)


@pytest.mark.anyio
async def test_concurrent_requests_fetch_once_and_failures_release_lease(redis_cache):
    calls = 0

    async def build():
        nonlocal calls
        calls += 1
        await asyncio.sleep(0.01)
        return {"data": "result"}

    results = await asyncio.gather(
        *[cache.cached_dashboard("one", ["one"], False, build) for _ in range(4)]
    )
    assert calls == 1
    assert sum(not result[1] for result in results) == 1

    async def fail():
        raise RuntimeError("provider failed")

    with pytest.raises(RuntimeError):
        await cache.cached_dashboard("one", ["failed"], False, fail)
    assert (await cache.cached_dashboard("one", ["failed"], False, build))[0] == {"data": "result"}


@pytest.mark.anyio
async def test_redis_outage_does_not_fall_back_to_unlimited_paid_reads(redis_cache, monkeypatch):
    async def fail(key):
        raise RedisConnectionError("offline")

    monkeypatch.setattr(redis_cache[0], "get", fail)
    called = False

    async def build():
        nonlocal called
        called = True

    with pytest.raises(HTTPException) as exc:
        await cache.cached_dashboard("one", ["one"], False, build)
    assert exc.value.status_code == 503
    assert not called


@pytest.mark.anyio
async def test_read_budget_is_shared_and_blocks_before_http(redis_cache, monkeypatch):
    memory, settings = redis_cache
    settings.analytics_daily_read_limit = 2
    requests = []

    async def acquire(*args):
        return True, 0

    async def observe(*args):
        pass

    monkeypatch.setattr(
        "app.modules.channels.support.shared_rate_limiter",
        SimpleNamespace(acquire=acquire, observe=observe),
    )
    async with AdapterHTTP(
        "x",
        transport=httpx.MockTransport(
            lambda request: requests.append(request) or httpx.Response(200, json={})
        ),
    ) as client:
        for _ in range(2):
            context = cache.current_budget.set(cache.ReadBudget("workspace", memory))
            try:
                await client.get("https://api.x.com/2/tweets")
            finally:
                cache.current_budget.reset(context)
        context = cache.current_budget.set(cache.ReadBudget("workspace", memory))
        try:
            with pytest.raises(HTTPException) as exc:
                await client.get("https://api.x.com/2/tweets")
            assert exc.value.status_code == 429
        finally:
            cache.current_budget.reset(context)
    assert len(requests) == 2
    key = f"analytics:reads:workspace:{int(time.time()) // 86400}"
    assert int(await memory.get(key)) == 2


@pytest.mark.anyio
async def test_per_refresh_and_result_size_bounds(redis_cache):
    memory, settings = redis_cache
    settings.analytics_max_reads_per_refresh = 1
    budget = cache.ReadBudget("workspace", memory)
    await budget.consume("x")
    with pytest.raises(HTTPException):
        await budget.consume("x")
    settings.analytics_cache_max_bytes = 10

    async def build():
        return {"long": "x" * 100}

    with pytest.raises(HTTPException) as exc:
        await cache.cached_dashboard("workspace", ["large"], False, build)
    assert exc.value.status_code == 422
    assert not any(json.dumps({"long": "x" * 100}) == value for value in memory.data.values())


def test_dashboard_pagination_shares_full_dataset_but_refresh_and_reauth_are_explicit(
    client, auth, redis_cache, monkeypatch
):
    from unittest.mock import AsyncMock

    from sqlalchemy import select

    from app.db.session import SessionLocal
    from app.modules.channels.base import AccountMetrics, AnalyticsPost, AnalyticsPosts, Metrics
    from app.modules.channels.models import ConnectedAccount
    from app.modules.channels.registry import channel_registry
    from app.modules.identity.models import User
    from app.modules.workspaces.models import Workspace

    with SessionLocal.begin() as db:
        owner = db.scalar(select(User).where(User.email == "owner@example.com"))
        workspace = db.scalar(select(Workspace).where(Workspace.owner_user_id == owner.id))
        account = ConnectedAccount(
            workspace_id=workspace.id,
            platform="cost_test",
            external_account_id="123",
            display_name="Account",
        )
        db.add(account)
        db.flush()
        account_id = account.id
    metrics = Metrics(
        impressions=25, extras={"metrics_status": "available", "available_metrics": ["impressions"]}
    )
    adapter = SimpleNamespace(
        fetch_account_metrics=AsyncMock(return_value=AccountMetrics()),
        fetch_analytics_posts=AsyncMock(
            return_value=AnalyticsPosts(
                posts=[
                    AnalyticsPost(
                        external_post_id=str(i),
                        text=str(i),
                        published_at=datetime.now(UTC),
                        metrics=metrics,
                    )
                    for i in range(5)
                ]
            )
        ),
    )
    monkeypatch.setitem(channel_registry._adapters, "cost_test", adapter)
    params = {"account_id": account_id, "limit": 2}
    first = client.get("/api/v1/analytics/dashboard", headers=auth, params=params)
    assert first.status_code == 200, first.text
    second = client.get("/api/v1/analytics/dashboard", headers=auth, params={**params, "offset": 2})
    assert second.json()["cache_hit"] is True
    assert second.json()["feed_total"] == 5
    assert (
        first.json()["posts"][0]["external_post_id"]
        != second.json()["posts"][0]["external_post_id"]
    )
    assert first.json()["overview"] == second.json()["overview"]
    assert adapter.fetch_analytics_posts.await_count == 1
    assert (
        client.post("/api/v1/analytics/dashboard/refresh", headers=auth, params=params).status_code
        == 200
    )
    assert adapter.fetch_analytics_posts.await_count == 2
    assert (
        client.post("/api/v1/analytics/dashboard/refresh", headers=auth, params=params).status_code
        == 429
    )
    with SessionLocal.begin() as db:
        db.get(ConnectedAccount, account_id).status = "needs_reauth"
    result = client.get("/api/v1/analytics/dashboard", headers=auth, params=params).json()
    assert not result["posts"]
    assert "Reconnect" in result["dataset_notice"]
    assert result["cache_hit"] is False


@pytest.mark.anyio
async def test_adapter_pagination_limit_preserves_partial_data(redis_cache):
    from app.modules.channels.adapters.x import XAdapter
    from app.modules.channels.models import ConnectedAccount
    from app.modules.channels.oauth import encrypt_token

    _memory, settings = redis_cache
    settings.analytics_max_pages_per_account = 1
    calls = []

    def respond(request):
        calls.append(request)
        return httpx.Response(
            200,
            json={
                "data": [
                    {
                        "id": "123",
                        "text": "Post",
                        "created_at": "2026-10-01T00:00:00Z",
                        "public_metrics": {"impression_count": 5},
                    }
                ],
                "meta": {"next_token": "more"},
            },
        )

    async with httpx.AsyncClient(transport=httpx.MockTransport(respond)) as http:
        adapter = XAdapter(http_client=http)
        account = ConnectedAccount(
            external_account_id="one", encrypted_access_token=encrypt_token("test")
        )
        result = await adapter.fetch_analytics_posts(
            account, datetime(2026, 9, 1, tzinfo=UTC), datetime(2026, 10, 10, tzinfo=UTC)
        )
    assert len(calls) == 1
    assert len(result.posts) == 1
    assert result.complete is False
    assert "limit" in result.notice
