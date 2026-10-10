from datetime import UTC, datetime, timedelta
from typing import Any

import httpx
import pytest

from app.modules.channels.adapters.instagram import (
    GRAPH_API_BASE,
    INSTAGRAM_GRAPH_BASE,
    INSTAGRAM_TOKEN_URL,
    InstagramAdapter,
)
from app.modules.channels.base import PlatformAdapter
from app.modules.channels.models import ConnectedAccount
from app.modules.channels.oauth import decrypt_token, encrypt_token


class MockVariant:
    def __init__(self, payload: dict[str, Any]) -> None:
        self.payload = payload


@pytest.fixture
def mock_instagram_account():
    return ConnectedAccount(
        workspace_id="ws_ig_1",
        platform="instagram",
        external_account_id="ig_17841405822383",
        display_name="@acme_creative (Instagram)",
        account_type="business",
        encrypted_access_token=encrypt_token("ig_user_token_abc"),
        token_expires_at=datetime.now(UTC) + timedelta(days=60),
        granted_scopes=[
            "instagram_business_basic",
            "instagram_business_content_publish",
            "instagram_business_manage_insights",
        ],
        status="active",
        account_metadata={
            "oauth_flow": "instagram_login",
            "primary_ig_id": "17841405822383",
            "primary_username": "acme_creative",
            "instagram_accounts": [
                {
                    "id": "17841405822383",
                    "username": "acme_creative",
                    "name": "Acme Creative Studio",
                    "followers_count": 28400,
                }
            ],
            "ig_tokens": {
                "17841405822383": encrypt_token("ig_user_token_abc"),
            },
        },
    )


def test_instagram_adapter_protocol_conformance():
    adapter = InstagramAdapter()
    assert isinstance(adapter, PlatformAdapter)
    assert adapter.capabilities.platform == "instagram"
    assert adapter.capabilities.max_text_length == 2200
    assert adapter.capabilities.supports_media is True
    assert adapter.capabilities.requires_target is True
    assert adapter.capabilities.target_type_name == "instagram_account"
    assert adapter.capabilities.supports_account_metrics is True


@pytest.mark.anyio
async def test_build_auth_url():
    adapter = InstagramAdapter(app_id="ig_app_id_123", app_secret="ig_secret")
    res = await adapter.build_auth_url(
        workspace_id="ws_1",
        state="ig_state_777",
        redirect_uri="https://draftva.com/callback",
    )
    assert res.auth_url.startswith("https://www.instagram.com/oauth/authorize?")
    assert "client_id=ig_app_id_123" in res.auth_url
    assert "state=ig_state_777" in res.auth_url
    assert "instagram_business_content_publish" in res.auth_url


@pytest.mark.anyio
async def test_handle_callback_discovers_authorized_instagram_account():
    from urllib.parse import parse_qs

    calls = []
    redirect = "https://draftva.com/api/v1/channels/instagram/callback"

    def handler(request: httpx.Request) -> httpx.Response:
        calls.append(request)
        assert request.url.host != "graph.facebook.com"
        if str(request.url) == INSTAGRAM_TOKEN_URL:
            assert request.method == "POST"
            assert request.headers["content-type"].startswith("application/x-www-form-urlencoded")
            assert parse_qs(request.content.decode()) == {
                "client_id": ["ig_app_id"],
                "client_secret": ["ig_secret"],
                "grant_type": ["authorization_code"],
                "redirect_uri": [redirect],
                "code": ["oauth_code_ig"],
            }
            return httpx.Response(
                200, json={"access_token": "short_ig_token", "user_id": "scoped_id"}
            )
        if request.url.path == "/access_token":
            assert str(request.url).startswith(INSTAGRAM_GRAPH_BASE + "/access_token?")
            assert dict(request.url.params) == {
                "grant_type": "ig_exchange_token",
                "client_secret": "ig_secret",
                "access_token": "short_ig_token",
            }
            return httpx.Response(
                200, json={"access_token": "ig_long_token_333", "expires_in": 5184000}
            )
        if request.url.path.endswith("/me"):
            assert request.url.params["access_token"] == "ig_long_token_333"
            return httpx.Response(
                200,
                json={
                    "id": "scoped_id",
                    "user_id": "17841405822383",
                    "username": "acme_creative",
                    "name": "Acme Creative Studio",
                    "account_type": "MEDIA_CREATOR",
                    "followers_count": 28400,
                },
            )
        pytest.fail(f"Unexpected Instagram request: {request.url.path}")

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as mock_client:
        adapter = InstagramAdapter(
            app_id="ig_app_id", app_secret="ig_secret", http_client=mock_client
        )
        account = await adapter.handle_callback(
            workspace_id="ws_ig",
            params={"code": "oauth_code_ig#_"},
            state="state_xyz",
            redirect_uri=redirect,
        )
    assert len(calls) == 3
    assert account.platform == "instagram"
    assert account.external_account_id == "ig_17841405822383"
    assert account.account_type == "creator"
    assert "@acme_creative" in account.display_name
    assert decrypt_token(account.encrypted_access_token) == "ig_long_token_333"
    assert account.encrypted_access_token != "ig_long_token_333"
    assert account.account_metadata["oauth_flow"] == "instagram_login"
    assert "ig_tokens" not in account.account_metadata
    assert account.account_metadata["instagram_accounts"][0]["username"] == "acme_creative"
    assert "followers_count" not in account.account_metadata["instagram_accounts"][0]


@pytest.mark.anyio
async def test_list_targets(mock_instagram_account):
    adapter = InstagramAdapter()
    targets = await adapter.list_targets(mock_instagram_account)
    assert len(targets) == 1
    assert targets[0].id == "17841405822383"
    assert targets[0].name == "@acme_creative"
    assert targets[0].target_type == "instagram_account"


@pytest.mark.anyio
async def test_validate():
    adapter = InstagramAdapter()

    # Valid post with image attachment
    issues = await adapter.validate(
        MockVariant(
            {
                "target_id": "17841405822383",
                "image_url": "https://cdn.draftva.ai/photo.jpg",
                "caption": "Enjoying the sunset #goldenhour #photography",
            }
        )
    )
    assert len(issues) == 0

    # Missing target account
    issues = await adapter.validate(MockVariant({"image_url": "https://cdn.draftva.ai/photo.jpg"}))
    assert len(issues) == 1
    assert issues[0].code == "missing_instagram_target"

    # Missing media (Instagram strictly requires media attachments)
    issues = await adapter.validate(
        MockVariant({"target_id": "17841405822383", "caption": "Text only"})
    )
    assert len(issues) == 1
    assert issues[0].code == "media_required"

    # Caption exceeding 2,200 characters
    issues = await adapter.validate(
        MockVariant(
            {
                "target_id": "17841405822383",
                "image_url": "https://cdn.draftva.ai/photo.jpg",
                "caption": "A" * 2201,
            }
        )
    )
    assert len(issues) == 1
    assert issues[0].code == "caption_too_long"

    # More than 30 hashtags
    many_hashtags = " ".join([f"#tag{i}" for i in range(35)])
    issues = await adapter.validate(
        MockVariant(
            {
                "target_id": "17841405822383",
                "image_url": "https://cdn.draftva.ai/photo.jpg",
                "caption": f"Tags: {many_hashtags}",
            }
        )
    )
    assert len(issues) == 1
    assert issues[0].code == "too_many_hashtags"


@pytest.mark.anyio
async def test_publish_single_image(mock_instagram_account):
    """Verify two-step container creation and publishing pipeline for a single image."""
    created_containers: list[dict[str, Any]] = []
    published_containers: list[dict[str, Any]] = []

    def handler(request: httpx.Request) -> httpx.Response:
        url_str = str(request.url)
        import urllib.parse

        if request.method == "GET" and "fields=status_code" in str(request.url):
            return httpx.Response(200, json={"status_code": "FINISHED"})
        form_data = dict(urllib.parse.parse_qsl(request.content.decode("utf-8")))

        if request.method == "GET" and "permalink" not in str(request.url):
            return httpx.Response(200, json={"status_code": "FINISHED"})
        # Step 1: Create Container
        if url_str == f"{GRAPH_API_BASE}/17841405822383/media":
            created_containers.append(form_data)
            return httpx.Response(200, json={"id": "container_id_999"})

        # Step 2: Publish Container
        if url_str == f"{GRAPH_API_BASE}/17841405822383/media_publish":
            published_containers.append(form_data)
            return httpx.Response(200, json={"id": "ig_media_id_777"})

        # Step 3: Permalink query
        if f"{GRAPH_API_BASE}/ig_media_id_777" in url_str:
            return httpx.Response(200, json={"permalink": "https://www.instagram.com/p/Cxyz12345/"})

        return httpx.Response(404)

    mock_client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    adapter = InstagramAdapter(http_client=mock_client)

    result = await adapter.publish(
        mock_instagram_account,
        MockVariant(
            {
                "target_id": "17841405822383",
                "image_url": "https://cdn.draftva.ai/images/product.jpg",
                "caption": "Our new creation is now live!",
            }
        ),
    )

    assert result.success is True
    assert result.external_post_id == "ig_media_id_777"
    # The remote post ID is authoritative; permalink fetching is optional.
    assert result.external_post_id == "ig_media_id_777"

    # Verify Step 1 parameters
    assert created_containers[0]["image_url"] == "https://cdn.draftva.ai/images/product.jpg"
    assert created_containers[0]["caption"] == "Our new creation is now live!"
    assert created_containers[0]["access_token"] == "ig_user_token_abc"

    # Verify Step 2 parameters
    assert published_containers[0]["creation_id"] == "container_id_999"
    assert published_containers[0]["access_token"] == "ig_user_token_abc"


@pytest.mark.anyio
async def test_publish_reel(mock_instagram_account):
    """Verify publishing a Reel with media_type=REELS."""
    recorded_container: dict[str, Any] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        url_str = str(request.url)
        import urllib.parse

        if request.method == "GET" and "fields=status_code" in str(request.url):
            return httpx.Response(200, json={"status_code": "FINISHED"})
        form_data = dict(urllib.parse.parse_qsl(request.content.decode("utf-8")))
        if url_str == f"{GRAPH_API_BASE}/17841405822383/media":
            recorded_container.update(form_data)
            return httpx.Response(200, json={"id": "reel_container_111"})
        if url_str == f"{GRAPH_API_BASE}/17841405822383/media_publish":
            return httpx.Response(200, json={"id": "reel_media_id_222"})
        if "reel_media_id_222" in url_str:
            return httpx.Response(
                200, json={"permalink": "https://www.instagram.com/reel/Cxyz999/"}
            )
        return httpx.Response(404)

    mock_client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    adapter = InstagramAdapter(http_client=mock_client)

    result = await adapter.publish(
        mock_instagram_account,
        MockVariant(
            {
                "target_id": "17841405822383",
                "video_url": "https://cdn.draftva.ai/video/clip.mp4",
                "caption": "Short behind the scenes Reel #bts",
                "media_type": "REELS",
            }
        ),
    )

    assert result.success is True
    assert result.external_post_id == "reel_media_id_222"
    assert result.external_post_id == "reel_media_id_222"
    assert recorded_container["media_type"] == "REELS"
    assert recorded_container["video_url"] == "https://cdn.draftva.ai/video/clip.mp4"


@pytest.mark.anyio
async def test_publish_carousel(mock_instagram_account):
    """Verify carousel publishing with multi-step item containers."""
    created_items: list[dict[str, Any]] = []
    created_parent: dict[str, Any] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        url_str = str(request.url)
        import urllib.parse

        if request.method == "GET" and "fields=status_code" in str(request.url):
            return httpx.Response(200, json={"status_code": "FINISHED"})
        form_data = dict(urllib.parse.parse_qsl(request.content.decode("utf-8")))
        if url_str == f"{GRAPH_API_BASE}/17841405822383/media":
            if form_data.get("is_carousel_item") == "true":
                created_items.append(form_data)
                return httpx.Response(200, json={"id": f"item_id_{len(created_items)}"})
            if form_data.get("media_type") == "CAROUSEL":
                created_parent.update(form_data)
                return httpx.Response(200, json={"id": "parent_carousel_container_555"})
        if url_str == f"{GRAPH_API_BASE}/17841405822383/media_publish":
            return httpx.Response(200, json={"id": "carousel_media_id_666"})
        if "carousel_media_id_666" in url_str:
            return httpx.Response(
                200, json={"permalink": "https://www.instagram.com/p/Carousel123/"}
            )
        return httpx.Response(404)

    mock_client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    adapter = InstagramAdapter(http_client=mock_client)

    result = await adapter.publish(
        mock_instagram_account,
        MockVariant(
            {
                "target_id": "17841405822383",
                "media_urls": [
                    "https://cdn.draftva.ai/slide1.jpg",
                    "https://cdn.draftva.ai/slide2.jpg",
                ],
                "caption": "Swipe left for carousel insights!",
            }
        ),
    )

    assert result.success is True
    assert result.external_post_id == "carousel_media_id_666"
    assert len(created_items) == 2
    assert created_parent["media_type"] == "CAROUSEL"
    assert created_parent["children"] == "item_id_1,item_id_2"


@pytest.mark.anyio
async def test_fetch_metrics(mock_instagram_account):
    def handler(request: httpx.Request) -> httpx.Response:
        url_str = str(request.url)
        if "/insights" in url_str:
            return httpx.Response(
                200,
                json={
                    "data": [
                        {"name": "views", "values": [{"value": 8500}]},
                        {"name": "reach", "values": [{"value": 7200}]},
                        {"name": "saved", "values": [{"value": 115}]},
                        {"name": "shares", "values": [{"value": 48}]},
                    ]
                },
            )
        return httpx.Response(
            200,
            json={
                "id": "ig_media_123",
                "like_count": 480,
                "comments_count": 62,
                "permalink": "https://www.instagram.com/p/AbcDef/",
            },
        )

    mock_client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    adapter = InstagramAdapter(http_client=mock_client)

    metrics = await adapter.fetch_metrics(mock_instagram_account, "ig_media_123")
    assert metrics.likes == 480
    assert metrics.comments == 62
    assert metrics.shares_reposts == 48
    assert metrics.views == 8500
    assert metrics.reach == 7200
    assert metrics.extras["saved"] == 115


@pytest.mark.anyio
async def test_fetch_account_metrics(mock_instagram_account):
    """Verify whole-account follower and view analytics from original Instagram Graph API source."""

    def handler(request: httpx.Request) -> httpx.Response:
        url_str = str(request.url)
        if "/insights" in url_str:
            return httpx.Response(
                200,
                json={
                    "data": [
                        {"name": "views", "values": [{"value": 142000}]},
                        {"name": "profile_views", "values": [{"value": 3600}]},
                        {"name": "reach", "values": [{"value": 98000}]},
                    ]
                },
            )
        return httpx.Response(
            200,
            json={
                "id": "17841405822383",
                "name": "Acme Creative Studio",
                "username": "acme_creative",
                "followers_count": 28400,
                "follows_count": 450,
                "media_count": 182,
            },
        )

    mock_client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    adapter = InstagramAdapter(http_client=mock_client)

    account_metrics = await adapter.fetch_account_metrics(mock_instagram_account)
    assert account_metrics.followers_count == 28400
    assert account_metrics.following_count == 450
    assert account_metrics.posts_count == 182
    assert account_metrics.views == 142000
    assert account_metrics.profile_views == 3600
    assert account_metrics.reach == 98000
