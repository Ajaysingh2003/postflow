import urllib.parse
from datetime import UTC, datetime, timedelta
from typing import Any

import httpx
import pytest

from app.modules.channels.adapters.linkedin import (
    LINKEDIN_REST_BASE,
    LINKEDIN_TOKEN_URL,
    LINKEDIN_USERINFO_URL,
    LINKEDIN_V2_BASE,
    LinkedInAdapter,
)
from app.modules.channels.base import PlatformAdapter
from app.modules.channels.models import ConnectedAccount
from app.modules.channels.oauth import decrypt_token, encrypt_token


class MockVariant:
    def __init__(self, payload: dict[str, Any]) -> None:
        self.payload = payload


@pytest.fixture
def mock_linkedin_account():
    return ConnectedAccount(
        workspace_id="ws_li_123",
        platform="linkedin",
        external_account_id="urn:li:person:person_12345",
        display_name="Ajay Professional",
        account_type="profile",
        encrypted_access_token=encrypt_token("li_access_token_secret"),
        encrypted_refresh_token=encrypt_token("li_refresh_token_secret"),
        token_expires_at=datetime.now(UTC) + timedelta(days=60),
        granted_scopes=["openid", "profile", "w_member_social", "w_organization_social"],
        status="active",
        account_metadata={
            "person_id": "person_12345",
            "person_urn": "urn:li:person:person_12345",
            "name": "Ajay Professional",
            "target_org_urn": "urn:li:organization:998877",
        },
    )


def test_linkedin_adapter_protocol_conformance():
    adapter = LinkedInAdapter(client_id="cid", client_secret="csec")
    assert isinstance(adapter, PlatformAdapter)
    assert adapter.capabilities.platform == "linkedin"
    assert adapter.capabilities.max_text_length == 3000
    assert adapter.capabilities.supports_media is True
    assert adapter.capabilities.max_media_count == 20
    assert adapter.capabilities.supports_account_metrics is True


@pytest.mark.anyio
async def test_build_auth_url():
    adapter = LinkedInAdapter(client_id="my_li_client_id")
    res = await adapter.build_auth_url(
        workspace_id="ws_1",
        state="li_csrf_state",
        redirect_uri="https://draftva.com/api/v1/channels/oauth/callback",
    )
    assert "https://www.linkedin.com/oauth/v2/authorization" in res.auth_url
    assert "client_id=my_li_client_id" in res.auth_url
    assert "state=li_csrf_state" in res.auth_url
    assert "response_type=code" in res.auth_url
    assert "w_member_social" in res.auth_url


@pytest.mark.anyio
async def test_handle_callback_success():
    def handler(request: httpx.Request) -> httpx.Response:
        url_str = str(request.url)
        if url_str == LINKEDIN_TOKEN_URL:
            return httpx.Response(
                200,
                json={
                    "access_token": "li_new_token_777",
                    "refresh_token": "li_new_refresh_888",
                    "expires_in": 5184000,
                    "scope": "openid profile email w_member_social w_organization_social",
                },
            )
        if url_str == LINKEDIN_USERINFO_URL:
            return httpx.Response(
                200,
                json={
                    "sub": "sub_user_abc123",
                    "name": "Sarah Connor",
                    "email": "sarah@example.com",
                    "picture": "https://media.licdn.com/dms/image/avatar.jpg",
                },
            )
        return httpx.Response(404)

    mock_client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    adapter = LinkedInAdapter(client_id="cid", client_secret="csec", http_client=mock_client)

    account = await adapter.handle_callback(
        workspace_id="ws_li",
        params={"code": "auth_code_from_linkedin"},
        state="state_xyz",
    )

    assert account.platform == "linkedin"
    assert account.external_account_id == "urn:li:person:sub_user_abc123"
    assert account.display_name == "Sarah Connor"
    assert decrypt_token(account.encrypted_access_token) == "li_new_token_777"
    assert decrypt_token(account.encrypted_refresh_token) == "li_new_refresh_888"
    assert account.account_metadata["person_urn"] == "urn:li:person:sub_user_abc123"


@pytest.mark.anyio
async def test_refresh_tokens_success(mock_linkedin_account):
    def handler(request: httpx.Request) -> httpx.Response:
        assert str(request.url) == LINKEDIN_TOKEN_URL
        return httpx.Response(
            200,
            json={
                "access_token": "li_refreshed_access_token_321",
                "refresh_token": "li_refreshed_refresh_token_654",
                "expires_in": 5184000,
            },
        )

    mock_client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    adapter = LinkedInAdapter(client_id="cid", client_secret="csec", http_client=mock_client)

    updated = await adapter.refresh_tokens(mock_linkedin_account)
    assert decrypt_token(updated.encrypted_access_token) == "li_refreshed_access_token_321"
    assert decrypt_token(updated.encrypted_refresh_token) == "li_refreshed_refresh_token_654"
    assert updated.status == "active"


@pytest.mark.anyio
async def test_list_targets(mock_linkedin_account):
    def handler(request: httpx.Request) -> httpx.Response:
        url_str = str(request.url)
        assert f"{LINKEDIN_REST_BASE}/organizationalEntityAcls" in url_str
        assert request.headers["LinkedIn-Version"] == "202609"
        return httpx.Response(
            200,
            json={
                "elements": [
                    {
                        "organizationalTarget": "urn:li:organization:1234567",
                        "role": "ADMINISTRATOR",
                        "state": "APPROVED",
                    },
                    {
                        "organizationalTarget": "urn:li:organization:9999999",
                        "role": "CONTENT_ADMIN",
                        "state": "APPROVED",
                    },
                ]
            },
        )

    mock_client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    adapter = LinkedInAdapter(http_client=mock_client)

    targets = await adapter.list_targets(mock_linkedin_account)
    # Personal profile + 2 organization pages = 3 targets
    assert len(targets) == 3
    assert targets[0].target_type == "personal"
    assert targets[0].id == "urn:li:person:person_12345"

    assert targets[1].target_type == "organization"
    assert targets[1].id == "urn:li:organization:1234567"
    assert "1234567" in targets[1].name

    assert targets[2].target_type == "organization"
    assert targets[2].id == "urn:li:organization:9999999"


@pytest.mark.anyio
async def test_validate():
    adapter = LinkedInAdapter()

    # Valid post
    issues = await adapter.validate(MockVariant({"text": "Excited to announce our new milestone!"}))
    assert len(issues) == 0

    # Over character limit (> 3000 chars)
    issues = await adapter.validate(MockVariant({"text": "a" * 3001}))
    assert len(issues) == 1
    assert issues[0].code == "text_too_long"

    # Too many media items (> 20)
    issues = await adapter.validate(
        MockVariant(
            {"text": "Check slides", "media_urns": [f"urn:li:image:{i}" for i in range(21)]}
        )
    )
    assert len(issues) == 1
    assert issues[0].code == "too_many_media"


@pytest.mark.anyio
async def test_publish_personal_and_organization_post(mock_linkedin_account):
    recorded_requests: list[dict[str, Any]] = []

    def handler(request: httpx.Request) -> httpx.Response:
        url_str = str(request.url)
        assert url_str == f"{LINKEDIN_REST_BASE}/posts"
        assert request.headers["LinkedIn-Version"] == "202609"
        assert request.headers["X-Restli-Protocol-Version"] == "2.0.0"
        import json

        body = json.loads(request.content)
        recorded_requests.append(body)
        return httpx.Response(
            201,
            headers={"x-restli-id": "urn:li:share:987654321"},
            json={"id": "urn:li:share:987654321"},
        )

    mock_client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    adapter = LinkedInAdapter(http_client=mock_client)

    # 1. Publish to personal profile (default)
    res_personal = await adapter.publish(
        mock_linkedin_account,
        MockVariant({"text": "Sharing my thoughts on AI"}),
    )
    assert res_personal.success is True
    assert res_personal.external_post_id == "urn:li:share:987654321"
    assert (
        res_personal.external_url == "https://www.linkedin.com/feed/update/urn:li:share:987654321"
    )
    assert recorded_requests[0]["author"] == "urn:li:person:person_12345"
    assert recorded_requests[0]["commentary"] == "Sharing my thoughts on AI"

    # 2. Publish targeting an organization page
    res_org = await adapter.publish(
        mock_linkedin_account,
        MockVariant(
            {
                "text": "Company update: New product release!",
                "target_urn": "urn:li:organization:1234567",
            }
        ),
    )
    assert res_org.success is True
    assert recorded_requests[1]["author"] == "urn:li:organization:1234567"
    assert recorded_requests[1]["commentary"] == "Company update: New product release!"


@pytest.mark.anyio
async def test_delete_post(mock_linkedin_account):
    def handler(request: httpx.Request) -> httpx.Response:
        encoded_urn = urllib.parse.quote("urn:li:share:987654321", safe="")
        assert f"{LINKEDIN_REST_BASE}/posts/{encoded_urn}" in str(request.url)
        assert request.method == "DELETE"
        return httpx.Response(204)

    mock_client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    adapter = LinkedInAdapter(http_client=mock_client)

    # Should complete without error
    await adapter.delete_post(mock_linkedin_account, "urn:li:share:987654321")


@pytest.mark.anyio
async def test_fetch_metrics(mock_linkedin_account):
    def handler(request: httpx.Request) -> httpx.Response:
        assert f"{LINKEDIN_REST_BASE}/organizationalEntityShareStatistics" in str(request.url)
        assert request.url.params["q"] == "organizationalEntity"
        assert request.url.params["organizationalEntity"] == "urn:li:organization:998877"
        assert request.url.params["shares"] == "List(urn:li:share:987654321)"
        return httpx.Response(
            200,
            json={
                "elements": [
                    {
                        "share": "urn:li:share:987654321",
                        "totalShareStatistics": {
                            "likeCount": 142,
                            "commentCount": 28,
                            "shareCount": 19,
                            "impressionCount": 4200,
                            "uniqueImpressionsCount": 3800,
                            "clickCount": 115,
                        },
                    }
                ]
            },
        )

    mock_client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    adapter = LinkedInAdapter(http_client=mock_client)

    metrics = await adapter.fetch_metrics(mock_linkedin_account, "urn:li:share:987654321")
    assert metrics.impressions == 4200
    assert metrics.likes == 142
    assert metrics.comments == 28
    assert metrics.shares_reposts == 19
    assert metrics.clicks == 115
    assert metrics.engagements == 142 + 28 + 19 + 115
    assert metrics.extras["metrics_status"] == "available"
    assert metrics.extras["metrics_source"] == "organizationalEntityShareStatistics"


@pytest.mark.anyio
async def test_fetch_organization_metrics_empty_result_and_12_month_window(mock_linkedin_account):
    def handler(request: httpx.Request) -> httpx.Response:
        assert f"{LINKEDIN_REST_BASE}/organizationalEntityShareStatistics" in str(request.url)
        return httpx.Response(200, json={"elements": []})

    mock_client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    adapter = LinkedInAdapter(http_client=mock_client)

    recent = await adapter.fetch_metrics(
        mock_linkedin_account,
        "urn:li:share:987654321",
        context={"published_at": datetime.now(UTC) - timedelta(days=7)},
    )
    assert recent.impressions == 0
    assert recent.engagements == 0
    assert recent.extras["metrics_status"] == "available"
    assert "impressions" in recent.extras["available_metrics"]

    old = await adapter.fetch_metrics(
        mock_linkedin_account,
        "urn:li:share:987654321",
        context={"published_at": datetime.now(UTC) - timedelta(days=400)},
    )
    assert old.extras["metrics_status"] == "unavailable"
    assert "12-month" in old.extras["metrics_notice"]


@pytest.mark.anyio
async def test_fetch_member_post_metrics_with_approved_scope(mock_linkedin_account):
    mock_linkedin_account.account_metadata.pop("target_org_urn")
    mock_linkedin_account.granted_scopes = ["openid", "profile", "r_member_postAnalytics"]

    values = {
        "IMPRESSION": 5000,
        "MEMBERS_REACHED": 4200,
        "RESHARE": 15,
        "REACTION": 65,
        "COMMENT": 7,
        "LINK_CLICKS": 32,
    }

    def handler(request: httpx.Request) -> httpx.Response:
        assert f"{LINKEDIN_REST_BASE}/memberCreatorPostAnalytics" in str(request.url)
        assert request.url.params["q"] == "entity"
        assert request.url.params["entity"] == "(share:urn:li:share:987654321)"
        query_type = request.url.params["queryType"]
        return httpx.Response(200, json={"elements": [{"count": values[query_type]}]})

    mock_client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    adapter = LinkedInAdapter(http_client=mock_client)

    metrics = await adapter.fetch_metrics(
        mock_linkedin_account,
        "urn:li:share:987654321",
        context={"payload": {"target_urn": "urn:li:person:person_12345"}},
    )

    assert metrics.impressions == 5000
    assert metrics.reach == 4200
    assert metrics.likes == 65
    assert metrics.comments == 7
    assert metrics.shares_reposts == 15
    assert metrics.clicks == 32
    assert metrics.engagements == 119
    assert metrics.extras["metrics_status"] == "available"
    assert metrics.extras["metrics_source"] == "memberCreatorPostAnalytics"


@pytest.mark.anyio
async def test_fetch_member_post_metrics_falls_back_to_partial_social_actions(mock_linkedin_account):
    mock_linkedin_account.account_metadata.pop("target_org_urn")
    mock_linkedin_account.granted_scopes = ["openid", "profile", "w_member_social"]

    def handler(request: httpx.Request) -> httpx.Response:
        assert f"{LINKEDIN_REST_BASE}/socialActions/" in str(request.url)
        return httpx.Response(
            200,
            json={
                "likesSummary": {"totalLikes": 12},
                "commentsSummary": {"totalFirstLevelComments": 3},
            },
        )

    mock_client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    adapter = LinkedInAdapter(http_client=mock_client)

    metrics = await adapter.fetch_metrics(mock_linkedin_account, "urn:li:share:987654321")

    assert metrics.impressions == 0
    assert metrics.engagements == 15
    assert metrics.extras["metrics_status"] == "partial"
    assert metrics.extras["available_metrics"] == ["likes", "comments", "engagements"]
    assert "r_member_postAnalytics" in metrics.extras["metrics_notice"]


@pytest.mark.anyio
async def test_fetch_account_metrics_organization(mock_linkedin_account):
    """Organization follower totals come from LinkedIn's networkSizes endpoint."""

    def handler(request: httpx.Request) -> httpx.Response:
        if "networkSizes" not in str(request.url):
            return httpx.Response(403, json={"message": "Restricted analytics"})
        encoded_org = urllib.parse.quote("urn:li:organization:998877", safe=":")
        assert f"{LINKEDIN_V2_BASE}/networkSizes/{encoded_org}" in str(request.url)
        assert request.url.params["edgeType"] == "CompanyFollowedByMember"
        return httpx.Response(200, json={"firstDegreeSize": 19600})

    mock_client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    adapter = LinkedInAdapter(http_client=mock_client)

    account_metrics = await adapter.fetch_account_metrics(mock_linkedin_account)
    assert account_metrics.followers_count == 19600
    assert account_metrics.impressions == 0
    assert account_metrics.extras["metrics_status"] == "partial"
    assert account_metrics.extras["available_metrics"] == ["followers_count"]


@pytest.mark.anyio
async def test_fetch_metrics_handles_403_gracefully(mock_linkedin_account):
    """Restricted analytics stay explicitly unavailable instead of looking like zeros."""
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            403,
            json={
                "status": 403,
                "serviceErrorCode": 100,
                "code": "ACCESS_DENIED",
                "message": "Not enough permissions to access: partnerApiSocialActions.GET.20260901",
            },
        )

    mock_client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    adapter = LinkedInAdapter(http_client=mock_client)

    metrics = await adapter.fetch_metrics(mock_linkedin_account, "urn:li:share:987654321")
    assert metrics.impressions == 0
    assert metrics.engagements == 0
    assert metrics.extras["metrics_status"] == "unavailable"
    assert metrics.extras["available_metrics"] == []
    assert "rw_organization_admin" in metrics.extras["metrics_notice"]


@pytest.mark.anyio
async def test_fetch_account_metrics_handles_403_gracefully(mock_linkedin_account):
    """Verify that denied Page follower access is explicitly marked unavailable."""
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(403, text="Forbidden")

    mock_client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    adapter = LinkedInAdapter(http_client=mock_client)

    account_metrics = await adapter.fetch_account_metrics(mock_linkedin_account)
    assert account_metrics.impressions == 0
    assert account_metrics.extras["status_code"] == 403
    assert account_metrics.extras["metrics_status"] == "unavailable"
