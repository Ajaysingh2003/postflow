from datetime import UTC, datetime, timedelta
from typing import Any

import httpx
import pytest

from app.db.session import SessionLocal
from app.modules.channels.adapters.reddit import (
    REDDIT_OAUTH_API_BASE,
    REDDIT_TOKEN_URL,
    RedditAdapter,
)
from app.modules.channels.base import PlatformAdapter
from app.modules.channels.models import ConnectedAccount
from app.modules.channels.oauth import decrypt_token, encrypt_token


class MockVariant:
    def __init__(self, payload: dict[str, Any]) -> None:
        self.payload = payload


@pytest.fixture
def mock_reddit_account():
    return ConnectedAccount(
        workspace_id="ws_reddit_1",
        platform="reddit",
        external_account_id="t2_reddit_user_abc",
        display_name="u/python_developer",
        account_type="profile",
        encrypted_access_token=encrypt_token("reddit_access_token_123"),
        encrypted_refresh_token=encrypt_token("reddit_refresh_token_456"),
        token_expires_at=datetime.now(UTC) + timedelta(hours=1),
        granted_scopes=["identity", "submit", "read", "mysubreddits", "flair"],
        status="active",
        account_metadata={
            "username": "python_developer",
            "reddit_id": "reddit_user_abc",
            "total_karma": 12500,
        },
    )


def test_reddit_adapter_protocol_conformance():
    adapter = RedditAdapter(client_id="cid", client_secret="csec")
    assert isinstance(adapter, PlatformAdapter)
    assert adapter.capabilities.platform == "reddit"
    assert adapter.capabilities.max_text_length == 40000
    assert adapter.capabilities.requires_target is True
    assert adapter.capabilities.target_type_name == "subreddit"
    assert adapter.capabilities.supports_account_metrics is True


@pytest.mark.anyio
async def test_build_auth_url():
    adapter = RedditAdapter(client_id="my_reddit_cid")
    res = await adapter.build_auth_url(
        workspace_id="ws_1",
        state="reddit_state_777",
        redirect_uri="https://postflow.ai/api/v1/channels/oauth/callback",
    )
    assert "https://www.reddit.com/api/v1/authorize" in res.auth_url
    assert "client_id=my_reddit_cid" in res.auth_url
    assert "duration=permanent" in res.auth_url  # Permanent refresh token requirement
    assert "submit" in res.auth_url
    assert "mysubreddits" in res.auth_url


@pytest.mark.anyio
async def test_handle_callback_success():
    def handler(request: httpx.Request) -> httpx.Response:
        url_str = str(request.url)
        assert "postflow" in request.headers["User-Agent"]
        if url_str == REDDIT_TOKEN_URL:
            return httpx.Response(
                200,
                json={
                    "access_token": "reddit_acc_tok_999",
                    "refresh_token": "reddit_ref_tok_888",
                    "expires_in": 3600,
                    "scope": "identity submit read mysubreddits flair",
                },
            )
        if url_str == f"{REDDIT_OAUTH_API_BASE}/api/v1/me":
            return httpx.Response(
                200,
                json={
                    "id": "user_id_1234",
                    "name": "tech_enthusiast",
                    "total_karma": 8450,
                    "link_karma": 6000,
                    "comment_karma": 2450,
                    "icon_img": "https://reddit.com/avatar.png",
                },
            )
        return httpx.Response(404)

    mock_client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    adapter = RedditAdapter(client_id="cid", client_secret="csec", http_client=mock_client)

    account = await adapter.handle_callback(
        workspace_id="ws_red",
        params={"code": "reddit_auth_code_123"},
        state="state_red",
    )

    assert account.platform == "reddit"
    assert account.external_account_id == "t2_user_id_1234"
    assert account.display_name == "u/tech_enthusiast"
    assert decrypt_token(account.encrypted_access_token) == "reddit_acc_tok_999"
    assert decrypt_token(account.encrypted_refresh_token) == "reddit_ref_tok_888"
    assert account.account_metadata["total_karma"] == 8450


@pytest.mark.anyio
async def test_refresh_tokens_success(mock_reddit_account):
    def handler(request: httpx.Request) -> httpx.Response:
        assert str(request.url) == REDDIT_TOKEN_URL
        return httpx.Response(
            200,
            json={
                "access_token": "reddit_refreshed_acc_tok_111",
                "refresh_token": "reddit_refreshed_ref_tok_222",
                "expires_in": 3600,
            },
        )

    mock_client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    adapter = RedditAdapter(client_id="cid", client_secret="csec", http_client=mock_client)

    updated = await adapter.refresh_tokens(mock_reddit_account)
    assert decrypt_token(updated.encrypted_access_token) == "reddit_refreshed_acc_tok_111"
    assert updated.status == "active"


@pytest.mark.anyio
async def test_list_targets(mock_reddit_account):
    def handler(request: httpx.Request) -> httpx.Response:
        assert str(request.url).startswith(f"{REDDIT_OAUTH_API_BASE}/subreddits/mine/subscriber")
        return httpx.Response(
            200,
            json={
                "data": {
                    "children": [
                        {
                            "data": {
                                "display_name": "Python",
                                "public_description": "News about the programming language Python",
                                "subscribers": 1200000,
                                "submission_type": "any",
                            }
                        },
                        {
                            "data": {
                                "display_name": "programming",
                                "public_description": "Computer Programming",
                                "subscribers": 5000000,
                                "submission_type": "link",
                            }
                        },
                    ]
                }
            },
        )

    mock_client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    adapter = RedditAdapter(http_client=mock_client)

    targets = await adapter.list_targets(mock_reddit_account)
    assert len(targets) == 2
    assert targets[0].id == "Python"
    assert targets[0].name == "r/Python"
    assert targets[0].target_type == "subreddit"
    assert targets[1].id == "programming"


@pytest.mark.anyio
async def test_refresh_subreddit_profile(mock_reddit_account):
    def handler(request: httpx.Request) -> httpx.Response:
        url_str = str(request.url)
        if "/r/python/about/rules" in url_str:
            return httpx.Response(
                200,
                json={
                    "rules": [
                        {"short_name": "No Spam", "description": "Original content only", "violation_reason": "Spam"}
                    ]
                },
            )
        if "/r/python/api/link_flair_v2" in url_str:
            return httpx.Response(200, json=[{"id": "flair_news_1", "text": "News"}])
        if "/r/python/about" in url_str:
            return httpx.Response(
                200,
                json={"data": {"submission_type": "any", "link_flair_enabled": True, "link_flair_required": True}},
            )
        return httpx.Response(404)

    mock_client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    adapter = RedditAdapter(http_client=mock_client)

    with SessionLocal() as db:
        profile = await adapter.refresh_subreddit_profile(db, mock_reddit_account, "r/Python")
        assert profile.name == "python"
        assert profile.flair_required is True
        assert len(profile.rules) == 1
        assert profile.rules[0]["short_name"] == "No Spam"
        assert len(profile.available_flairs) == 1


@pytest.mark.anyio
async def test_validate():
    adapter = RedditAdapter()

    # Valid post with title and subreddit target
    issues = await adapter.validate(
        MockVariant({
            "subreddit": "python",
            "title": "Clean Architecture in Python",
            "body": "Here is a breakdown of domain patterns...",
            "post_type": "text",
        })
    )
    assert len(issues) == 0

    # Missing target subreddit
    issues = await adapter.validate(MockVariant({"title": "Some Title", "body": "Body text"}))
    assert len(issues) == 1
    assert issues[0].code == "missing_target"

    # Missing title
    issues = await adapter.validate(MockVariant({"subreddit": "python", "title": ""}))
    assert len(issues) == 1
    assert issues[0].code == "missing_title"

    # Title exceeds 300 characters
    issues = await adapter.validate(MockVariant({"subreddit": "python", "title": "A" * 301}))
    assert len(issues) == 1
    assert issues[0].code == "title_too_long"

    # Link post without url
    issues = await adapter.validate(
        MockVariant({"subreddit": "python", "title": "Great Site", "post_type": "link", "url": None})
    )
    assert len(issues) == 1
    assert issues[0].code == "missing_url"


@pytest.mark.anyio
async def test_publish_text_and_link_post(mock_reddit_account):
    recorded_form_data: list[dict[str, Any]] = []

    def handler(request: httpx.Request) -> httpx.Response:
        assert str(request.url) == f"{REDDIT_OAUTH_API_BASE}/api/submit"
        assert "postflow" in request.headers["User-Agent"]
        import urllib.parse

        form_data = dict(urllib.parse.parse_qsl(request.content.decode("utf-8")))
        recorded_form_data.append(form_data)
        return httpx.Response(
            200,
            json={
                "json": {
                    "errors": [],
                    "data": {
                        "id": "t3_123456",
                        "name": "t3_123456",
                        "url": "https://www.reddit.com/r/Python/comments/123456/sample_post/",
                    },
                }
            },
        )

    mock_client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    adapter = RedditAdapter(http_client=mock_client)

    # 1. Text (Self) post
    res_text = await adapter.publish(
        mock_reddit_account,
        MockVariant({
            "subreddit": "r/Python",
            "title": "Release 1.0 of Postflow",
            "body": "Detailed notes on multi-platform scheduling",
            "post_type": "text",
        }),
    )
    assert res_text.success is True
    assert res_text.external_post_id == "t3_123456"
    assert "https://www.reddit.com/r/Python" in (res_text.external_url or "")
    assert recorded_form_data[0]["sr"] == "Python"
    assert recorded_form_data[0]["kind"] == "self"
    assert recorded_form_data[0]["text"] == "Detailed notes on multi-platform scheduling"

    # 2. Link post
    res_link = await adapter.publish(
        mock_reddit_account,
        MockVariant({
            "subreddit": "Python",
            "title": "Documentation Link",
            "url": "https://postflow.ai/docs",
            "post_type": "link",
        }),
    )
    assert res_link.success is True
    assert recorded_form_data[1]["kind"] == "link"
    assert recorded_form_data[1]["url"] == "https://postflow.ai/docs"


@pytest.mark.anyio
async def test_publish_ratelimit_retryable(mock_reddit_account):
    def handler(_: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            json={
                "json": {
                    "errors": [["RATELIMIT", "You are doing that too much. Try again in 5 minutes.", "ratelimit"]]
                }
            },
        )

    mock_client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    adapter = RedditAdapter(http_client=mock_client)

    res = await adapter.publish(
        mock_reddit_account,
        MockVariant({"subreddit": "Python", "title": "Test Title", "body": "Body"}),
    )
    assert res.success is False
    assert res.is_retryable is True
    assert "RATELIMIT" in (res.error_message or "")


@pytest.mark.anyio
async def test_delete_post(mock_reddit_account):
    def handler(request: httpx.Request) -> httpx.Response:
        assert str(request.url) == f"{REDDIT_OAUTH_API_BASE}/api/del"
        assert request.method == "POST"
        return httpx.Response(200)

    mock_client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    adapter = RedditAdapter(http_client=mock_client)

    await adapter.delete_post(mock_reddit_account, "t3_123456")


@pytest.mark.anyio
async def test_fetch_metrics(mock_reddit_account):
    def handler(request: httpx.Request) -> httpx.Response:
        assert str(request.url) == f"{REDDIT_OAUTH_API_BASE}/by_id/t3_post999"
        return httpx.Response(
            200,
            json={
                "data": {
                    "children": [
                        {
                            "data": {
                                "id": "post999",
                                "score": 850,
                                "ups": 850,
                                "num_comments": 47,
                                "upvote_ratio": 0.94,
                                "total_awards_received": 3,
                            }
                        }
                    ]
                }
            },
        )

    mock_client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    adapter = RedditAdapter(http_client=mock_client)

    metrics = await adapter.fetch_metrics(mock_reddit_account, "post999")
    assert metrics.likes == 850
    assert metrics.comments == 47
    assert metrics.extras["score"] == 850
    assert metrics.extras["upvote_ratio"] == 0.94


@pytest.mark.anyio
async def test_fetch_account_metrics(mock_reddit_account):
    """Verify whole-account karma and subscriber metrics from the original Reddit source."""
    def handler(request: httpx.Request) -> httpx.Response:
        assert str(request.url) == f"{REDDIT_OAUTH_API_BASE}/api/v1/me"
        return httpx.Response(
            200,
            json={
                "name": "python_developer",
                "total_karma": 26800,
                "link_karma": 19400,
                "comment_karma": 7400,
                "awarder_karma": 120,
                "awardee_karma": 350,
                "subreddit": {"subscribers": 540},
            },
        )

    mock_client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    adapter = RedditAdapter(http_client=mock_client)

    account_metrics = await adapter.fetch_account_metrics(mock_reddit_account)
    assert account_metrics.followers_count == 540
    assert account_metrics.engagements == 26800  # Total karma
    assert account_metrics.extras["link_karma"] == 19400
    assert account_metrics.extras["comment_karma"] == 7400
