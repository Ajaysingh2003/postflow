import asyncio
from datetime import UTC, datetime
from types import SimpleNamespace

import httpx
import pytest

from app.modules.analytics.service import _feed_item, _overview
from app.modules.channels.adapters.threads import ThreadsAdapter
from app.modules.channels.base import AnalyticsPost
from app.modules.channels.oauth import encrypt_token


@pytest.fixture
def anyio_backend():
    return "asyncio"


def account():
    return SimpleNamespace(
        id="account",
        external_account_id="creator",
        platform="threads",
        display_name="Creator",
        encrypted_access_token=encrypt_token("token"),
    )


@pytest.mark.anyio
@pytest.mark.parametrize("value", [0, 42])
async def test_followers_are_current_total_without_date_filters(value):
    def handler(request):
        assert request.url.host == "graph.threads.com"
        assert request.url.path == "/v1.0/creator/threads_insights"
        assert dict(request.url.params) == {"access_token": "token", "metric": "followers_count"}
        return httpx.Response(
            200, json={"data": [{"name": "followers_count", "total_value": {"value": value}}]}
        )

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        adapter = ThreadsAdapter(http_client=client)
        assert adapter.capabilities.supports_account_metrics
        metrics = await adapter.fetch_account_metrics(account())
    assert metrics.followers_count == value
    assert metrics.extras["available_metrics"] == ["followers_count"]


@pytest.mark.anyio
async def test_views_propagate_to_dashboard_without_becoming_impressions():
    def handler(request):
        return httpx.Response(
            200,
            json={
                "data": [
                    {"name": key, "values": [{"value": value}]}
                    for key, value in {
                        "views": 200,
                        "likes": 0,
                        "replies": 2,
                        "reposts": 1,
                        "quotes": 1,
                    }.items()
                ]
            },
        )

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        metrics = await ThreadsAdapter(http_client=client).fetch_metrics(account(), "post")
    assert metrics.views == 200
    assert metrics.impressions == 0
    assert metrics.engagements == 4
    assert metrics.shares_reposts == 2
    assert metrics.extras["metrics_notice"] is None
    assert "impressions" not in metrics.extras["available_metrics"]
    assert "likes" in metrics.extras["available_metrics"]
    now = datetime.now(UTC)
    post = await _feed_item(
        account(),
        AnalyticsPost(external_post_id="post", text="hello", published_at=now, metrics=metrics),
        None,
        asyncio.Semaphore(1),
    )
    assert post.views == 200
    assert post.engagement_rate == 2
    overview = _overview([post], now, now, True, None)
    assert overview.total_views == 200
    assert "views" in overview.available_metrics
    assert "impressions" not in overview.available_metrics


@pytest.mark.anyio
async def test_empty_metric_samples_do_not_become_available_zero():
    def handler(request):
        return httpx.Response(
            200,
            json={
                "data": [
                    {"name": "views", "values": []},
                    {"name": "likes", "values": [{"value": 0}]},
                    {"name": "reposts", "values": [{"value": 1}]},
                ]
            },
        )

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        metrics = await ThreadsAdapter(http_client=client).fetch_metrics(account(), "post")
    assert metrics.extras["available_metrics"] == ["likes"]
    assert "shares" not in metrics.extras["available_metrics"]
    assert "engagements" not in metrics.extras["available_metrics"]
    assert metrics.extras["metrics_notice"]


@pytest.mark.anyio
async def test_permission_failure_gives_threads_specific_reconnect_guidance():
    calls = []

    def handler(request):
        calls.append(request)
        return httpx.Response(403, json={"error": {"code": 200}})

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        metrics = await ThreadsAdapter(http_client=client).fetch_account_metrics(account())
    assert len(calls) == 1
    assert metrics.extras["available_metrics"] == []
    assert "threads_manage_insights" in metrics.extras["metrics_notice"]
