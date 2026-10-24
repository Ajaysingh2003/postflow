from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from typing import Any

import httpx
import pytest
from fastapi import HTTPException

from app.modules.channels.adapters.media import upload_x
from app.modules.channels.adapters.x import X_API_BASE, X_TOKEN_URL, XAdapter
from app.modules.channels.base import PlatformAdapter
from app.modules.channels.models import ConnectedAccount
from app.modules.channels.oauth import decrypt_token, encrypt_token


@pytest.mark.anyio
async def test_x_audience_and_disclosures_are_forwarded(mock_account):
    sent = []

    def handler(request):
        import json

        sent.append(json.loads(request.content))
        return httpx.Response(201, json={"data": {"id": "post_123"}})

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        adapter = XAdapter(http_client=client)
        payload = {"text": "A post", "reply_settings": "following", "paid_partnership": True, "made_with_ai": False}
        assert not await adapter.validate(MockVariant(payload))
        result = await adapter.publish(mock_account, MockVariant(payload))
        assert result.success
        assert sent == [payload]
        invalid = await adapter.validate(MockVariant({"text": "A post", "reply_settings": "everyone", "made_with_ai": "yes"}))
        assert {issue.field for issue in invalid} == {"reply_settings", "made_with_ai"}


@pytest.mark.anyio
async def test_x_thread_attachment_is_sent_with_first_item(mock_account, monkeypatch):
    monkeypatch.setattr("app.modules.channels.adapters.media.service.read_ready", lambda *_: b"image")

    def handler(request):
        return httpx.Response(200, json={"data": {"id": "media_1"}})

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        adapter = XAdapter(http_client=client)
        variant = SimpleNamespace(payload={"thread": [{"text": "First", "paid_partnership": True}, {"text": "Second"}]}, publish_state={})
        await upload_x(adapter, mock_account, variant, [(SimpleNamespace(id="asset_1", content_type="image/jpeg"), "")])
        assert variant.payload["thread"][0] == {"text": "First", "paid_partnership": True, "media_ids": ["media_1"], "media_asset_ids": ["asset_1"]}
        assert variant.payload["thread"][1] == {"text": "Second", "media_ids": [], "media_asset_ids": []}
        assert "media_ids" not in variant.payload


class MockVariant:
    def __init__(self, payload: dict[str, Any]) -> None:
        self.payload = payload


@pytest.fixture
def mock_account():
    return ConnectedAccount(
        workspace_id="ws_123",
        platform="x",
        external_account_id="x_user_999",
        display_name="Test X Account (@testx)",
        account_type="profile",
        encrypted_access_token=encrypt_token("x_access_token_abc"),
        encrypted_refresh_token=encrypt_token("x_refresh_token_xyz"),
        token_expires_at=datetime.now(UTC) + timedelta(hours=2),
        granted_scopes=["tweet.read", "tweet.write", "users.read", "media.write", "offline.access"],
        status="active",
        account_metadata={"username": "testx"},
    )


def test_x_adapter_conforms_to_protocol():
    adapter = XAdapter(client_id="test_id", client_secret="test_secret")
    assert isinstance(adapter, PlatformAdapter)
    assert adapter.capabilities.platform == "x"
    assert adapter.capabilities.max_text_length == 280
    assert adapter.capabilities.supports_media is True
    assert adapter.capabilities.max_media_count == 4
    assert adapter.capabilities.requires_target is False
    assert adapter.capabilities.supports_account_metrics is True


@pytest.mark.anyio
async def test_build_auth_url():
    adapter = XAdapter(client_id="test_x_client_id")

    # Missing code_challenge raises 400
    with pytest.raises(HTTPException) as exc:
        await adapter.build_auth_url(workspace_id="ws_1", state="my_state")
    assert exc.value.status_code == 400

    # Valid call produces proper OAuth URL with PKCE
    res = await adapter.build_auth_url(
        workspace_id="ws_1",
        state="my_state",
        code_challenge="challenge_s256_hash",
        redirect_uri="https://draftva.com/callback",
    )
    assert "https://twitter.com/i/oauth2/authorize" in res.auth_url
    assert "client_id=test_x_client_id" in res.auth_url
    assert "code_challenge=challenge_s256_hash" in res.auth_url
    assert "code_challenge_method=S256" in res.auth_url
    assert "tweet.write" in res.auth_url
    assert "media.write" in res.auth_url
    assert "media.write" in res.metadata["requested_scopes"]
    assert res.state == "my_state"


@pytest.mark.anyio
async def test_handle_callback_success():
    def handler(request: httpx.Request) -> httpx.Response:
        url_str = str(request.url)
        if url_str == X_TOKEN_URL:
            return httpx.Response(
                200,
                json={
                    "access_token": "new_access_token_123",
                    "refresh_token": "new_refresh_token_456",
                    "expires_in": 7200,
                    "scope": "tweet.read tweet.write users.read offline.access",
                },
            )
        if f"{X_API_BASE}/users/me" in url_str:
            return httpx.Response(
                200,
                json={
                    "data": {
                        "id": "2244994945",
                        "name": "draftva AI",
                        "username": "draftva_ai",
                        "profile_image_url": "https://pbs.twimg.com/profile_images/pic.png",
                        "public_metrics": {
                            "followers_count": 8500,
                            "following_count": 120,
                            "tweet_count": 450,
                        },
                    }
                },
            )
        return httpx.Response(404)

    mock_client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    adapter = XAdapter(client_id="cid", client_secret="csec", http_client=mock_client)

    account = await adapter.handle_callback(
        workspace_id="ws_abc",
        params={"code": "auth_code_from_x"},
        state="state_123",
        code_verifier="pkce_verifier_secret",
        redirect_uri="https://draftva.com/callback",
    )

    assert account.platform == "x"
    assert account.external_account_id == "2244994945"
    assert account.display_name == "draftva AI (@draftva_ai)"
    assert decrypt_token(account.encrypted_access_token) == "new_access_token_123"
    assert decrypt_token(account.encrypted_refresh_token) == "new_refresh_token_456"
    assert account.account_metadata["username"] == "draftva_ai"
    assert "public_metrics" not in account.account_metadata
    assert "media.write" not in account.granted_scopes


@pytest.mark.anyio
async def test_refresh_tokens_success(mock_account):
    def handler(request: httpx.Request) -> httpx.Response:
        assert str(request.url) == X_TOKEN_URL
        return httpx.Response(
            200,
            json={
                "access_token": "refreshed_x_access_token_999",
                "refresh_token": "refreshed_x_refresh_token_888",
                "expires_in": 7200,
            },
        )

    mock_client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    adapter = XAdapter(client_id="cid", client_secret="csec", http_client=mock_client)

    updated = await adapter.refresh_tokens(mock_account)
    assert decrypt_token(updated.encrypted_access_token) == "refreshed_x_access_token_999"
    assert decrypt_token(updated.encrypted_refresh_token) == "refreshed_x_refresh_token_888"
    assert updated.status == "active"


@pytest.mark.anyio
async def test_refresh_tokens_failure(mock_account):
    def handler(_: httpx.Request) -> httpx.Response:
        return httpx.Response(400, json={"error": "invalid_grant", "error_description": "Refresh token expired"})

    mock_client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    adapter = XAdapter(client_id="cid", client_secret="csec", http_client=mock_client)

    with pytest.raises(RuntimeError) as exc:
        await adapter.refresh_tokens(mock_account)
    assert "HTTP 400" in str(exc.value)
    assert "Refresh token expired" not in str(exc.value)


@pytest.mark.anyio
async def test_validate():
    adapter = XAdapter()

    # Valid tweet
    issues = await adapter.validate(MockVariant({"text": "Hello world from draftva!"}))
    assert len(issues) == 0

    # Over character limit (> 280 characters)
    too_long = "x" * 281
    issues = await adapter.validate(MockVariant({"text": too_long}))
    assert len(issues) == 1
    assert issues[0].code == "text_too_long"

    # Too many media attachments (> 4)
    issues = await adapter.validate(MockVariant({"text": "Check these", "media_ids": ["1", "2", "3", "4", "5"]}))
    assert len(issues) == 1
    assert issues[0].code == "too_many_media"

    # Empty payload
    issues = await adapter.validate(MockVariant({"text": ""}))
    assert len(issues) == 1
    assert issues[0].field == "text"


@pytest.mark.anyio
async def test_publish_success(mock_account):
    def handler(request: httpx.Request) -> httpx.Response:
        assert str(request.url) == f"{X_API_BASE}/tweets"
        assert request.headers["Authorization"] == "Bearer x_access_token_abc"
        return httpx.Response(
            201,
            json={
                "data": {
                    "id": "1445880548472328192",
                    "text": "draftva scheduled tweet",
                }
            },
        )

    mock_client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    adapter = XAdapter(http_client=mock_client)

    result = await adapter.publish(
        mock_account,
        MockVariant({"text": "draftva scheduled tweet", "media_ids": ["media_1"]}),
    )
    assert result.success is True
    assert result.external_post_id == "1445880548472328192"
    assert result.external_url == "https://x.com/i/web/status/1445880548472328192"


@pytest.mark.anyio
async def test_publish_rate_limit_retryable(mock_account):
    def handler(_: httpx.Request) -> httpx.Response:
        return httpx.Response(429, text="Rate limit exceeded")

    mock_client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    adapter = XAdapter(http_client=mock_client)

    result = await adapter.publish(mock_account, MockVariant({"text": "Some text"}))
    assert result.success is False
    assert result.is_retryable is True
    assert "HTTP 429" in (result.error_message or "")


@pytest.mark.anyio
async def test_publish_auth_error_not_retryable(mock_account):
    def handler(_: httpx.Request) -> httpx.Response:
        return httpx.Response(401, text="Unauthorized: Token expired or invalid")

    mock_client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    adapter = XAdapter(http_client=mock_client)

    result = await adapter.publish(mock_account, MockVariant({"text": "Some text"}))
    assert result.success is False
    assert result.is_retryable is False


@pytest.mark.anyio
async def test_fetch_metrics(mock_account):
    def handler(request: httpx.Request) -> httpx.Response:
        assert str(request.url).startswith(f"{X_API_BASE}/tweets/tweet_123")
        return httpx.Response(
            200,
            json={
                "data": {
                    "id": "tweet_123",
                    "public_metrics": {
                        "retweet_count": 14,
                        "reply_count": 6,
                        "like_count": 95,
                        "quote_count": 3,
                        "bookmark_count": 12,
                        "impression_count": 2500,
                    },
                    "organic_metrics": {
                        "impression_count": 2500,
                        "like_count": 95,
                        "reply_count": 6,
                        "retweet_count": 14,
                        "url_link_clicks": 38,
                    },
                    "non_public_metrics": {"engagements": 156, "url_link_clicks": 38},
                }
            },
        )

    mock_client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    adapter = XAdapter(http_client=mock_client)

    metrics = await adapter.fetch_metrics(mock_account, "tweet_123")
    assert metrics.impressions == 2500
    assert metrics.likes == 95
    assert metrics.comments == 6
    assert metrics.shares_reposts == 17  # 14 retweets + 3 quotes
    assert metrics.clicks == 38
    assert metrics.engagements == 156
    assert metrics.extras["bookmark_count"] == 12
    assert metrics.extras["metrics_status"] == "available"


@pytest.mark.anyio
async def test_fetch_account_metrics(mock_account):
    """Verify whole-account analytics fetched from the official X API source."""
    def handler(request: httpx.Request) -> httpx.Response:
        assert str(request.url).startswith(f"{X_API_BASE}/users/me")
        return httpx.Response(
            200,
            json={
                "data": {
                    "id": "x_user_999",
                    "public_metrics": {
                        "followers_count": 14250,
                        "following_count": 310,
                        "tweet_count": 890,
                        "listed_count": 45,
                    },
                }
            },
        )

    mock_client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    adapter = XAdapter(http_client=mock_client)

    account_metrics = await adapter.fetch_account_metrics(mock_account)
    assert account_metrics.followers_count == 14250
    assert account_metrics.following_count == 310
    assert account_metrics.posts_count == 890
    assert account_metrics.extras["listed_count"] == 45
