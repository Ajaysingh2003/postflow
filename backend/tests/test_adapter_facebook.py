from datetime import UTC, datetime, timedelta
from typing import Any

import httpx
import pytest

from app.modules.channels.adapters.facebook import (
    GRAPH_API_BASE,
    FacebookAdapter,
)
from app.modules.channels.base import PlatformAdapter
from app.modules.channels.models import ConnectedAccount
from app.modules.channels.oauth import decrypt_token, encrypt_token


class MockVariant:
    def __init__(self, payload: dict[str, Any]) -> None:
        self.payload = payload


@pytest.fixture
def mock_facebook_account():
    return ConnectedAccount(
        workspace_id="ws_fb_123",
        platform="facebook",
        external_account_id="fb_user_555666",
        display_name="Marketing Lead (Facebook Pages)",
        account_type="business",
        encrypted_access_token=encrypt_token("fb_long_lived_user_token_abc"),
        token_expires_at=datetime.now(UTC) + timedelta(days=60),
        granted_scopes=["pages_show_list", "pages_manage_posts", "pages_read_engagement"],
        status="active",
        account_metadata={
            "fb_user_id": "555666",
            "page_tokens": {
                "page_111": encrypt_token("page_access_token_111"),
                "page_222": encrypt_token("page_access_token_222"),
            },
            "pages": [
                {"id": "page_111", "name": "Acme Brand", "category": "Brand", "fan_count": 18500},
                {"id": "page_222", "name": "Acme Support", "category": "Support", "fan_count": 4200},
            ],
        },
    )


def test_facebook_adapter_protocol_conformance():
    adapter = FacebookAdapter()
    assert isinstance(adapter, PlatformAdapter)
    assert adapter.capabilities.platform == "facebook"
    assert adapter.capabilities.max_text_length == 63206
    assert adapter.capabilities.supports_media is True
    assert adapter.capabilities.requires_target is True
    assert adapter.capabilities.target_type_name == "page"
    assert adapter.capabilities.supports_account_metrics is True


@pytest.mark.anyio
async def test_build_auth_url():
    adapter = FacebookAdapter(app_id="fb_app_id_999")
    res = await adapter.build_auth_url(
        workspace_id="ws_1",
        state="fb_state_xyz",
        redirect_uri="https://postflow.ai/callback",
    )
    assert "https://www.facebook.com/v21.0/dialog/oauth" in res.auth_url
    assert "client_id=fb_app_id_999" in res.auth_url
    assert "state=fb_state_xyz" in res.auth_url
    assert "pages_manage_posts" in res.auth_url


@pytest.mark.anyio
async def test_handle_callback_three_step_ladder():
    """Verify short-lived -> long-lived user token exchange and page tokens retrieval."""
    def handler(request: httpx.Request) -> httpx.Response:
        url_str = str(request.url)
        # Step 1 & 2: Token exchange
        if "/oauth/access_token" in url_str:
            if "grant_type=fb_exchange_token" in url_str:
                return httpx.Response(
                    200,
                    json={
                        "access_token": "long_lived_user_tok_777",
                        "expires_in": 5184000,
                    },
                )
            return httpx.Response(
                200,
                json={
                    "access_token": "short_lived_user_tok_111",
                    "expires_in": 7200,
                },
            )
        # Step 3: me profile
        if f"{GRAPH_API_BASE}/me?" in url_str:
            return httpx.Response(200, json={"id": "user_id_444", "name": "Jane Marketer"})
        # Step 4: me/accounts (pages)
        if f"{GRAPH_API_BASE}/me/accounts" in url_str:
            return httpx.Response(
                200,
                json={
                    "data": [
                        {
                            "id": "page_333",
                            "name": "Global Corp Page",
                            "category": "Company",
                            "access_token": "long_lived_page_token_333",
                            "fan_count": 25000,
                            "tasks": ["CREATE_CONTENT", "MANAGE"],
                        }
                    ]
                },
            )
        return httpx.Response(404)

    mock_client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    adapter = FacebookAdapter(app_id="app_id", app_secret="app_secret", http_client=mock_client)

    account = await adapter.handle_callback(
        workspace_id="ws_fb",
        params={"code": "auth_code_from_fb"},
        state="state_123",
    )

    assert account.platform == "facebook"
    assert account.external_account_id == "fb_user_user_id_444"
    assert "Jane Marketer" in account.display_name
    assert decrypt_token(account.encrypted_access_token) == "long_lived_user_tok_777"

    # Verify Page tokens stored
    page_tokens = account.account_metadata["page_tokens"]
    assert "page_333" in page_tokens
    assert decrypt_token(page_tokens["page_333"]) == "long_lived_page_token_333"


@pytest.mark.anyio
async def test_list_targets_pages_only(mock_facebook_account):
    def handler(request: httpx.Request) -> httpx.Response:
        assert f"{GRAPH_API_BASE}/me/accounts" in str(request.url)
        return httpx.Response(
            200,
            json={
                "data": [
                    {
                        "id": "page_111",
                        "name": "Acme Brand",
                        "category": "Brand",
                        "fan_count": 18500,
                        "tasks": ["CREATE_CONTENT", "MANAGE"],
                    },
                    {
                        "id": "page_222",
                        "name": "Acme Support",
                        "category": "Support",
                        "fan_count": 4200,
                        "tasks": ["CREATE_CONTENT"],
                    },
                ]
            },
        )

    mock_client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    adapter = FacebookAdapter(http_client=mock_client)

    targets = await adapter.list_targets(mock_facebook_account)
    assert len(targets) == 2
    # Verify ONLY Pages are returned (personal profiles strictly excluded)
    assert targets[0].target_type == "page"
    assert targets[0].id == "page_111"
    assert targets[0].name == "Acme Brand"

    assert targets[1].target_type == "page"
    assert targets[1].id == "page_222"


@pytest.mark.anyio
async def test_validate():
    adapter = FacebookAdapter()

    # Valid post targeting a Page
    issues = await adapter.validate(MockVariant({"page_id": "page_111", "text": "Exciting product update!"}))
    assert len(issues) == 0

    # Missing target Page ID
    issues = await adapter.validate(MockVariant({"text": "Post without target"}))
    assert len(issues) == 1
    assert issues[0].code == "missing_page_target"

    # Post exceeding character limit
    too_long = "x" * 63207
    issues = await adapter.validate(MockVariant({"page_id": "page_111", "text": too_long}))
    assert len(issues) == 1
    assert issues[0].code == "text_too_long"


@pytest.mark.anyio
async def test_publish_to_page_feed(mock_facebook_account):
    recorded_post_data: list[dict[str, Any]] = []

    def handler(request: httpx.Request) -> httpx.Response:
        assert str(request.url) == f"{GRAPH_API_BASE}/page_111/feed"
        import urllib.parse

        form_data = dict(urllib.parse.parse_qsl(request.content.decode("utf-8")))
        recorded_post_data.append(form_data)
        return httpx.Response(
            200,
            json={"id": "page_111_post_999888"},
        )

    mock_client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    adapter = FacebookAdapter(http_client=mock_client)

    result = await adapter.publish(
        mock_facebook_account,
        MockVariant(
            {
                "page_id": "page_111",
                "text": "Announcing our major spring release!",
                "link": "https://postflow.ai/release",
            }
        ),
    )

    assert result.success is True
    assert result.external_post_id == "page_111_post_999888"
    assert result.external_url == "https://www.facebook.com/page_111_post_999888"

    # Crucial security verification: published using dedicated Page Access Token!
    assert recorded_post_data[0]["access_token"] == "page_access_token_111"
    assert recorded_post_data[0]["message"] == "Announcing our major spring release!"
    assert recorded_post_data[0]["link"] == "https://postflow.ai/release"


@pytest.mark.anyio
async def test_delete_post(mock_facebook_account):
    def handler(request: httpx.Request) -> httpx.Response:
        assert str(request.url).startswith(f"{GRAPH_API_BASE}/page_111_post_999888")
        assert request.method == "DELETE"
        return httpx.Response(200, json={"success": True})

    mock_client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    adapter = FacebookAdapter(http_client=mock_client)

    await adapter.delete_post(mock_facebook_account, "page_111_post_999888")


@pytest.mark.anyio
async def test_fetch_metrics(mock_facebook_account):
    def handler(request: httpx.Request) -> httpx.Response:
        url_str = str(request.url)
        if "/insights" in url_str:
            return httpx.Response(
                200,
                json={
                    "data": [
                        {"name": "post_impressions", "values": [{"value": 3400}]},
                        {"name": "post_clicks", "values": [{"value": 85}]},
                    ]
                },
            )
        return httpx.Response(
            200,
            json={
                "id": "page_111_post_999888",
                "reactions": {"summary": {"total_count": 142}},
                "comments": {"summary": {"total_count": 28}},
                "shares": {"count": 16},
            },
        )

    mock_client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    adapter = FacebookAdapter(http_client=mock_client)

    metrics = await adapter.fetch_metrics(mock_facebook_account, "page_111_post_999888")
    assert metrics.likes == 142
    assert metrics.comments == 28
    assert metrics.shares_reposts == 16
    assert metrics.impressions == 3400
    assert metrics.clicks == 85
    assert metrics.engagements == 142 + 28 + 16 + 85


@pytest.mark.anyio
async def test_fetch_account_metrics(mock_facebook_account):
    """Verify whole-account (Page) follower and view analytics from original Meta Graph API source."""
    def handler(request: httpx.Request) -> httpx.Response:
        url_str = str(request.url)
        if "/insights" in url_str:
            return httpx.Response(
                200,
                json={
                    "data": [
                        {"name": "page_impressions", "values": [{"value": 82000}]},
                        {"name": "page_engaged_users", "values": [{"value": 4100}]},
                        {"name": "page_views_total", "values": [{"value": 1250}]},
                    ]
                },
            )
        return httpx.Response(
            200,
            json={
                "id": "page_111",
                "name": "Acme Brand",
                "followers_count": 18500,
                "fan_count": 18500,
            },
        )

    mock_client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    adapter = FacebookAdapter(http_client=mock_client)

    account_metrics = await adapter.fetch_account_metrics(mock_facebook_account)
    assert account_metrics.followers_count == 18500
    assert account_metrics.impressions == 82000
    assert account_metrics.engagements == 4100
    assert account_metrics.profile_views == 1250
    assert account_metrics.extras["page_name"] == "Acme Brand"
