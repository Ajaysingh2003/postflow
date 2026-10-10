"""Live account datasets, permission failures and real provider pagination."""

from datetime import UTC, datetime, timedelta
from types import SimpleNamespace

import httpx
import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ec

from app.modules.channels.adapters.bluesky import BlueskyAdapter
from app.modules.channels.adapters.facebook import FacebookAdapter
from app.modules.channels.adapters.instagram import InstagramAdapter
from app.modules.channels.adapters.linkedin import LinkedInAdapter
from app.modules.channels.adapters.mastodon import MastodonAdapter
from app.modules.channels.adapters.reddit import RedditAdapter
from app.modules.channels.adapters.threads import ThreadsAdapter
from app.modules.channels.adapters.x import XAdapter
from app.modules.channels.oauth import encrypt_token


@pytest.fixture
def anyio_backend():
    return "asyncio"


def account(platform, metadata=None, identifier="123"):
    metadata = dict(metadata or {})
    if platform == "bluesky":
        key = (
            ec.generate_private_key(ec.SECP256R1())
            .private_bytes(
                serialization.Encoding.PEM,
                serialization.PrivateFormat.PKCS8,
                serialization.NoEncryption(),
            )
            .decode()
        )
        metadata["oauth"] = {
            "encrypted_dpop_key": encrypt_token(key),
            "issuer": "https://pds.example",
        }
    return SimpleNamespace(
        id="account-id",
        platform=platform,
        external_account_id=identifier,
        account_metadata=metadata,
        encrypted_access_token=encrypt_token("access"),
        granted_scopes=[],
        status="active",
    )


@pytest.mark.anyio
async def test_x_reads_all_pages_and_enriches_private_metrics_without_per_post_calls():
    now = datetime.now(UTC)
    calls = []

    def handler(request):
        calls.append(request)
        if request.url.path.endswith("/tweets") and "/users/" in request.url.path:
            second = request.url.params.get("pagination_token") == "next"
            return httpx.Response(
                200,
                json={
                    "data": [
                        {
                            "id": "2" if second else "1",
                            "text": "Published outside draftva",
                            "created_at": (now - timedelta(days=1)).isoformat(),
                            "public_metrics": {
                                "like_count": 10,
                                "reply_count": 2,
                                "retweet_count": 3,
                                "quote_count": 1,
                                "impression_count": 500,
                                "bookmark_count": 4,
                            },
                        }
                    ],
                    "meta": {} if second else {"next_token": "next"},
                },
            )
        assert request.url.params["ids"] == "1,2"
        return httpx.Response(
            200,
            json={
                "data": [
                    {
                        "id": str(i),
                        "public_metrics": {
                            "like_count": 10,
                            "reply_count": 2,
                            "retweet_count": 3,
                            "quote_count": 1,
                            "impression_count": 500,
                            "bookmark_count": 4,
                        },
                        "non_public_metrics": {"url_link_clicks": 8, "user_profile_clicks": 7},
                    }
                    for i in [1, 2]
                ]
            },
        )

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        dataset = await XAdapter(http_client=client).fetch_analytics_posts(
            account("x"), now - timedelta(days=7), now
        )
    assert [post.external_post_id for post in dataset.posts] == ["1", "2"]
    assert dataset.complete
    assert len(calls) == 3
    assert dataset.posts[0].metrics.clicks == 8
    assert dataset.posts[0].metrics.extras["user_profile_clicks"] == 7
    assert dataset.posts[0].metrics.reach == 0
    assert "reach" not in dataset.posts[0].metrics.extras["available_metrics"]
    assert calls[0].url.params["exclude"] == "retweets"
    assert calls[0].headers["authorization"] == "Bearer access"


@pytest.mark.anyio
async def test_x_posts_separate_replies_and_continue_through_reply_only_pages():
    now = datetime.now(UTC)
    calls = []

    def post(identifier, **fields):
        return {
            "id": identifier,
            "text": "@someone A standalone mention" if identifier == "original" else identifier,
            "created_at": (now - timedelta(days=1)).isoformat(),
            "public_metrics": {"like_count": 1},
            **fields,
        }

    def handler(request):
        calls.append(request)
        if "/users/" in request.url.path:
            assert request.url.params["exclude"] == "retweets"
            assert "in_reply_to_user_id" in request.url.params["tweet.fields"].split(",")
            second = request.url.params.get("pagination_token") == "next"
            return httpx.Response(
                200,
                json={
                    "data": [
                        post("original"),
                        post("quote", referenced_tweets=[{"type": "quoted", "id": "other"}]),
                        post("reply", referenced_tweets=[{"type": "replied_to", "id": "other"}]),
                        post(
                            "quote-reply",
                            referenced_tweets=[
                                {"type": "quoted", "id": "other"},
                                {"type": "replied_to", "id": "parent"},
                            ],
                        ),
                    ]
                    if second
                    else [
                        post("reply-field", in_reply_to_user_id="another-user"),
                        post(
                            "self-reply", referenced_posts=[{"type": "replied_to", "id": "parent"}]
                        ),
                        post("repost", referenced_tweets=[{"type": "retweeted", "id": "other"}]),
                    ],
                    "meta": {} if second else {"next_token": "next"},
                },
            )
        assert (
            request.url.params["ids"] == "original,quote,reply-field,self-reply,reply,quote-reply"
        )
        return httpx.Response(200, json={"data": [post("original"), post("quote")]})

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        dataset = await XAdapter(http_client=client).fetch_analytics_posts(
            account("x"), now - timedelta(days=7), now
        )
    assert [p.external_post_id for p in dataset.posts] == ["original", "quote"]
    assert dataset.posts[0].text.startswith("@someone")
    assert [p.external_post_id for p in dataset.replies] == [
        "reply-field",
        "self-reply",
        "reply",
        "quote-reply",
    ]
    assert all(p.is_reply for p in dataset.replies)
    assert dataset.supports_replies
    assert dataset.complete
    assert len(calls) == 3


@pytest.mark.anyio
async def test_x_private_denial_keeps_public_counts_and_missing_fields_unavailable():
    now = datetime.now(UTC)

    def handler(request):
        if "/users/" in request.url.path:
            return httpx.Response(
                200,
                json={
                    "data": [
                        {
                            "id": "1",
                            "text": "Post",
                            "created_at": now.isoformat(),
                            "public_metrics": {"like_count": 0},
                        }
                    ]
                },
            )
        return httpx.Response(403, json={"detail": "Not permitted"})

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        result = await XAdapter(http_client=client).fetch_analytics_posts(
            account("x"), now - timedelta(days=7), now
        )
    assert result.posts[0].metrics.extras["available_metrics"] == ["likes"]
    assert "private" in result.notice


@pytest.mark.anyio
async def test_x_repeated_cursor_does_not_loop_forever():
    now = datetime.now(UTC)

    def handler(request):
        return httpx.Response(200, json={"data": [], "meta": {"next_token": "same"}})

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        result = await XAdapter(http_client=client).fetch_analytics_posts(
            account("x"), now - timedelta(days=7), now
        )
    assert not result.complete
    assert "cursor" in result.notice


@pytest.mark.anyio
async def test_linkedin_personal_profile_is_explicitly_unavailable_without_api_calls():
    def handler(request):
        pytest.fail("Personal profile should not invoke organization APIs")

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        adapter = LinkedInAdapter(http_client=client)
        now = datetime.now(UTC)
        result = await adapter.fetch_analytics_posts(
            account("linkedin"), now - timedelta(days=30), now
        )
        metrics = await adapter.fetch_account_metrics(account("linkedin"))
    assert result.posts == [] and not result.complete
    assert "company Page" in result.notice
    assert metrics.extras["metrics_status"] == "unavailable"


@pytest.mark.anyio
async def test_linkedin_company_feed_uses_paging_links_even_when_page_is_short():
    now = datetime.now(UTC)
    calls = []

    def handler(request):
        calls.append(request)
        offset = request.url.params["start"]
        return httpx.Response(
            200,
            json={
                "elements": [
                    {
                        "id": "urn:li:share:" + str(int(offset) + 1),
                        "commentary": "Company news",
                        "publishedAt": int((now - timedelta(days=1)).timestamp() * 1000),
                        "lifecycleState": "PUBLISHED",
                    }
                ],
                "paging": {
                    "links": [{"rel": "next", "href": "https://untrusted.example/steal?start=100"}]
                    if offset == "0"
                    else []
                },
            },
        )

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        result = await LinkedInAdapter(http_client=client).fetch_analytics_posts(
            account("linkedin", {"target_org_urn": "urn:li:organization:42"}),
            now - timedelta(days=7),
            now,
        )
    assert len(result.posts) == 2
    assert result.complete
    assert len(calls) == 2
    assert all(r.url.host == "api.linkedin.com" for r in calls)
    assert all(r.url.params["author"] == "urn:li:organization:42" for r in calls)


@pytest.mark.anyio
async def test_linkedin_company_account_returns_available_official_page_metrics():
    def handler(request):
        if "networkSizes" in request.url.path:
            return httpx.Response(200, json={"firstDegreeSize": 123})
        if request.url.path.endswith("organizationPageStatistics"):
            return httpx.Response(
                200,
                json={
                    "elements": [
                        {"totalPageStatistics": {"views": {"allPageViews": {"pageViews": 900}}}}
                    ]
                },
            )
        return httpx.Response(
            200,
            json={
                "elements": [
                    {
                        "totalShareStatistics": {
                            "impressionCount": 800,
                            "uniqueImpressionsCount": 400,
                            "likeCount": 10,
                            "commentCount": 2,
                            "shareCount": 3,
                            "clickCount": 5,
                        }
                    }
                ]
            },
        )

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        metrics = await LinkedInAdapter(http_client=client).fetch_account_metrics(
            account("linkedin", {"target_org_urn": "urn:li:organization:42"})
        )
    assert metrics.followers_count == 123
    assert metrics.profile_views == 900
    assert metrics.impressions == 800
    assert metrics.reach == 400
    assert metrics.engagements == 20
    assert set(metrics.extras["available_metrics"]) == {
        "followers_count",
        "profile_views",
        "impressions",
        "reach",
        "engagements",
    }


@pytest.mark.anyio
@pytest.mark.parametrize(
    "platform,adapter_type,metadata,target,edge",
    [
        ("facebook", FacebookAdapter, {"pages": [{"id": "page"}]}, "page", "published_posts"),
        ("instagram", InstagramAdapter, {"primary_ig_id": "ig"}, "ig", "media"),
        ("threads", ThreadsAdapter, {}, "123", "threads"),
    ],
)
async def test_meta_account_feeds_paginate_only_on_the_official_host(
    platform, adapter_type, metadata, target, edge
):
    now = datetime.now(UTC)
    calls = []

    def handler(request):
        calls.append(request)
        assert request.url.path.endswith(f"/{target}/{edge}")
        permalink_field = "permalink_url" if platform == "facebook" else "permalink"
        assert permalink_field in request.url.params["fields"].split(",")
        second = request.url.params.get("after") == "next"
        return httpx.Response(
            200,
            json={
                "data": [
                    {
                        "id": "2" if second else "1",
                        "text": "Post",
                        "timestamp": (now - timedelta(days=1)).isoformat(),
                        permalink_field: f"https://www.{platform}.com/posts/"
                        + ("2" if second else "1"),
                    }
                ],
                "paging": {}
                if second
                else {"next": "https://attacker.example/steal", "cursors": {"after": "next"}},
            },
        )

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        adapter = adapter_type(http_client=client)
        result = await adapter.fetch_analytics_posts(
            account(platform, metadata), now - timedelta(days=7), now
        )
    assert [p.external_post_id for p in result.posts] == ["1", "2"]
    assert [p.external_url for p in result.posts] == [
        f"https://www.{platform}.com/posts/1",
        f"https://www.{platform}.com/posts/2",
    ]
    assert result.complete
    assert len({r.url.host for r in calls}) == 1
    assert calls[1].url.params["after"] == "next"


@pytest.mark.anyio
async def test_bluesky_feed_uses_oauth_and_excludes_reposts():
    now = datetime.now(UTC)
    calls = []

    def handler(request):
        calls.append(request)
        second = request.url.params.get("cursor") == "next"
        return httpx.Response(
            200,
            json={
                "feed": [
                    {
                        "post": {
                            "uri": "at://did:plc:abc/app.bsky.feed.post/"
                            + ("2" if second else "1"),
                            "author": {"did": "did:plc:abc"},
                            "record": {
                                "text": "Bluesky",
                                "createdAt": (now - timedelta(days=1)).isoformat(),
                            },
                            "likeCount": 10,
                            "replyCount": 2,
                            "repostCount": 3,
                        }
                    }
                ],
                **({} if second else {"cursor": "next"}),
            },
        )

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        result = await BlueskyAdapter(http_client=client).fetch_analytics_posts(
            account("bluesky", {"did": "did:plc:abc", "pds_url": "https://pds.example"}),
            now - timedelta(days=7),
            now,
        )
    assert len(result.posts) == 2
    assert result.posts[0].metrics.likes == 10
    assert "impressions" not in result.posts[0].metrics.extras["available_metrics"]
    assert calls[0].headers["authorization"] == "DPoP access"
    assert calls[0].headers["dpop"]


@pytest.mark.anyio
@pytest.mark.parametrize("has_metadata_id", [True, False])
async def test_mastodon_uses_instance_and_max_id_pagination(has_metadata_id):
    now = datetime.now(UTC)
    calls = []

    def handler(request):
        calls.append(request)
        second = request.url.params.get("max_id") == "next"
        assert request.url.host == "social.example"
        assert request.url.path == "/api/v1/accounts/123/statuses"
        return httpx.Response(
            200,
            json=[
                {
                    "id": "2" if second else "1",
                    "content": "<p>Hello &amp; welcome</p>",
                    "url": "https://social.example/@writer/" + ("2" if second else "1"),
                    "created_at": (now - timedelta(days=1)).isoformat(),
                    "favourites_count": 2,
                    "replies_count": 1,
                    "reblogs_count": 3,
                }
            ],
            headers={}
            if second
            else {"Link": '<https://evil.example/path?max_id=next>; rel="next"'},
        )

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        result = await MastodonAdapter(http_client=client).fetch_analytics_posts(
            account(
                "mastodon",
                {
                    "instance_domain": "social.example",
                    **({"user_id": "123"} if has_metadata_id else {}),
                },
                identifier="123@social.example",
            ),
            now - timedelta(days=7),
            now,
        )
    assert len(result.posts) == 2
    assert result.posts[0].text == "Hello & welcome"
    assert result.posts[0].external_url == "https://social.example/@writer/1"
    assert result.posts[0].metrics.engagements == 6
    assert calls[1].url.params["max_id"] == "next"


@pytest.mark.anyio
@pytest.mark.parametrize("platform", ["bluesky", "mastodon"])
async def test_original_posts_continue_after_reply_only_pages(platform):
    now = datetime.now(UTC)
    calls = []

    def handler(request):
        calls.append(request)
        cursor_key = "cursor" if platform == "bluesky" else "max_id"
        second = request.url.params.get(cursor_key) == "next"
        if platform == "bluesky":
            assert request.url.params["filter"] == "posts_no_replies"
            post = {
                "uri": "at://did:plc:abc/app.bsky.feed.post/" + ("original" if second else "reply"),
                "author": {"did": "did:plc:abc"},
                "record": {
                    "text": "Native post",
                    "createdAt": now.isoformat(),
                    **({} if second else {"reply": {"parent": {"uri": "parent"}}}),
                },
            }
            feed = [{"post": post}]
            if not second:
                feed += [
                    {"post": post, "reason": {"$type": "app.bsky.feed.defs#reasonRepost"}},
                    {"post": {**post, "author": {"did": "did:plc:other"}}},
                ]
            return httpx.Response(
                200, json={"feed": feed, **({} if second else {"cursor": "next"})}
            )
        assert request.url.params["exclude_replies"] == "true"
        assert request.url.params["exclude_reblogs"] == "true"
        post = {
            "id": "original" if second else "self-reply",
            "created_at": now.isoformat(),
            "in_reply_to_id": None if second else "parent",
            "in_reply_to_account_id": None if second else "123",
        }
        return httpx.Response(
            200,
            json=[post] if second else [post, {**post, "id": "boost", "reblog": {"id": "other"}}],
            headers={} if second else {"Link": '<https://social.example/?max_id=next>; rel="next"'},
        )

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        if platform == "bluesky":
            adapter = BlueskyAdapter(http_client=client)
            acc = account(platform, {"did": "did:plc:abc", "pds_url": "https://pds.example"})
        else:
            adapter = MastodonAdapter(http_client=client)
            acc = account(platform, {"instance_domain": "social.example", "user_id": "123"})
        result = await adapter.fetch_analytics_posts(acc, now - timedelta(days=7), now)
    expected = (
        "at://did:plc:abc/app.bsky.feed.post/original" if platform == "bluesky" else "original"
    )
    assert [p.external_post_id for p in result.posts] == [expected]
    assert result.complete
    assert len(calls) == 2


@pytest.mark.anyio
async def test_reddit_reads_submissions_with_user_agent_and_after_cursor():
    now = datetime.now(UTC)
    calls = []

    def handler(request):
        calls.append(request)
        assert request.headers["User-Agent"]
        if request.url.path.endswith("/api/v1/me"):
            return httpx.Response(200, json={"name": "writer"})
        second = request.url.params.get("after") == "next"
        return httpx.Response(
            200,
            json={
                "data": {
                    "children": [
                        {
                            "data": {
                                "name": "t3_2" if second else "t3_1",
                                "title": "Useful title",
                                "selftext": "Body",
                                "created_utc": now.timestamp() - 86400,
                                "ups": 2,
                                "num_comments": 1,
                                "view_count": None,
                            }
                        }
                    ],
                    "after": None if second else "next",
                }
            },
        )

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        result = await RedditAdapter(http_client=client).fetch_analytics_posts(
            account("reddit"), now - timedelta(days=7), now
        )
    assert len(result.posts) == 2
    assert "impressions" not in result.posts[0].metrics.extras["available_metrics"]
    assert all(request.method == "GET" for request in calls)
