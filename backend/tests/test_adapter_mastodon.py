from datetime import UTC, datetime, timedelta
from typing import Any

import httpx
import pytest
from fastapi import HTTPException
from sqlalchemy import select

from app.db.session import SessionLocal
from app.modules.channels.adapters.mastodon import (
    MastodonAdapter,
    normalize_domain,
)
from app.modules.channels.base import PlatformAdapter
from app.modules.channels.models import ConnectedAccount, MastodonApp
from app.modules.channels.oauth import decrypt_token, encrypt_token


class MockVariant:
    def __init__(self, payload: dict[str, Any], idempotency_key: str | None = None) -> None:
        self.payload = payload
        self.idempotency_key = idempotency_key


@pytest.fixture
def mock_mastodon_account():
    return ConnectedAccount(
        workspace_id="ws_masto_1",
        platform="mastodon",
        external_account_id="109876@mastodon.social",
        display_name="Alice Wonder (@alice@mastodon.social)",
        account_type="profile",
        encrypted_access_token=encrypt_token("masto_access_token_secret"),
        token_expires_at=datetime.now(UTC) + timedelta(days=365),
        granted_scopes=["read", "write", "push"],
        status="active",
        account_metadata={
            "instance_domain": "mastodon.social",
            "username": "alice",
            "user_id": "109876",
            "acct": "alice@mastodon.social",
            "instance_config": {
                "max_characters": 500,
                "max_media_attachments": 4,
            },
        },
    )


def test_mastodon_adapter_protocol_conformance():
    adapter = MastodonAdapter()
    assert isinstance(adapter, PlatformAdapter)
    assert adapter.capabilities.platform == "mastodon"
    assert adapter.capabilities.supports_media is True
    assert adapter.capabilities.requires_target is False
    assert adapter.capabilities.supports_account_metrics is True


def test_domain_normalization():
    assert normalize_domain("https://mastodon.social/") == "mastodon.social"
    assert normalize_domain("http://fosstodon.org/web") == "fosstodon.org"
    assert normalize_domain(" mastodon.online ") == "mastodon.online"
    assert normalize_domain("glitch.social") == "glitch.social"


@pytest.mark.anyio
async def test_get_or_register_app():
    def handler(request: httpx.Request) -> httpx.Response:
        assert str(request.url) == "https://fosstodon.org/api/v1/apps"
        return httpx.Response(
            200,
            json={
                "client_id": "dynamic_client_id_777",
                "client_secret": "dynamic_client_secret_888",
            },
        )

    mock_client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    adapter = MastodonAdapter(http_client=mock_client)

    with SessionLocal() as db:
        # First registration dynamically calls API
        app_record = await adapter.get_or_register_app(
            db=db,
            instance_domain="https://fosstodon.org/",
            redirect_uri="https://postflow.ai/callback",
        )
        assert app_record.instance_domain == "fosstodon.org"
        assert app_record.client_id == "dynamic_client_id_777"
        assert decrypt_token(app_record.encrypted_client_secret) == "dynamic_client_secret_888"

        # Subsequent call retrieves cached record from DB
        cached_app = await adapter.get_or_register_app(
            db=db,
            instance_domain="fosstodon.org",
            redirect_uri="https://postflow.ai/callback",
        )
        assert cached_app.id == app_record.id


@pytest.mark.anyio
async def test_fetch_instance_config_dynamic_limits():
    def handler(request: httpx.Request) -> httpx.Response:
        assert "glitch.social" in str(request.url)
        # Mock instance with customized 1000 characters and 8 media items
        return httpx.Response(
            200,
            json={
                "title": "Glitch Social",
                "configuration": {
                    "statuses": {
                        "max_characters": 1000,
                        "max_media_attachments": 8,
                    }
                },
            },
        )

    mock_client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    adapter = MastodonAdapter(http_client=mock_client)

    cfg = await adapter.fetch_instance_config("glitch.social")
    assert cfg["max_characters"] == 1000
    assert cfg["max_media_attachments"] == 8
    assert cfg["title"] == "Glitch Social"


@pytest.mark.anyio
async def test_build_auth_url():
    adapter = MastodonAdapter()

    # Missing instance_domain raises 400
    with pytest.raises(HTTPException) as exc:
        await adapter.build_auth_url(workspace_id="ws_1", state="state_123")
    assert exc.value.status_code == 400

    with SessionLocal() as db:
        # Pre-seed app record for mastodon.social
        db.add(
            MastodonApp(
                instance_domain="mastodon.social",
                client_id="masto_app_id_123",
                encrypted_client_secret=encrypt_token("sec"),
                redirect_uri="https://postflow.ai/callback",
                scopes="read write push",
            )
        )
        db.commit()

        res = await adapter.build_auth_url(
            workspace_id="ws_1",
            state="state_xyz",
            instance_domain="mastodon.social",
            redirect_uri="https://postflow.ai/callback",
            db=db,
        )
        assert "https://mastodon.social/oauth/authorize" in res.auth_url
        assert "client_id=masto_app_id_123" in res.auth_url
        assert "state=state_xyz" in res.auth_url


@pytest.mark.anyio
async def test_handle_callback_success():
    def handler(request: httpx.Request) -> httpx.Response:
        url_str = str(request.url)
        if "/oauth/token" in url_str:
            return httpx.Response(
                200,
                json={
                    "access_token": "masto_auth_token_999",
                    "token_type": "Bearer",
                    "scope": "read write push",
                },
            )
        if "/api/v1/accounts/verify_credentials" in url_str:
            return httpx.Response(
                200,
                json={
                    "id": "876543",
                    "username": "bob",
                    "display_name": "Bob Builder",
                    "acct": "bob@mastodon.social",
                    "avatar": "https://mastodon.social/avatars/bob.png",
                },
            )
        if "/api/v2/instance" in url_str:
            return httpx.Response(
                200,
                json={"configuration": {"statuses": {"max_characters": 500, "max_media_attachments": 4}}},
            )
        return httpx.Response(404)

    mock_client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    adapter = MastodonAdapter(http_client=mock_client)

    with SessionLocal() as db:
        existing = db.scalar(select(MastodonApp).where(MastodonApp.instance_domain == "mastodon.social"))
        if not existing:
            db.add(
                MastodonApp(
                    instance_domain="mastodon.social",
                    client_id="masto_app_id_123",
                    encrypted_client_secret=encrypt_token("sec"),
                    redirect_uri="https://postflow.ai/callback",
                )
            )
            db.commit()

        account = await adapter.handle_callback(
            workspace_id="ws_masto",
            params={"code": "oauth_code_123"},
            state="state_val",
            instance_domain="mastodon.social",
            db=db,
        )

        assert account.platform == "mastodon"
        assert account.external_account_id == "876543@mastodon.social"
        assert "Bob Builder" in account.display_name
        assert decrypt_token(account.encrypted_access_token) == "masto_auth_token_999"
        assert account.account_metadata["instance_config"]["max_characters"] == 500


@pytest.mark.anyio
async def test_validate_vanilla_and_custom_instance_limits():
    adapter = MastodonAdapter()

    # 1. Vanilla 500 character limit
    assert len(await adapter.validate(MockVariant({"text": "Hello mastodon world!"}))) == 0

    too_long_vanilla = "a" * 501
    issues = await adapter.validate(MockVariant({"text": too_long_vanilla}))
    assert len(issues) == 1
    assert issues[0].code == "instance_char_limit_exceeded"

    # 2. Custom instance with 1000 character limit (e.g. glitch-soc)
    custom_cfg = {"instance_config": {"max_characters": 1000, "max_media_attachments": 8}}
    text_700_chars = "b" * 700
    # Should be valid under 1000 character instance
    assert len(await adapter.validate(MockVariant({"text": text_700_chars, **custom_cfg}))) == 0

    # 3. Too many media items for vanilla instance (> 4)
    issues_media = await adapter.validate(MockVariant({"text": "pics", "media_ids": ["1", "2", "3", "4", "5"]}))
    assert len(issues_media) == 1
    assert issues_media[0].code == "too_many_media"


@pytest.mark.anyio
async def test_publish_with_content_warning_and_idempotency(mock_mastodon_account):
    recorded_data: list[dict[str, Any]] = []
    recorded_headers: list[dict[str, str]] = []

    def handler(request: httpx.Request) -> httpx.Response:
        assert str(request.url) == "https://mastodon.social/api/v1/statuses"
        assert request.headers["Authorization"] == "Bearer masto_access_token_secret"
        import urllib.parse

        form_data = dict(urllib.parse.parse_qsl(request.content.decode("utf-8")))
        recorded_data.append(form_data)
        recorded_headers.append(dict(request.headers))
        return httpx.Response(
            200,
            json={
                "id": "1100223344",
                "url": "https://mastodon.social/@alice/1100223344",
                "content": "<p>Exciting announcement!</p>",
            },
        )

    mock_client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    adapter = MastodonAdapter(http_client=mock_client)

    result = await adapter.publish(
        mock_mastodon_account,
        MockVariant(
            {
                "text": "Exciting announcement!",
                "spoiler_text": "Product Launch CW",
                "visibility": "unlisted",
            },
            idempotency_key="idemp_uuid_777",
        ),
    )

    assert result.success is True
    assert result.external_post_id == "1100223344"
    assert result.external_url == "https://mastodon.social/@alice/1100223344"

    assert recorded_data[0]["status"] == "Exciting announcement!"
    assert recorded_data[0]["spoiler_text"] == "Product Launch CW"
    assert recorded_data[0]["visibility"] == "unlisted"
    assert recorded_headers[0]["idempotency-key"] == "idemp_uuid_777"


@pytest.mark.anyio
async def test_delete_post(mock_mastodon_account):
    def handler(request: httpx.Request) -> httpx.Response:
        assert str(request.url) == "https://mastodon.social/api/v1/statuses/1100223344"
        assert request.method == "DELETE"
        return httpx.Response(200)

    mock_client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    adapter = MastodonAdapter(http_client=mock_client)

    await adapter.delete_post(mock_mastodon_account, "1100223344")


@pytest.mark.anyio
async def test_fetch_metrics(mock_mastodon_account):
    def handler(request: httpx.Request) -> httpx.Response:
        assert str(request.url) == "https://mastodon.social/api/v1/statuses/1100223344"
        return httpx.Response(
            200,
            json={
                "id": "1100223344",
                "favourites_count": 56,
                "reblogs_count": 18,
                "replies_count": 7,
                "visibility": "public",
            },
        )

    mock_client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    adapter = MastodonAdapter(http_client=mock_client)

    metrics = await adapter.fetch_metrics(mock_mastodon_account, "1100223344")
    assert metrics.likes == 56
    assert metrics.comments == 7
    assert metrics.shares_reposts == 18
    assert metrics.engagements == 56 + 18 + 7


@pytest.mark.anyio
async def test_fetch_account_metrics(mock_mastodon_account):
    """Verify whole-account follower and status count analytics from original Mastodon instance source."""
    def handler(request: httpx.Request) -> httpx.Response:
        assert str(request.url) == "https://mastodon.social/api/v1/accounts/verify_credentials"
        return httpx.Response(
            200,
            json={
                "id": "109876",
                "username": "alice",
                "acct": "alice@mastodon.social",
                "followers_count": 4820,
                "following_count": 390,
                "statuses_count": 1420,
            },
        )

    mock_client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    adapter = MastodonAdapter(http_client=mock_client)

    account_metrics = await adapter.fetch_account_metrics(mock_mastodon_account)
    assert account_metrics.followers_count == 4820
    assert account_metrics.following_count == 390
    assert account_metrics.posts_count == 1420
    assert account_metrics.extras["instance_domain"] == "mastodon.social"
