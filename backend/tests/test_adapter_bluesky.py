from datetime import UTC, datetime, timedelta
from typing import Any

import httpx
import pytest

from app.modules.channels.adapters.bluesky import (
    BSKY_PUBLIC_API,
    BlueskyAdapter,
    count_graphemes,
    extract_facets,
)
from app.modules.channels.base import PlatformAdapter
from app.modules.channels.models import ConnectedAccount
from app.modules.channels.oauth import decrypt_token, encrypt_token


class MockVariant:
    def __init__(self, payload: dict[str, Any]) -> None:
        self.payload = payload


@pytest.fixture
def mock_bsky_account():
    return ConnectedAccount(
        workspace_id="ws_bsky_123",
        platform="bluesky",
        external_account_id="did:plc:abcdef1234567890",
        display_name="Bluesky Creator (@creator.bsky.social)",
        account_type="profile",
        encrypted_access_token=encrypt_token("bsky_access_jwt_123"),
        encrypted_refresh_token=encrypt_token("bsky_refresh_jwt_456"),
        token_expires_at=datetime.now(UTC) + timedelta(hours=2),
        granted_scopes=["atproto"],
        status="active",
        account_metadata={
            "did": "did:plc:abcdef1234567890",
            "handle": "creator.bsky.social",
            "display_name": "Bluesky Creator",
        },
    )


def test_bluesky_adapter_protocol_conformance():
    adapter = BlueskyAdapter()
    assert isinstance(adapter, PlatformAdapter)
    assert adapter.capabilities.platform == "bluesky"
    assert adapter.capabilities.max_text_length == 300
    assert adapter.capabilities.text_length_type == "graphemes"
    assert adapter.capabilities.supports_media is True
    assert adapter.capabilities.max_media_count == 4
    assert adapter.capabilities.requires_target is False
    assert adapter.capabilities.supports_account_metrics is True


def test_grapheme_counting():
    assert count_graphemes("hello") == 5
    # e with acute combining accent counts as 1 grapheme
    assert count_graphemes("e\u0301") == 1
    # 2 emojis count as 2 graphemes
    assert count_graphemes("🚀🔥") == 2
    # 300 ascii characters = 300 graphemes
    assert count_graphemes("a" * 300) == 300


def test_rich_text_facets_exact_byte_ranges():
    # Multi-byte emoji at start tests UTF-8 byte offsets
    text = "🚀 Check https://postflow.ai and #launch with @alice.bsky.social!"
    text_bytes = text.encode("utf-8")
    facets = extract_facets(text)

    assert len(facets) == 3

    # 1. URL facet
    url_facet = next(f for f in facets if f["features"][0]["$type"] == "app.bsky.feed.post#link")
    b_start = url_facet["index"]["byteStart"]
    b_end = url_facet["index"]["byteEnd"]
    assert text_bytes[b_start:b_end].decode("utf-8") == "https://postflow.ai"
    assert url_facet["features"][0]["uri"] == "https://postflow.ai"

    # 2. Tag facet
    tag_facet = next(f for f in facets if f["features"][0]["$type"] == "app.bsky.feed.post#tag")
    b_start = tag_facet["index"]["byteStart"]
    b_end = tag_facet["index"]["byteEnd"]
    assert text_bytes[b_start:b_end].decode("utf-8") == "#launch"
    assert tag_facet["features"][0]["tag"] == "launch"

    # 3. Mention facet
    mention_facet = next(f for f in facets if f["features"][0]["$type"] == "app.bsky.feed.post#mention")
    b_start = mention_facet["index"]["byteStart"]
    b_end = mention_facet["index"]["byteEnd"]
    assert text_bytes[b_start:b_end].decode("utf-8") == "@alice.bsky.social"


@pytest.mark.anyio
async def test_build_auth_url():
    adapter = BlueskyAdapter(client_id="https://postflow.ai/client-metadata.json")
    res = await adapter.build_auth_url(
        workspace_id="ws_1",
        state="bsky_state_123",
        code_challenge="pkce_challenge_abc",
        redirect_uri="https://postflow.ai/callback",
    )
    assert "https://bsky.social/oauth/authorize" in res.auth_url
    assert "client_id=https%3A%2F%2Fpostflow.ai%2Fclient-metadata.json" in res.auth_url
    assert "code_challenge=pkce_challenge_abc" in res.auth_url
    assert "code_challenge_method=S256" in res.auth_url


@pytest.mark.anyio
async def test_handle_callback_app_password():
    def handler(request: httpx.Request) -> httpx.Response:
        url_str = str(request.url)
        if "com.atproto.server.createSession" in url_str:
            return httpx.Response(
                200,
                json={
                    "accessJwt": "new_access_jwt_777",
                    "refreshJwt": "new_refresh_jwt_888",
                    "did": "did:plc:alice123456",
                    "handle": "alice.bsky.social",
                },
            )
        if "app.bsky.actor.getProfile" in url_str:
            return httpx.Response(
                200,
                json={
                    "displayName": "Alice Wonderland",
                    "avatar": "https://cdn.bsky.app/avatar.jpg",
                },
            )
        return httpx.Response(404)

    mock_client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    adapter = BlueskyAdapter(http_client=mock_client)

    account = await adapter.handle_callback(
        workspace_id="ws_b",
        params={"identifier": "alice.bsky.social", "password": "abcd-efgh-ijkl-mnop"},
        state="state_val",
    )

    assert account.platform == "bluesky"
    assert account.external_account_id == "did:plc:alice123456"
    assert "Alice Wonderland" in account.display_name
    assert decrypt_token(account.encrypted_access_token) == "new_access_jwt_777"
    assert decrypt_token(account.encrypted_refresh_token) == "new_refresh_jwt_888"


@pytest.mark.anyio
async def test_refresh_tokens(mock_bsky_account):
    def handler(request: httpx.Request) -> httpx.Response:
        assert "com.atproto.server.refreshSession" in str(request.url)
        return httpx.Response(
            200,
            json={
                "accessJwt": "refreshed_access_jwt_999",
                "refreshJwt": "refreshed_refresh_jwt_000",
            },
        )

    mock_client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    adapter = BlueskyAdapter(http_client=mock_client)

    updated = await adapter.refresh_tokens(mock_bsky_account)
    assert decrypt_token(updated.encrypted_access_token) == "refreshed_access_jwt_999"
    assert decrypt_token(updated.encrypted_refresh_token) == "refreshed_refresh_jwt_000"
    assert updated.status == "active"


@pytest.mark.anyio
async def test_validate():
    adapter = BlueskyAdapter()

    # Valid post
    issues = await adapter.validate(MockVariant({"text": "Hello Bluesky!"}))
    assert len(issues) == 0

    # Over 300 grapheme limit
    too_long = "a" * 301
    issues = await adapter.validate(MockVariant({"text": too_long}))
    assert len(issues) == 1
    assert issues[0].code == "grapheme_limit_exceeded"

    # Too many images (> 4)
    issues = await adapter.validate(MockVariant({"text": "Photos", "media_blobs": [{"blob": {}}] * 5}))
    assert len(issues) == 1
    assert issues[0].code == "too_many_media"


@pytest.mark.anyio
async def test_publish_success(mock_bsky_account):
    recorded_body: dict[str, Any] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        assert f"{BSKY_PUBLIC_API}/com.atproto.repo.createRecord" in str(request.url)
        assert request.headers["Authorization"] == "Bearer bsky_access_jwt_123"
        import json

        recorded_body.update(json.loads(request.content))
        return httpx.Response(
            200,
            json={
                "uri": "at://did:plc:abcdef1234567890/app.bsky.feed.post/3kxyz123456",
                "cid": "bafyreibcd123456",
            },
        )

    mock_client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    adapter = BlueskyAdapter(http_client=mock_client)

    text = "Building the future of publishing with #postflow at https://postflow.ai"
    result = await adapter.publish(
        mock_bsky_account,
        MockVariant({"text": text}),
    )

    assert result.success is True
    assert result.external_post_id == "at://did:plc:abcdef1234567890/app.bsky.feed.post/3kxyz123456"
    assert "https://bsky.app/profile/creator.bsky.social/post/3kxyz123456" in (result.external_url or "")

    # Verify auto-generated facets were included in payload
    assert recorded_body["collection"] == "app.bsky.feed.post"
    assert "facets" in recorded_body["record"]
    assert len(recorded_body["record"]["facets"]) == 2  # 1 tag + 1 link


@pytest.mark.anyio
async def test_delete_post(mock_bsky_account):
    def handler(request: httpx.Request) -> httpx.Response:
        assert f"{BSKY_PUBLIC_API}/com.atproto.repo.deleteRecord" in str(request.url)
        return httpx.Response(200)

    mock_client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    adapter = BlueskyAdapter(http_client=mock_client)

    await adapter.delete_post(
        mock_bsky_account,
        "at://did:plc:abcdef1234567890/app.bsky.feed.post/3kxyz123456",
    )


@pytest.mark.anyio
async def test_fetch_metrics(mock_bsky_account):
    def handler(request: httpx.Request) -> httpx.Response:
        assert f"{BSKY_PUBLIC_API}/app.bsky.feed.getPostThread" in str(request.url)
        return httpx.Response(
            200,
            json={
                "thread": {
                    "post": {
                        "likeCount": 185,
                        "repostCount": 42,
                        "replyCount": 27,
                        "quoteCount": 11,
                        "cid": "bafyrei999",
                    }
                }
            },
        )

    mock_client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    adapter = BlueskyAdapter(http_client=mock_client)

    metrics = await adapter.fetch_metrics(
        mock_bsky_account,
        "at://did:plc:abcdef1234567890/app.bsky.feed.post/3kxyz123456",
    )
    assert metrics.likes == 185
    assert metrics.comments == 27
    assert metrics.shares_reposts == 42 + 11  # reposts + quotes
    assert metrics.engagements == 185 + 42 + 27 + 11


@pytest.mark.anyio
async def test_fetch_account_metrics(mock_bsky_account):
    """Verify whole-account follower and post analytics from original Bluesky API source."""
    def handler(request: httpx.Request) -> httpx.Response:
        assert f"{BSKY_PUBLIC_API}/app.bsky.actor.getProfile" in str(request.url)
        return httpx.Response(
            200,
            json={
                "did": "did:plc:abcdef1234567890",
                "handle": "creator.bsky.social",
                "followersCount": 9420,
                "followsCount": 350,
                "postsCount": 512,
            },
        )

    mock_client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    adapter = BlueskyAdapter(http_client=mock_client)

    account_metrics = await adapter.fetch_account_metrics(mock_bsky_account)
    assert account_metrics.followers_count == 9420
    assert account_metrics.following_count == 350
    assert account_metrics.posts_count == 512
