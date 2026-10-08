from datetime import UTC, datetime
from types import SimpleNamespace

import httpx
import pytest

from app.modules.analytics.service import _feed_item, _overview
from app.modules.channels.adapters.facebook import FacebookAdapter
from app.modules.channels.adapters.instagram import InstagramAdapter
from app.modules.channels.adapters.meta_insights import fetch_insights, insight_values
from app.modules.channels.base import AnalyticsPost
from app.modules.channels.oauth import encrypt_token


@pytest.fixture
def anyio_backend():
    return "asyncio"


def account(platform):
    return SimpleNamespace(
        id="meta-account",
        platform=platform,
        display_name="Test account",
        status="active",
        encrypted_access_token=encrypt_token("user-token"),
        account_metadata={
            "oauth_flow": "instagram_login",
            "primary_ig_id": "ig-user",
            "primary_page_id": "222",
            "pages": [{"id": "111"}, {"id": "222"}],
            "page_tokens": {
                "111": encrypt_token("first-page"),
                "222": encrypt_token("selected-page"),
            },
        },
    )


def test_insight_values_handles_missing_and_zero_without_inventing_counts():
    assert insight_values(
        {
            "data": [
                {"name": "views", "total_value": {"value": 0}},
                {"name": "reach", "values": []},
                {"name": "likes", "values": [{"value": 2}, {"value": 3}]},
                {"name": "saved", "values": [{"value": None}]},
                {"name": "shares", "total_value": {"breakdowns": []}},
                {"name": "other", "values": [{"value": {"mobile": 1}}]},
            ]
        }
    ) == {"views": 0, "likes": 3}


@pytest.mark.anyio
async def test_one_invalid_metric_does_not_discard_other_metrics():
    calls = []

    def handler(request):
        metric = request.url.params["metric"]
        calls.append(metric)
        if metric in {"views,reach,saved", "saved"}:
            return httpx.Response(400, json={"error": {"code": 100, "message": "Invalid metric"}})
        return httpx.Response(200, json={"data": [{"name": metric, "total_value": {"value": 12}}]})

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        values, notice = await fetch_insights(
            client,
            "https://graph.instagram.com/insights",
            {},
            ["views", "reach", "saved"],
            "Instagram",
        )
    assert values == {"views": 12, "reach": 12}
    assert notice
    assert calls == ["views,reach,saved", "views", "reach", "saved"]


@pytest.mark.anyio
@pytest.mark.parametrize(
    "platform,adapter", [("facebook", FacebookAdapter), ("instagram", InstagramAdapter)]
)
@pytest.mark.parametrize(
    "code,status,expected",
    [(200, 403, "require"), (190, 400, "Reconnect"), (80001, 429, "limited")],
)
async def test_insights_failure_retains_public_counts_without_retry_storm(
    platform, adapter, code, status, expected
):
    calls = []

    def handler(request):
        calls.append(request)
        if request.url.path.endswith("/insights"):
            return httpx.Response(status, json={"error": {"code": code}})
        return httpx.Response(
            200,
            json={
                "like_count": 5,
                "comments_count": 2,
                "followers_count": 0,
                "fan_count": 99,
                "reactions": {"summary": {"total_count": 5}},
                "comments": {"summary": {"total_count": 2}},
                "shares": {"count": 0},
            },
        )

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        source = adapter(http_client=client)
        post = await source.fetch_metrics(account(platform), "222_post")
        profile = await source.fetch_account_metrics(account(platform))
    assert post.likes == 5 and post.comments == 2
    assert {"likes", "comments"}.issubset(post.extras["available_metrics"])
    assert "views" not in post.extras["available_metrics"]
    assert "engagements" not in post.extras["available_metrics"]
    assert profile.followers_count == 0
    assert "followers_count" in profile.extras["available_metrics"]
    assert expected in post.extras["metrics_notice"]
    assert expected in profile.extras["metrics_notice"]
    assert len(calls) == 4


@pytest.mark.anyio
async def test_facebook_uses_selected_page_token_and_current_metrics():
    calls = []

    def handler(request):
        calls.append(request)
        assert request.url.params["access_token"] == "selected-page"
        assert "/222" in request.url.path
        if request.url.path.endswith("/insights"):
            names = request.url.params["metric"].split(",")
            assert request.url.path.startswith("/v26.0/")
            assert not any("impressions" in name or "engaged_users" in name for name in names)
            return httpx.Response(
                200, json={"data": [{"name": name, "values": [{"value": 8}]} for name in names]}
            )
        assert "fan_count" not in request.url.params["fields"]
        return httpx.Response(200, json={"followers_count": 14})

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        source = FacebookAdapter(http_client=client)
        post = await source.fetch_metrics(account("facebook"), "222_post")
        profile = await source.fetch_account_metrics(account("facebook"))
    assert post.views == 8 and post.reach == 8 and post.clicks == 8
    assert profile.views == 8 and profile.followers_count == 14
    assert profile.extras["page_id"] == "222"
    assert "likes" not in post.extras["available_metrics"]
    assert int(calls[-1].url.params["until"]) - int(calls[-1].url.params["since"]) == 86400


@pytest.mark.anyio
async def test_instagram_total_value_reels_and_dashboard_views():
    calls = []

    def handler(request):
        calls.append(request)
        if request.url.path.endswith("/insights"):
            names = request.url.params["metric"].split(",")
            assert request.url.path.startswith("/v26.0/")
            assert "impressions" not in names
            return httpx.Response(
                200,
                json={
                    "data": [
                        {"name": name, "total_value": {"value": 100 if name == "views" else 7}}
                        for name in names
                    ]
                },
            )
        return httpx.Response(
            200,
            json={
                "media_product_type": "REELS",
                "like_count": 5,
                "comments_count": 2,
                "followers_count": 4,
            },
        )

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        source = InstagramAdapter(http_client=client)
        post = await source.fetch_metrics(account("instagram"), "ig-media")
        profile = await source.fetch_account_metrics(account("instagram"))
    assert "ig_reels_avg_watch_time" in calls[1].url.params["metric"]
    assert "metric_type" not in calls[1].url.params
    assert calls[3].url.params["metric_type"] == "total_value"
    assert profile.views == post.views == 100
    assert profile.engagements == post.engagements == 7  # Provider total, not a guessed sum.
    assert post.likes == 7  # Insights can return counts hidden on the public object.
    assert post.extras["saved"] == 7
    assert post.extras["insights"]["ig_reels_avg_watch_time"] == 7

    import asyncio

    now = datetime.now(UTC)
    row = await _feed_item(
        account("instagram"),
        AnalyticsPost(external_post_id="ig-media", published_at=now, metrics=post),
        None,
        asyncio.Semaphore(1),
    )
    overview = _overview([row], now, now, True, None)
    assert row.views == overview.total_views == 100
    assert "views" in overview.available_metrics
    assert "impressions" not in overview.available_metrics


@pytest.mark.anyio
async def test_insights_timeout_preserves_public_counts():
    def handler(request):
        if request.url.path.endswith("/insights"):
            raise httpx.ReadTimeout("Timed out", request=request)
        return httpx.Response(200, json={"like_count": 4, "comments_count": 0})

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        result = await InstagramAdapter(http_client=client).fetch_metrics(
            account("instagram"), "ig-media"
        )
    assert result.likes == 4 and result.comments == 0
    assert result.extras["available_metrics"] == ["comments", "likes"]
    assert "reached" in result.extras["metrics_notice"]


@pytest.mark.anyio
async def test_empty_insights_do_not_masquerade_as_zero():
    def handler(request):
        return httpx.Response(200, json={"data": []})

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        result = await InstagramAdapter(http_client=client).fetch_metrics(
            account("instagram"), "ig-media"
        )
    assert result.extras["available_metrics"] == []
    assert result.extras["metrics_status"] == "unavailable"
    assert result.extras["metrics_notice"]


@pytest.mark.anyio
async def test_legacy_instagram_login_reads_facebook_graph_and_reports_correct_permissions():
    source_account = account("instagram")
    source_account.account_metadata["oauth_flow"] = "facebook_login"
    source_account.account_metadata["ig_tokens"] = {"ig-user": encrypt_token("ig-page-token")}
    calls = []

    def handler(request):
        calls.append(request)
        assert request.url.host == "graph.facebook.com"
        assert request.url.params["access_token"] == "ig-page-token"
        if request.url.path.endswith("/insights"):
            return httpx.Response(403, json={"error": {"code": 200}})
        return httpx.Response(200, json={"like_count": 3, "followers_count": 10})

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        source = InstagramAdapter(http_client=client)
        result = await source.fetch_metrics(source_account, "ig-media")
        profile = await source.fetch_account_metrics(source_account)
        now = datetime.now(UTC)
        await source.fetch_analytics_posts(source_account, now, now)
    assert result.likes == 3 and profile.followers_count == 10
    assert "instagram_manage_insights" in result.extras["metrics_notice"]
    assert "instagram_business_manage_insights" not in result.extras["metrics_notice"]
    assert "total_views" in calls[1].url.params["metric"]


@pytest.mark.anyio
async def test_metric_isolation_stops_on_permission_error_and_keeps_successful_data():
    calls = []

    def handler(request):
        name = request.url.params["metric"]
        calls.append(name)
        if "," in name:
            return httpx.Response(400, json={"error": {"code": 100, "message": "Invalid metric"}})
        if name == "views":
            return httpx.Response(200, json={"data": [{"name": name, "total_value": {"value": 0}}]})
        return httpx.Response(403, json={"error": {"code": 200}})

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        result, notice = await fetch_insights(
            client,
            "https://graph.instagram.com/insights",
            {},
            ["views", "reach", "saved"],
            "Instagram",
        )
    assert result == {"views": 0}
    assert "require" in notice
    assert calls == ["views,reach,saved", "views", "reach"]
