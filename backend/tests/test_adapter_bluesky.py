import json
from datetime import UTC, datetime, timedelta
from typing import Any

import httpx
import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ec
from fastapi import HTTPException

from app.db.session import SessionLocal
from app.modules.channels.adapters.bluesky import (
    BSKY_PUBLIC_API,
    BlueskyAdapter,
    count_graphemes,
    extract_facets,
)
from app.modules.channels.base import PlatformAdapter
from app.modules.channels.models import ConnectedAccount
from app.modules.channels.oauth import create_oauth_state, decrypt_token, encrypt_token


class MockVariant:
    def __init__(self, payload: dict[str, Any]) -> None:
        self.payload = payload


def oauth_metadata():
    private = (
        ec.generate_private_key(ec.SECP256R1())
        .private_bytes(
            serialization.Encoding.PEM,
            serialization.PrivateFormat.PKCS8,
            serialization.NoEncryption(),
        )
        .decode()
    )
    return {
        "issuer": "https://bsky.social",
        "token_endpoint": "https://bsky.social/oauth/token",
        "revocation_endpoint": "https://bsky.social/oauth/revoke",
        "pds_url": "https://bsky.social",
        "did": "did:plc:abcdef1234567890",
        "handle": "creator.bsky.social",
        "encrypted_dpop_key": encrypt_token(private),
    }


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
            "oauth": oauth_metadata(),
            "pds_url": "https://bsky.social",
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
    text = "🚀 Check https://draftva.com and #launch with @alice.bsky.social!"
    text_bytes = text.encode("utf-8")
    facets = extract_facets(text, {"alice.bsky.social": "did:plc:alice123456"})

    assert len(facets) == 3

    # 1. URL facet
    url_facet = next(f for f in facets if f["features"][0]["$type"] == "app.bsky.feed.post#link")
    b_start = url_facet["index"]["byteStart"]
    b_end = url_facet["index"]["byteEnd"]
    assert text_bytes[b_start:b_end].decode("utf-8") == "https://draftva.com"
    assert url_facet["features"][0]["uri"] == "https://draftva.com"

    # 2. Tag facet
    tag_facet = next(f for f in facets if f["features"][0]["$type"] == "app.bsky.feed.post#tag")
    b_start = tag_facet["index"]["byteStart"]
    b_end = tag_facet["index"]["byteEnd"]
    assert text_bytes[b_start:b_end].decode("utf-8") == "#launch"
    assert tag_facet["features"][0]["tag"] == "launch"

    # 3. Mention facet
    mention_facet = next(
        f for f in facets if f["features"][0]["$type"] == "app.bsky.feed.post#mention"
    )
    b_start = mention_facet["index"]["byteStart"]
    b_end = mention_facet["index"]["byteEnd"]
    assert text_bytes[b_start:b_end].decode("utf-8") == "@alice.bsky.social"


@pytest.mark.anyio
async def test_build_auth_url_uses_discovery_and_par():
    requests = []

    def handler(request):
        requests.append(request)
        path = request.url.path
        if path.endswith("resolveHandle"):
            return httpx.Response(200, json={"did": "did:plc:abcdef1234567890"})
        if request.url.host == "plc.directory":
            return httpx.Response(
                200,
                json={
                    "id": "did:plc:abcdef1234567890",
                    "service": [
                        {
                            "type": "AtprotoPersonalDataServer",
                            "serviceEndpoint": "https://bsky.social",
                        }
                    ],
                },
            )
        if path.endswith("oauth-protected-resource"):
            return httpx.Response(
                200,
                json={
                    "resource": "https://bsky.social",
                    "authorization_servers": ["https://bsky.social"],
                },
            )
        if path.endswith("oauth-authorization-server"):
            return httpx.Response(
                200,
                json={
                    "issuer": "https://bsky.social",
                    "authorization_endpoint": "https://bsky.social/oauth/authorize",
                    "token_endpoint": "https://bsky.social/oauth/token",
                    "pushed_authorization_request_endpoint": "https://bsky.social/oauth/par",
                    "dpop_signing_alg_values_supported": ["ES256"],
                },
            )
        assert path == "/oauth/par"
        assert request.headers["DPoP"]
        assert b"code_challenge=challenge" in request.content
        return httpx.Response(201, json={"request_uri": "urn:par:example", "expires_in": 90})

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        adapter = BlueskyAdapter(http_client=client)
        with SessionLocal() as db:
            record, raw = create_oauth_state(
                db, "ws1", "user1", "bluesky", code_verifier="verifier"
            )
            result = await adapter.build_auth_url(
                "ws1",
                raw,
                identifier="creator.bsky.social",
                code_challenge="challenge",
                state_record=record,
                db=db,
            )
            assert "request_uri=urn%3Apar%3Aexample" in result.auth_url
            assert "code_challenge" not in result.auth_url
            assert (
                json.loads(decrypt_token(record.encrypted_metadata))["did"]
                == "did:plc:abcdef1234567890"
            )
    assert len(requests) == 5


@pytest.mark.anyio
async def test_app_password_is_rejected():
    with pytest.raises(HTTPException):
        await BlueskyAdapter().handle_callback(
            "ws", {"identifier": "alice.bsky.social", "password": "not-supported"}, "state"
        )


@pytest.mark.anyio
async def test_oauth_callback(mock_bsky_account):
    def handler(request):
        if request.url.path == "/xrpc/app.bsky.actor.getProfile":
            return httpx.Response(
                200,
                json={
                    "did": mock_bsky_account.external_account_id,
                    "handle": "mockuser.bsky.social",
                    "displayName": "Mock User",
                    "avatar": "https://cdn.bsky.app/avatar.jpg",
                },
            )
        assert request.url.path == "/oauth/token"
        assert request.headers["DPoP"]
        return httpx.Response(
            200,
            json={
                "access_token": "new_access",
                "refresh_token": "new_refresh",
                "sub": mock_bsky_account.external_account_id,
                "token_type": "DPoP",
                "expires_in": 300,
            },
        )

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        account = await BlueskyAdapter(http_client=client).handle_callback(
            "ws",
            {"code": "code", "iss": "https://bsky.social"},
            "state",
            oauth_metadata=mock_bsky_account.account_metadata["oauth"],
            code_verifier="verifier",
        )
    assert decrypt_token(account.encrypted_access_token) == "new_access"
    assert account.account_metadata["pds_url"] == "https://bsky.social"
    assert account.account_metadata["avatar_url"] == "https://cdn.bsky.app/avatar.jpg"
    assert account.avatar_url == "https://cdn.bsky.app/avatar.jpg"


@pytest.mark.anyio
async def test_refresh_tokens(mock_bsky_account):
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/oauth/token"
        assert b"grant_type=refresh_token" in request.content
        assert request.headers["DPoP"]
        return httpx.Response(
            200,
            json={
                "access_token": "refreshed_access_jwt_999",
                "refresh_token": "refreshed_refresh_jwt_000",
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
    issues = await adapter.validate(
        MockVariant({"text": "Photos", "media_blobs": [{"blob": {}}] * 5})
    )
    assert len(issues) == 1
    assert issues[0].code == "too_many_media"


@pytest.mark.anyio
async def test_publish_success(mock_bsky_account):
    recorded_body: dict[str, Any] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        assert f"{BSKY_PUBLIC_API}/com.atproto.repo.createRecord" in str(request.url)
        assert request.headers["Authorization"] == "DPoP bsky_access_jwt_123"
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

    text = "Building the future of publishing with #draftva at https://draftva.com"
    result = await adapter.publish(
        mock_bsky_account,
        MockVariant({"text": text}),
    )

    assert result.success is True
    assert result.external_post_id == "at://did:plc:abcdef1234567890/app.bsky.feed.post/3kxyz123456"
    assert "https://bsky.app/profile/creator.bsky.social/post/3kxyz123456" in (
        result.external_url or ""
    )

    # Verify auto-generated facets were included in payload
    assert recorded_body["collection"] == "app.bsky.feed.post"
    assert "facets" in recorded_body["record"]
    assert len(recorded_body["record"]["facets"]) == 2  # 1 tag + 1 link


@pytest.mark.anyio
async def test_publish_with_images_preserves_aspect_ratio(mock_bsky_account):
    recorded_body: dict[str, Any] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        import json

        recorded_body.update(json.loads(request.content))
        return httpx.Response(
            200,
            json={
                "uri": "at://did:plc:abcdef1234567890/app.bsky.feed.post/3kxyz999999",
                "cid": "bafyreibcd999999",
            },
        )

    mock_client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    adapter = BlueskyAdapter(http_client=mock_client)

    result = await adapter.publish(
        mock_bsky_account,
        MockVariant(
            {
                "text": "Post with uncropped photo",
                "media_blobs": [
                    {
                        "blob": {"$type": "blob", "ref": {"$link": "blob1"}},
                        "alt": "A full portrait photo",
                        "aspect_ratio": {"width": 1080, "height": 1350},
                    }
                ],
            }
        ),
    )

    assert result.success is True
    images = recorded_body["record"]["embed"]["images"]
    assert len(images) == 1
    assert images[0]["alt"] == "A full portrait photo"
    assert images[0]["aspectRatio"] == {"width": 1080, "height": 1350}


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


@pytest.mark.anyio
@pytest.mark.parametrize(
    "body",
    [
        b'{"error_description":"PRIVATE_PROVIDER_DATA"}',
        b'["PRIVATE_PROVIDER_DATA"]',
        b"PRIVATE_PROVIDER_DATA",
    ],
)
async def test_authorization_rejection_never_leaks_provider_response(body, caplog):
    def handler(request):
        path = request.url.path
        if path.endswith("resolveHandle"):
            return httpx.Response(200, json={"did": "did:plc:fixture"})
        if request.url.host == "plc.directory":
            return httpx.Response(
                200,
                json={
                    "id": "did:plc:fixture",
                    "service": [
                        {
                            "type": "AtprotoPersonalDataServer",
                            "serviceEndpoint": "https://bsky.social",
                        }
                    ],
                },
            )
        if path.endswith("oauth-protected-resource"):
            return httpx.Response(
                200,
                json={
                    "resource": "https://bsky.social",
                    "authorization_servers": ["https://bsky.social"],
                },
            )
        if path.endswith("oauth-authorization-server"):
            return httpx.Response(
                200,
                json={
                    "issuer": "https://bsky.social",
                    "authorization_endpoint": "https://bsky.social/oauth/authorize",
                    "token_endpoint": "https://bsky.social/oauth/token",
                    "pushed_authorization_request_endpoint": "https://bsky.social/oauth/par",
                    "dpop_signing_alg_values_supported": ["ES256"],
                },
            )
        return httpx.Response(400, content=body)

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        adapter = BlueskyAdapter(http_client=client)
        with pytest.raises(HTTPException) as raised:
            await adapter.build_auth_url(
                "workspace", "state", identifier="creator.bsky.social", code_challenge="challenge"
            )
    assert raised.value.status_code == 502
    assert "PRIVATE_PROVIDER_DATA" not in str(raised.value.detail) + caplog.text
