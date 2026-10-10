"""Regression coverage for tenant boundaries and external side-effect recovery."""

import asyncio
import json
from datetime import UTC, datetime, timedelta
from itertools import pairwise
from types import SimpleNamespace
from uuid import uuid4

import httpx
import pytest
from fastapi import HTTPException
from sqlalchemy import func, select

from app.core.config import Settings, get_settings
from app.core.safe_http import public_url
from app.db.session import SessionLocal
from app.modules.assistant.base import LLMResponse
from app.modules.assistant.llm_client import LLMClient
from app.modules.assistant.models import AssistantRun
from app.modules.assistant.service import execute_feature
from app.modules.billing.entitlements import entitlement_limit, get_plan_limits_summary
from app.modules.billing.models import EntitlementGrant, UsageLedger
from app.modules.channels.adapters.bluesky import count_graphemes, extract_facets
from app.modules.channels.adapters.instagram import InstagramAdapter
from app.modules.channels.adapters.text import x_length
from app.modules.channels.adapters.x import XAdapter
from app.modules.channels.models import ConnectedAccount
from app.modules.channels.oauth import (
    disconnect_account,
    encrypt_token,
)
from app.modules.channels.registry import channel_registry
from app.modules.publishing.models import PublishAttempt
from app.modules.publishing.rate_limiter import PlatformRateLimiter, RatePolicy
from app.modules.publishing.service import (
    publish_variant_job,
    recover_stale_publications,
    schedule_variant,
    validate_variant,
)


@pytest.fixture
def owners(client):
    result = []
    for index in range(2):
        response = client.post(
            "/api/v1/auth/register",
            json={
                "email": f"review{index}@example.com",
                "password": "a sufficiently long password",
                "name": "Reviewer",
            },
        )
        assert response.status_code == 201
        row = response.json()
        row["headers"] = {"Authorization": "Bearer " + row["access_token"]}
        result.append(row)
    return result


def account_for(owner, platform="x", **kwargs):
    with SessionLocal() as db:
        account = ConnectedAccount(
            workspace_id=owner["workspace_id"],
            platform=platform,
            external_account_id=str(uuid4()),
            display_name="Review account",
            encrypted_access_token=encrypt_token("access"),
            status="active",
            **kwargs,
        )
        db.add(account)
        db.commit()
        return account.id


def create_variant(client, owner, account, platform="x", payload=None):
    response = client.post(
        "/api/v1/posts",
        headers=owner["headers"],
        json={
            "variants": [
                {
                    "platform": platform,
                    "connected_account_id": account,
                    "payload": payload or {"text": "Hello"},
                }
            ]
        },
    )
    assert response.status_code == 201, response.text
    return response.json()["variants"][0]["id"]


def test_foreign_account_and_platform_are_rejected(client, owners):
    foreign = account_for(owners[1])
    own = account_for(owners[0], "linkedin")
    for account in (foreign, own):
        response = client.post(
            "/api/v1/posts",
            headers=owners[0]["headers"],
            json={"variants": [{"platform": "x", "connected_account_id": account}]},
        )
        assert response.status_code == 404


@pytest.mark.anyio
async def test_job_rechecks_tenant_boundary(client, owners):
    from app.modules.content.models import PostVariant

    own = account_for(owners[0])
    foreign = account_for(owners[1])
    variant = create_variant(client, owners[0], own)
    with SessionLocal() as db:
        db.get(PostVariant, variant).connected_account_id = foreign
        db.commit()
        with pytest.raises(HTTPException) as raised:
            await publish_variant_job(variant, db)
        assert raised.value.status_code == 403


@pytest.mark.anyio
@pytest.mark.parametrize(
    "platform,payload",
    [
        ("x", {"text": "Hello"}),
        ("linkedin", {"text": "Hello"}),
        ("bluesky", {"text": "Hello"}),
        ("mastodon", {"text": "Hello"}),
        ("facebook", {"text": "Hello", "page_id": "page1"}),
        (
            "instagram",
            {"caption": "Hello", "target_id": "ig1", "image_url": "https://example.com/image.jpg"},
        ),
        ("threads", {"text": "Hello"}),
    ],
)
async def test_validation_contract_for_every_non_reddit_adapter(client, owners, platform, payload):
    from app.modules.content.models import PostVariant

    account = account_for(owners[0], platform)
    variant = create_variant(client, owners[0], account, platform, payload)
    with SessionLocal() as db:
        assert await validate_variant(db.get(PostVariant, variant), db) == []


@pytest.mark.anyio
async def test_foreign_voice_profile_does_not_reach_llm(client, owners):
    response = client.post(
        "/api/v1/assistant/voice-profiles",
        headers=owners[1]["headers"],
        json={"tone_description": "Private tone"},
    )
    assert response.status_code == 201

    class NeverCall:
        async def generate_structured(self, **kwargs):
            pytest.fail("Foreign voice must be rejected before generation")

    with SessionLocal() as db, pytest.raises(HTTPException) as raised:
        await execute_feature(
            owners[0]["workspace_id"],
            owners[0]["user_id"],
            "x_hook_variants",
            {"topic": "Useful software lessons"},
            voice_profile_id=response.json()["id"],
            db=db,
            llm=NeverCall(),
        )
    assert raised.value.status_code == 404


@pytest.mark.anyio
async def test_competing_publisher_cannot_send_same_variant(client, owners, monkeypatch):
    from app.modules.channels.base import PublishResult
    from app.modules.content.models import PostVariant

    adapter = XAdapter()
    sends = []
    account = account_for(owners[0])
    variant = create_variant(client, owners[0], account)

    async def publish(account, current):
        with SessionLocal() as other:
            with pytest.raises(HTTPException) as raised:
                await publish_variant_job(current.id, other)
            assert raised.value.status_code == 409
            pending = other.scalar(
                select(PublishAttempt).where(PublishAttempt.variant_id == current.id)
            )
            assert pending.result == "publishing"
        sends.append(current.id)
        return PublishResult(success=True, external_post_id="remote1")

    monkeypatch.setitem(channel_registry._adapters, "x", adapter)
    monkeypatch.setattr(adapter, "publish", publish)
    with SessionLocal() as db:
        assert (await publish_variant_job(variant, db)).result == "success"
        assert (await publish_variant_job(variant, db)).result == "success"
        assert db.get(PostVariant, variant).published_at is not None
        assert db.scalar(select(func.count()).select_from(UsageLedger)) == 1
    assert sends == [variant]


@pytest.mark.anyio
async def test_uncertain_outcome_blocks_retries_and_edits(client, owners, monkeypatch):
    from app.modules.channels.base import PublishResult

    adapter = XAdapter()

    async def publish(account, variant):
        return PublishResult(success=False, outcome_unknown=True, error_message="Lost response")

    monkeypatch.setitem(channel_registry._adapters, "x", adapter)
    monkeypatch.setattr(adapter, "publish", publish)
    variant = create_variant(client, owners[0], account_for(owners[0]))
    with SessionLocal() as db:
        assert (await publish_variant_job(variant, db)).result == "outcome_unknown"
        with pytest.raises(HTTPException):
            await publish_variant_job(variant, db)
        with pytest.raises(HTTPException):
            await schedule_variant(db, variant)
    assert (
        client.patch(
            f"/api/v1/variants/{variant}",
            headers=owners[0]["headers"],
            json={"payload": {"text": "Changed"}},
        ).status_code
        == 409
    )


def test_stale_claim_requires_reconciliation(client, owners):
    from app.modules.content.models import PostVariant

    variant = create_variant(client, owners[0], account_for(owners[0]))
    with SessionLocal() as db:
        row = db.get(PostVariant, variant)
        row.status = "publishing"
        row.publishing_started_at = datetime.now(UTC) - timedelta(hours=1)
        db.add(
            PublishAttempt(
                variant_id=variant, started_at=row.publishing_started_at, result="publishing"
            )
        )
        db.commit()
        assert recover_stale_publications(db) == 1
        assert row.publish_state["outcome_unknown"]
        assert db.scalar(select(PublishAttempt)).result == "outcome_unknown"


@pytest.mark.anyio
async def test_immediate_publish_obeys_quota(client, owners):
    variant = create_variant(client, owners[0], account_for(owners[0]))
    with SessionLocal() as db:
        db.add(
            EntitlementGrant(
                workspace_id=owners[0]["workspace_id"],
                capability="scheduled_posts",
                limit_value=0,
                source="manual",
            )
        )
        db.commit()
        with pytest.raises(HTTPException) as raised:
            await publish_variant_job(variant, db)
        assert raised.value.status_code == 403


@pytest.mark.anyio
async def test_sqlite_naive_expiry_refreshes(client, owners, monkeypatch):
    from app.modules.channels.base import PublishResult

    refreshed = []
    adapter = XAdapter()

    async def refresh(account):
        refreshed.append(account.id)
        account.token_expires_at = datetime.now(UTC) + timedelta(hours=1)
        return account

    async def publish(account, variant):
        return PublishResult(success=True, external_post_id="remote2")

    monkeypatch.setitem(channel_registry._adapters, "x", adapter)
    monkeypatch.setattr(adapter, "refresh_tokens", refresh)
    monkeypatch.setattr(adapter, "publish", publish)
    account = account_for(owners[0], token_expires_at=datetime.now(UTC) - timedelta(seconds=1))
    variant = create_variant(client, owners[0], account)
    with SessionLocal() as db:
        assert (await publish_variant_job(variant, db)).result == "success"
    assert refreshed == [account]


@pytest.mark.anyio
async def test_revocation_failure_preserves_account_and_marks_reauth(owners):
    async def fail(account):
        raise RuntimeError("Provider unavailable")

    account = account_for(owners[0])
    with SessionLocal() as db:
        row = db.get(ConnectedAccount, account)
        with pytest.raises(HTTPException):
            await disconnect_account(db, row, SimpleNamespace(revoke=fail))
        assert db.get(ConnectedAccount, account).status == "needs_reauth"


@pytest.mark.anyio
async def test_atomic_limiter_and_retry_after():
    limiter = PlatformRateLimiter(policies={"reddit": RatePolicy(3, 60, scope="app")})
    admitted = await asyncio.gather(*(limiter.acquire("reddit", f"account{i}") for i in range(10)))
    assert sum(allowed for allowed, _ in admitted) == 3
    other = PlatformRateLimiter(policies={"x": RatePolicy(10, 60)})
    await other.observe("x", "account", {"retry-after": "30"})
    assert (await other.acquire("x", "account"))[0] is False


@pytest.mark.parametrize(
    "url",
    [
        "http://127.0.0.1/",
        "http://169.254.169.254/",
        "http://[::1]/",
        "http://10.1.2.3/",
        "file:///etc/passwd",
        "https://user:password@example.com/",
        "https://example.com:8443/",
    ],
)
def test_ssrf_private_and_unsafe_urls_rejected(url):
    with pytest.raises(HTTPException):
        public_url(url)


def test_dns_rebinding_to_private_address_is_rejected(monkeypatch):
    monkeypatch.setattr(
        "app.core.safe_http.socket.getaddrinfo",
        lambda *a, **kw: [(2, 1, 6, "", ("127.0.0.1", 443))],
    )
    with pytest.raises(HTTPException):
        public_url("https://public-looking.example/")


def test_text_weights_and_complete_graphemes():
    assert x_length("界" * 140) == 280
    assert x_length("👨‍👩‍👧‍👦") == 2
    assert x_length("https://example.com/" + "a" * 100) == 23
    assert x_length("e\u0301") == 1
    assert count_graphemes("👨‍👩‍👧‍👦🇮🇳👍🏽e\u0301") == 4
    assert not any(
        f["features"][0]["$type"].endswith("mention") for f in extract_facets("@unknown.example")
    )


@pytest.mark.anyio
async def test_x_thread_resumes_after_partial_success():
    calls = []

    def handler(request):
        body = json.loads(request.content)
        calls.append(body)
        if len(calls) == 2:
            return httpx.Response(429, json={"detail": "Slow down"})
        return httpx.Response(201, json={"data": {"id": str(len(calls))}})

    account = SimpleNamespace(encrypted_access_token=encrypt_token("access"))
    variant = SimpleNamespace(payload={"thread": ["First", "Second"]}, publish_state={})
    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        adapter = XAdapter(http_client=client)
        assert (await adapter.publish(account, variant)).is_retryable
        assert variant.publish_state["thread_ids"] == ["1"]
        assert (await adapter.publish(account, variant)).success
    assert [c["text"] for c in calls] == ["First", "Second", "Second"]
    assert calls[2]["reply"] == {"in_reply_to_tweet_id": "1"}


@pytest.mark.anyio
async def test_instagram_waits_and_reuses_container():
    calls = []
    ready = False

    def handler(request):
        calls.append((request.method, request.url.path))
        if request.url.path.endswith("/media"):
            return httpx.Response(200, json={"id": "container"})
        if request.url.path.endswith("/container"):
            return httpx.Response(200, json={"status_code": "FINISHED" if ready else "IN_PROGRESS"})
        if request.url.path.endswith("/media_publish"):
            return httpx.Response(200, json={"id": "posted"})
        pytest.fail(str(request.url))

    account = SimpleNamespace(
        account_metadata={"primary_ig_id": "professional"},
        encrypted_access_token=encrypt_token("access"),
    )
    variant = SimpleNamespace(
        payload={"caption": "Hello", "image_url": "https://example.com/image.jpg"}, publish_state={}
    )
    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        adapter = InstagramAdapter(http_client=client)
        assert (await adapter.publish(account, variant)).waiting_for_media
        assert not any(p.endswith("media_publish") for _, p in calls)
        ready = True
        assert (await adapter.publish(account, variant)).success
    assert sum(p.endswith("/media") for _, p in calls) == 1


@pytest.mark.anyio
async def test_assistant_validates_every_thread_item_and_logs_failure(owners):
    class LongSecondItem:
        async def generate_structured(self, messages, response_model):
            return response_model(tweets=["Valid", "界" * 141], total_tweets=2), LLMResponse(
                content="", total_tokens=200
            )

    with SessionLocal() as db:
        with pytest.raises(HTTPException) as raised:
            await execute_feature(
                owners[0]["workspace_id"],
                owners[0]["user_id"],
                "x_thread_writer",
                {"text": "An interesting practical explanation of concurrency"},
                db=db,
                llm=LongSecondItem(),
            )
        assert raised.value.status_code == 422
        record = db.scalar(select(AssistantRun))
        assert record.status == "failed" and record.tokens_used == 200
        assert db.scalar(select(UsageLedger)).amount == 200


def test_unlimited_and_expired_grants(owners):
    workspace = owners[0]["workspace_id"]
    with SessionLocal() as db:
        db.add_all(
            [
                EntitlementGrant(
                    workspace_id=workspace,
                    capability="ai_credits",
                    limit_value=None,
                    source="manual",
                ),
                EntitlementGrant(
                    workspace_id=workspace,
                    capability="connected_accounts",
                    limit_value=50,
                    source="manual",
                    expires_at=datetime.now(UTC) - timedelta(seconds=1),
                ),
            ]
        )
        db.commit()
        assert entitlement_limit(db, workspace, "connected_accounts") == 2
        summary = get_plan_limits_summary(db, workspace)
        assert summary["ai_credits"]["limit"] is None and summary["ai_credits"]["remaining"] is None


def test_templates_and_variant_editing_are_scoped(client, owners):
    created = client.post(
        "/api/v1/templates",
        headers=owners[0]["headers"],
        json={"name": "Weekly", "base_text": "Update"},
    )
    assert created.status_code == 201
    assert client.get("/api/v1/templates", headers=owners[1]["headers"]).json() == []
    assert (
        client.delete(
            "/api/v1/templates/" + created.json()["id"], headers=owners[1]["headers"]
        ).status_code
        == 404
    )
    variant = create_variant(client, owners[0], account_for(owners[0]))
    assert (
        client.patch(
            f"/api/v1/variants/{variant}",
            headers=owners[1]["headers"],
            json={"payload": {"text": "Foreign"}},
        ).status_code
        == 404
    )
    assert (
        client.patch(
            f"/api/v1/variants/{variant}",
            headers=owners[0]["headers"],
            json={"payload": {"text": "Changed"}},
        ).json()["payload"]["text"]
        == "Changed"
    )


def test_production_rejects_development_secret_and_mock_output():
    from pydantic import ValidationError

    for values in (
        {"app_secret": "development-only-secret-change-me", "llm_mock_enabled": False},
        {"app_secret": "a" * 48, "llm_mock_enabled": True},
    ):
        with pytest.raises(ValidationError):
            Settings(_env_file=None, app_env="production", **values)


@pytest.mark.anyio
async def test_unconfigured_ai_cannot_return_fake_success(monkeypatch):
    monkeypatch.setattr(get_settings(), "llm_mock_enabled", False)
    llm = LLMClient()
    llm.api_key = None
    from app.modules.assistant.schemas import XHookVariantsOutput

    with pytest.raises(HTTPException) as raised:
        await llm.generate_structured([], XHookVariantsOutput)
    assert raised.value.status_code == 503


def test_oauth_replay_and_encryption_key_rotation(owners, monkeypatch):
    from cryptography.fernet import Fernet

    from app.modules.channels.oauth import (
        create_oauth_state,
        decrypt_token,
        verify_and_consume_oauth_state,
    )

    with SessionLocal() as db:
        _, state = create_oauth_state(db, owners[0]["workspace_id"], owners[0]["user_id"], "x")
        assert verify_and_consume_oauth_state(db, "x", state).user_id == owners[0]["user_id"]
        with pytest.raises(HTTPException):
            verify_and_consume_oauth_state(db, "x", state)
    legacy = encrypt_token("existing credential")
    first = Fernet.generate_key().decode()
    second = Fernet.generate_key().decode()
    settings = get_settings()
    monkeypatch.setattr(settings, "token_encryption_key", first)
    encrypted = encrypt_token("rotated credential")
    assert decrypt_token(legacy) == "existing credential"
    monkeypatch.setattr(settings, "token_encryption_key", second)
    monkeypatch.setattr(settings, "token_encryption_previous_keys", first)
    assert decrypt_token(encrypted) == "rotated credential"


@pytest.mark.anyio
async def test_dpop_nonce_signature_and_token_binding():
    import base64
    import hashlib

    from cryptography.hazmat.primitives import hashes, serialization
    from cryptography.hazmat.primitives.asymmetric import ec
    from cryptography.hazmat.primitives.asymmetric.utils import encode_dss_signature

    from app.modules.channels.adapters.bluesky import BlueskyAdapter

    key = ec.generate_private_key(ec.SECP256R1())
    pem = key.private_bytes(
        serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption()
    ).decode()
    account = SimpleNamespace(
        encrypted_access_token=encrypt_token("access"),
        account_metadata={"oauth": {"encrypted_dpop_key": encrypt_token(pem)}},
    )
    claims_seen = []

    def handler(request):
        parts = request.headers["DPoP"].split(".")
        signature = base64.urlsafe_b64decode(parts[2] + "==")
        key.public_key().verify(
            encode_dss_signature(
                int.from_bytes(signature[:32], "big"), int.from_bytes(signature[32:], "big")
            ),
            (parts[0] + "." + parts[1]).encode(),
            ec.ECDSA(hashes.SHA256()),
        )
        claims = json.loads(base64.urlsafe_b64decode(parts[1] + "=="))
        assert claims["htu"] == "https://pds.example/xrpc/read"
        assert claims["htm"] == "GET"
        assert claims["ath"] == base64.urlsafe_b64encode(
            hashlib.sha256(b"access").digest()
        ).decode().rstrip("=")
        assert request.headers["Authorization"] == "DPoP access"
        claims_seen.append(claims)
        if len(claims_seen) == 1:
            return httpx.Response(
                401, json={"error": "use_dpop_nonce"}, headers={"DPoP-Nonce": "server-nonce"}
            )
        assert claims["nonce"] == "server-nonce"
        return httpx.Response(200, json={"ok": True})

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        response = await BlueskyAdapter(http_client=client)._oauth_request(
            client, "GET", "https://pds.example/xrpc/read?query=hello", account=account
        )
    assert response.status_code == 200
    assert claims_seen[0]["jti"] != claims_seen[1]["jti"]
    assert account.account_metadata["oauth"]["nonces"]["https://pds.example/"] == "server-nonce"


@pytest.mark.anyio
async def test_threads_oauth_refresh_publish_delete():
    from app.modules.channels.adapters.threads import ThreadsAdapter
    from app.modules.channels.oauth import decrypt_token

    calls = []

    def handler(request):
        calls.append((request.method, request.url.path))
        if request.url.path == "/oauth/access_token":
            assert b"grant_type=authorization_code" in request.content
            return httpx.Response(200, json={"access_token": "short"})
        if request.url.path == "/access_token":
            assert request.url.params["grant_type"] == "th_exchange_token"
            return httpx.Response(200, json={"access_token": "long", "expires_in": 5184000})
        if request.url.path == "/v1.0/me":
            return httpx.Response(200, json={"id": "creator", "username": "reviewer"})
        if request.url.path == "/refresh_access_token":
            return httpx.Response(200, json={"access_token": "refreshed", "expires_in": 5184000})
        if request.url.path.endswith("/threads"):
            return httpx.Response(200, json={"id": "container"})
        if request.url.path == "/v1.0/container":
            return httpx.Response(200, json={"status": "FINISHED"})
        if request.url.path.endswith("/threads_publish"):
            return httpx.Response(200, json={"id": "published"})
        if request.method == "DELETE":
            return httpx.Response(200, json={"success": True})
        pytest.fail(str(request.url))

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        adapter = ThreadsAdapter(app_id="app", app_secret="secret", http_client=client)
        adapter.redirect_base_url = "https://draftva.example/api/v1/channels/threads/callback"
        start = await adapter.build_auth_url("ws", "state")
        assert "state=state" in start.auth_url
        account = await adapter.handle_callback("ws", {"code": "code"}, "state")
        assert decrypt_token(account.encrypted_access_token) == "long"
        await adapter.refresh_tokens(account)
        assert decrypt_token(account.encrypted_access_token) == "refreshed"
        result = await adapter.publish(
            account, SimpleNamespace(payload={"text": "Hello Threads"}, publish_state={})
        )
        assert result.external_post_id == "published"
        await adapter.delete_post(account, result.external_post_id)
        await adapter.revoke(account)
    assert ("DELETE", "/v1.0/published") in calls


@pytest.mark.anyio
async def test_x_video_upload_resumes_processing(monkeypatch):
    from app.modules.channels.adapters.media import upload_x
    from app.modules.channels.base import MediaProcessingPending

    monkeypatch.setattr("app.modules.media.service.read_ready", lambda *args: b"video bytes")
    calls = []
    ready = False

    def handler(request):
        calls.append((request.method, request.url.path))
        if request.url.path.endswith("initialize"):
            return httpx.Response(200, json={"data": {"id": "123"}})
        if request.url.path.endswith("append"):
            assert json.loads(request.content)["segment_index"] == 0
            return httpx.Response(200, json={})
        if request.url.path.endswith("finalize"):
            return httpx.Response(200, json={"data": {"processing_info": {"state": "pending"}}})
        assert request.url.params["media_id"] == "123"
        return httpx.Response(
            200,
            json={
                "data": {
                    "processing_info": {
                        "state": "succeeded" if ready else "pending",
                        "check_after_secs": 5,
                    }
                }
            },
        )

    variant = SimpleNamespace(payload={}, publish_state={})
    asset = SimpleNamespace(content_type="video/mp4")
    account = SimpleNamespace(encrypted_access_token=encrypt_token("access"))
    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        adapter = XAdapter(http_client=client)
        with pytest.raises(MediaProcessingPending):
            await upload_x(adapter, account, variant, [(asset, "")])
        assert variant.publish_state["uploaded_media"] == ["123"]
        ready = True
        await upload_x(adapter, account, variant, [(asset, "")])
    assert variant.payload["media_ids"] == ["123"]
    assert sum(path.endswith("initialize") for _, path in calls) == 1


@pytest.mark.anyio
async def test_linkedin_video_upload_finalizes_and_resumes(monkeypatch):
    from app.modules.channels.adapters.linkedin import LinkedInAdapter
    from app.modules.channels.base import MediaProcessingPending

    monkeypatch.setattr("app.modules.media.service.read_ready", lambda *args: b"four bytes")
    ready = False
    calls = []

    def handler(request):
        calls.append(request)
        if request.url.params.get("action") == "initializeUpload":
            body = json.loads(request.content)["initializeUploadRequest"]
            assert body["fileSizeBytes"] == 10
            return httpx.Response(
                200,
                json={
                    "value": {
                        "video": "urn:li:video:123",
                        "uploadToken": "token",
                        "uploadInstructions": [
                            {
                                "firstByte": 0,
                                "lastByte": 9,
                                "uploadUrl": "https://upload.linkedin.example/part",
                            }
                        ],
                    }
                },
            )
        if request.method == "PUT":
            assert request.content == b"four bytes"
            return httpx.Response(200, headers={"ETag": '"part1"'})
        if request.url.params.get("action") == "finalizeUpload":
            assert json.loads(request.content)["finalizeUploadRequest"]["uploadedPartIds"] == [
                "part1"
            ]
            return httpx.Response(200, json={})
        return httpx.Response(200, json={"status": "AVAILABLE" if ready else "PROCESSING"})

    account = SimpleNamespace(
        encrypted_access_token=encrypt_token("access"),
        account_metadata={"person_urn": "urn:li:person:owner"},
    )
    variant = SimpleNamespace(payload={}, publish_state={})
    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        adapter = LinkedInAdapter(http_client=client)
        with pytest.raises(MediaProcessingPending):
            await adapter.prepare_media(
                account, variant, [(SimpleNamespace(content_type="video/mp4"), "")]
            )
        ready = True
        await adapter.prepare_media(
            account, variant, [(SimpleNamespace(content_type="video/mp4"), "")]
        )
    assert variant.payload["media_urns"] == ["urn:li:video:123"]
    assert sum(r.method == "PUT" for r in calls) == 1


def test_uploaded_dimensions_alt_text_and_media_tenant_boundaries(client, owners, monkeypatch):
    import io

    from PIL import Image

    data = io.BytesIO()
    Image.new("RGB", (120, 90), "blue").save(data, "PNG")
    monkeypatch.setattr(
        "app.modules.media.service.client",
        lambda *_: SimpleNamespace(put_object=lambda **kwargs: {"ETag": "etag"}),
    )
    monkeypatch.setattr("app.modules.media.service.scan_clamav", lambda *args: None)
    response = client.post(
        "/api/v1/media/attachments",
        headers=owners[0]["headers"],
        data={"content_type": "image/png", "purpose": "post"},
        files={"file": ("image.png", data.getvalue(), "image/png")},
    )
    assert response.status_code == 201, response.text
    asset = response.json()
    assert (asset["width"], asset["height"]) == (120, 90)
    assert (
        client.patch(
            "/api/v1/media/" + asset["id"],
            headers=owners[0]["headers"],
            json={"alt_text": "A blue rectangle"},
        ).status_code
        == 200
    )
    foreign_account = account_for(owners[1])
    response = client.post(
        "/api/v1/posts",
        headers=owners[1]["headers"],
        json={
            "variants": [
                {
                    "platform": "x",
                    "connected_account_id": foreign_account,
                    "media_asset_ids": [asset["id"]],
                }
            ]
        },
    )
    assert response.status_code == 422
    assert (
        client.patch(
            "/api/v1/media/" + asset["id"],
            headers=owners[1]["headers"],
            json={"alt_text": "Foreign change"},
        ).status_code
        == 404
    )


@pytest.mark.anyio
async def test_reddit_paginates_and_preserves_cache_on_failure():
    from app.modules.channels.adapters.reddit import RedditAdapter
    from app.modules.channels.models import SubredditProfile

    calls = []

    def handler(request):
        calls.append(request)
        if "subscriber" in request.url.path:
            second = request.url.params.get("after") == "next"
            return httpx.Response(
                200,
                json={
                    "data": {
                        "after": None if second else "next",
                        "children": [{"data": {"display_name": "rust" if second else "python"}}],
                    }
                },
            )
        return httpx.Response(503, json={"error": "upstream down"})

    account = SimpleNamespace(encrypted_access_token=encrypt_token("access"))
    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        adapter = RedditAdapter(http_client=client)
        assert [t.id for t in await adapter.list_targets(account)] == ["python", "rust"]
        with SessionLocal() as db:
            profile = SubredditProfile(
                name="rust",
                rules=[{"short_name": "Keep useful rules"}],
                fetched_at=datetime.now(UTC) - timedelta(days=2),
            )
            db.add(profile)
            db.commit()
            prior = profile.fetched_at
            with pytest.raises(httpx.HTTPStatusError):
                await adapter.refresh_subreddit_profile(db, account, "rust")
            db.refresh(profile)
            assert profile.rules == [{"short_name": "Keep useful rules"}]
            assert profile.fetched_at.replace(tzinfo=UTC) == prior.replace(tzinfo=UTC)
    assert all(request.headers["User-Agent"].startswith("draftva") for request in calls)


def test_email_delivery_uses_tls_and_configured_links(monkeypatch):
    from app.modules.identity.mail import deliver_token

    settings = get_settings()
    monkeypatch.setattr(settings, "smtp_host", "smtp.example")
    monkeypatch.setattr(settings, "frontend_url", "https://app.draftva.example")
    sent = []

    class SMTP:
        def __init__(self, host, port, timeout):
            assert host == "smtp.example"

        def __enter__(self):
            return self

        def __exit__(self, *args):
            return False

        def starttls(self, context):
            import ssl

            assert context.verify_mode == ssl.CERT_REQUIRED
            sent.append("tls")

        def send_message(self, message):
            sent.append(message)

    monkeypatch.setattr("app.modules.identity.mail.smtplib.SMTP", SMTP)
    deliver_token("member@example.com", "one-time-token", "invitations/accept")
    assert sent[0] == "tls"
    assert (
        "https://app.draftva.example/invitations/accept?token=one-time-token"
        in sent[1].get_content()
    )


@pytest.mark.anyio
async def test_provider_bad_schema_still_records_billed_tokens(owners):
    def handler(request):
        return httpx.Response(
            200,
            json={
                "choices": [{"message": {"content": "not JSON"}}],
                "usage": {"total_tokens": 177},
            },
        )

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        llm = LLMClient(
            api_key="test-key",
            base_url="https://model.example/v1",
            model="test-model",
            http_client=client,
        )
        with SessionLocal() as db, pytest.raises(ValueError):
            await execute_feature(
                owners[0]["workspace_id"],
                owners[0]["user_id"],
                "x_hook_variants",
                {"topic": "Reliable scheduling"},
                db=db,
                llm=llm,
            )
            pytest.fail("Invalid provider content must fail")
        with SessionLocal() as db:
            assert db.scalar(select(AssistantRun)).tokens_used == 177
            assert db.scalar(select(UsageLedger)).amount == 177


@pytest.mark.anyio
async def test_metrics_fetch_has_no_100_variant_or_50_account_cap(owners, monkeypatch):
    from app.modules.analytics.models import MetricSnapshot
    from app.modules.channels.base import AccountMetrics, Metrics
    from app.modules.content.models import Post, PostVariant

    class Adapter:
        async def fetch_metrics(self, account, identifier, context=None):
            return Metrics(likes=1)

        async def fetch_account_metrics(self, account):
            return AccountMetrics(followers_count=1)

    monkeypatch.setitem(channel_registry._adapters, "x", Adapter())
    with SessionLocal() as db:
        post = Post(
            workspace_id=owners[0]["workspace_id"],
            author_id=owners[0]["user_id"],
            base_text="Old draft, published today",
            created_at=datetime.now(UTC) - timedelta(days=90),
        )
        db.add(post)
        db.flush()
        accounts = [
            ConnectedAccount(
                workspace_id=post.workspace_id,
                platform="x",
                external_account_id=f"acc{i}",
                display_name="Account",
                status="active",
            )
            for i in range(51)
        ]
        db.add_all(accounts)
        db.flush()
        db.add_all(
            [
                PostVariant(
                    post_id=post.id,
                    connected_account_id=accounts[i % 51].id,
                    platform="x",
                    payload={"text": "Published"},
                    status="published",
                    external_post_id=f"post{i}",
                    idempotency_key=str(uuid4()),
                    published_at=datetime.now(UTC),
                    created_at=datetime.now(UTC) - timedelta(days=90),
                )
                for i in range(101)
            ]
        )
        db.commit()
        assert db.scalar(select(func.count()).select_from(MetricSnapshot)) == 0
        from app.modules.analytics.service import get_workspace_overview

        assert (await get_workspace_overview(db, post.workspace_id)).total_posts_published == 101
        assert db.scalar(select(func.count()).select_from(MetricSnapshot)) == 0


@pytest.mark.anyio
async def test_x_5xx_result_is_held_for_reconciliation():
    async with httpx.AsyncClient(
        transport=httpx.MockTransport(
            lambda request: httpx.Response(503, json={"error": "lost upstream response"})
        )
    ) as client:
        result = await XAdapter(http_client=client).publish(
            SimpleNamespace(encrypted_access_token=encrypt_token("access")),
            SimpleNamespace(payload={"text": "Hello"}),
        )
    assert not result.success and result.outcome_unknown and not result.is_retryable


@pytest.mark.anyio
async def test_mastodon_thread_keeps_parent_ids_and_distinct_idempotency_keys():
    from urllib.parse import parse_qs

    from app.modules.channels.adapters.mastodon import MastodonAdapter

    calls = []

    def handler(request):
        calls.append(request)
        return httpx.Response(
            200, json={"id": str(len(calls)), "url": "https://mastodon.example/post"}
        )

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        adapter = MastodonAdapter(http_client=client)
        variant = SimpleNamespace(
            payload={"thread": ["First", "Second"]}, publish_state={}, idempotency_key="thread-key"
        )
        result = await adapter.publish(
            SimpleNamespace(
                encrypted_access_token=encrypt_token("access"),
                account_metadata={"instance_domain": "mastodon.example"},
            ),
            variant,
        )
    assert result.success and result.external_post_id == "1"
    assert parse_qs(calls[1].content.decode())["in_reply_to_id"] == ["1"]
    assert [r.headers["Idempotency-Key"] for r in calls] == ["thread-key:0", "thread-key:1"]
    assert len(variant.publish_state["thread_posts"]) == 2


@pytest.mark.anyio
async def test_bluesky_thread_builds_strong_references(monkeypatch):
    from app.modules.channels.adapters.bluesky import BlueskyAdapter

    calls = []

    async def send(client, method, url, **kwargs):
        calls.append(kwargs["json"])
        return httpx.Response(
            200,
            json={
                "uri": f"at://did:plc:owner/app.bsky.feed.post/{len(calls)}",
                "cid": f"cid{len(calls)}",
            },
        )

    async with httpx.AsyncClient(
        transport=httpx.MockTransport(lambda _: httpx.Response(200))
    ) as client:
        adapter = BlueskyAdapter(http_client=client)
        monkeypatch.setattr(adapter, "_oauth_request", send)
        result = await adapter.publish(
            SimpleNamespace(
                encrypted_access_token=encrypt_token("access"),
                external_account_id="did:plc:owner",
                account_metadata={"pds_url": "https://pds.example"},
            ),
            SimpleNamespace(
                payload={"thread": ["One", "Two", "Three"]},
                publish_state={},
                idempotency_key="thread-key",
            ),
        )
    assert result.success
    assert calls[2]["record"]["reply"]["root"]["cid"] == "cid1"
    assert calls[2]["record"]["reply"]["parent"]["cid"] == "cid2"
    assert len({r["rkey"] for r in calls}) == 3


@pytest.mark.anyio
async def test_waiting_media_does_not_exhaust_normal_retry_attempts(client, owners, monkeypatch):
    from app.modules.channels.base import MediaProcessingPending
    from app.modules.content.models import PostVariant, PostVariantMedia
    from app.modules.media.models import MediaAsset

    adapter = XAdapter()

    async def prepare(account, variant, assets):
        raise MediaProcessingPending("Still processing")

    monkeypatch.setattr(adapter, "prepare_media", prepare)
    monkeypatch.setitem(channel_registry._adapters, "x", adapter)
    variant_id = create_variant(client, owners[0], account_for(owners[0]))
    with SessionLocal() as db:
        asset = MediaAsset(
            workspace_id=owners[0]["workspace_id"],
            uploaded_by_user_id=owners[0]["user_id"],
            object_key="ready/video",
            original_filename="video.mp4",
            content_type="video/mp4",
            declared_size=10,
            actual_size=10,
            status="ready",
        )
        db.add(asset)
        db.flush()
        db.add(PostVariantMedia(variant_id=variant_id, media_asset_id=asset.id))
        db.commit()
        for _ in range(6):
            assert (await publish_variant_job(variant_id, db)).result == "retryable_error"
        variant = db.get(PostVariant, variant_id)
        assert variant.attempt_count == 0
        assert variant.status == "scheduled"
        assert variant.publish_state["processing_checks"] == 6


def test_stream_returns_only_validated_complete_output(client, owners):
    response = client.post(
        "/api/v1/assistant/features/x_hook_variants/stream",
        headers=owners[0]["headers"],
        json={"input_data": {"topic": "Testing reliable backend jobs"}},
    )
    assert response.status_code == 200
    assert "event: progress" in response.text
    assert "event: complete" in response.text
    assert "event: error" not in response.text


def test_additive_migration_preserves_existing_data_and_matches_models(tmp_path):
    import os
    import sqlite3
    import subprocess
    import sys
    from pathlib import Path

    database = tmp_path / "migration.db"
    env = {**os.environ, "DATABASE_URL": f"sqlite:///{database}"}
    root = Path(__file__).resolve().parents[1]

    def migration(*args):
        result = subprocess.run(
            [sys.executable, "-m", "alembic", *args],
            cwd=root,
            env=env,
            text=True,
            capture_output=True,
            timeout=60,
            check=False,
        )
        assert result.returncode == 0, result.stdout + result.stderr

    migration("upgrade", "ceb2b91baf53")
    with sqlite3.connect(database) as db:
        db.execute(
            "INSERT INTO users (id,email,name,email_verified,is_active,created_at,updated_at) VALUES (?,?,?,?,?,?,?)",
            (
                "preserved",
                "existing@example.com",
                "Existing user",
                1,
                1,
                "2026-01-01",
                "2026-01-01",
            ),
        )
    migration("upgrade", "head")
    migration("check")
    with sqlite3.connect(database) as db:
        assert (
            db.execute("SELECT email FROM users WHERE id='preserved'").fetchone()[0]
            == "existing@example.com"
        )
        assert db.execute("SELECT count(*) FROM plans").fetchone()[0] == 6
    migration("downgrade", "ceb2b91baf53")
    with sqlite3.connect(database) as db:
        assert db.execute("SELECT count(*) FROM users").fetchone()[0] == 1
    migration("upgrade", "head")


@pytest.mark.anyio
async def test_meta_account_edge_pagination_and_host_check():
    from app.modules.channels.adapters.meta import graph_items

    def handler(request):
        return httpx.Response(200, json={"data": [{"id": "second"}]})

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        first = httpx.Response(
            200,
            json={
                "data": [{"id": "first"}],
                "paging": {"next": "https://graph.facebook.com/v23.0/me/accounts?after=next"},
            },
            request=httpx.Request("GET", "https://graph.facebook.com/v23.0/me/accounts"),
        )
        assert [p["id"] for p in await graph_items(client, first)] == ["first", "second"]
        unsafe = httpx.Response(
            200,
            json={"data": [], "paging": {"next": "http://127.0.0.1/private"}},
            request=first.request,
        )
        with pytest.raises(RuntimeError):
            await graph_items(client, unsafe)


@pytest.mark.anyio
async def test_http_wrapper_limits_each_provider_request(monkeypatch):
    from app.modules.channels.support import AdapterHTTP

    observed = []

    class Limiter:
        async def acquire(self, platform, account):
            observed.append((platform, account))
            return True, 0

        async def observe(self, platform, account, headers):
            assert headers["x-rate-limit-remaining"] == "1"

    monkeypatch.setattr("app.modules.channels.support.shared_rate_limiter", Limiter())
    async with AdapterHTTP(
        "x",
        account_id="owned",
        transport=httpx.MockTransport(
            lambda _: httpx.Response(200, headers={"x-rate-limit-remaining": "1"})
        ),
    ) as client:
        await client.get("https://api.x.com/2/users/me")
        await client.post("https://api.x.com/2/tweets", json={"text": "Hello"})
    assert observed == [("x", "owned"), ("x", "owned")]


@pytest.mark.anyio
async def test_real_redis_reservations_are_shared_when_ci_service_is_available():
    import os

    from redis.asyncio import Redis

    url = os.environ.get("draftva_TEST_REDIS_URL")
    if not url:
        pytest.skip("An isolated Redis service is required")
    redis = Redis.from_url(url)
    account = "test-" + str(uuid4())
    first = PlatformRateLimiter(policies={"x": RatePolicy(3, 60)}, redis_client=redis)
    second = PlatformRateLimiter(policies={"x": RatePolicy(3, 60)}, redis_client=redis)
    try:
        outcomes = await asyncio.gather(
            *((first if i % 2 else second).acquire("x", account) for i in range(20))
        )
        assert sum(allowed for allowed, _ in outcomes) == 3
        await first.observe("x", account, {"retry-after": "30"})
        assert not (await second.acquire("x", account))[0]
    finally:
        key = first._get_key("x", account)
        await redis.delete(key + ":bucket", key + ":blocked")
        await redis.aclose()


def test_reconciliation_is_workspace_scoped_and_audited(client, owners, monkeypatch):
    from app.modules.channels.base import Metrics
    from app.modules.content.models import PostVariant

    adapter = XAdapter()

    async def metrics(account, identifier, context=None):
        assert identifier == "verified-remote-post"
        return Metrics(likes=1)

    monkeypatch.setattr(adapter, "fetch_metrics", metrics)
    monkeypatch.setitem(channel_registry._adapters, "x", adapter)
    variant = create_variant(client, owners[0], account_for(owners[0]))
    with SessionLocal() as db:
        row = db.get(PostVariant, variant)
        row.status = "failed"
        row.publish_state = {"outcome_unknown": True}
        db.commit()
    url = f"/api/v1/publishing/variants/{variant}/reconcile"
    assert (
        client.post(
            url, headers=owners[1]["headers"], json={"external_post_id": "verified-remote-post"}
        ).status_code
        == 404
    )
    response = client.post(
        url, headers=owners[0]["headers"], json={"external_post_id": "verified-remote-post"}
    )
    assert response.status_code == 200 and response.json()["status"] == "published"
    with SessionLocal() as db:
        assert (
            db.scalar(select(PublishAttempt).where(PublishAttempt.variant_id == variant)).result
            == "reconciled"
        )


def test_health_readiness_and_eight_registered_channels(client):
    assert client.get("/health").status_code == 200
    assert client.get("/ready").status_code == 200
    capabilities = client.get("/api/v1/channels/capabilities").json()["platforms"]
    assert set(capabilities) == {
        "x",
        "linkedin",
        "reddit",
        "bluesky",
        "mastodon",
        "facebook",
        "instagram",
        "threads",
    }


def test_unicode_facets_do_not_overlap_links_or_include_punctuation():
    text = "🚀 https://example.com/path#embedded, #हिन्दी @alice.bsky.social."
    facets = extract_facets(text, {"alice.bsky.social": "did:plc:alice"})
    pieces = [
        text.encode()[f["index"]["byteStart"] : f["index"]["byteEnd"]].decode() for f in facets
    ]
    assert pieces == ["https://example.com/path#embedded", "#हिन्दी", "@alice.bsky.social"]
    assert all(a["index"]["byteEnd"] <= b["index"]["byteStart"] for a, b in pairwise(facets))


@pytest.mark.anyio
async def test_public_transport_pins_connection_and_restores_original_url(monkeypatch):
    from app.core.safe_http import PublicTransport

    monkeypatch.setattr("app.core.safe_http.public_url", lambda url: ("public.example", "8.8.8.8"))

    async def underlying(self, request):
        assert request.url.host == "8.8.8.8"
        assert request.headers["Host"] == "public.example"
        assert request.extensions["sni_hostname"] in {"public.example", b"public.example"}
        return httpx.Response(200)

    monkeypatch.setattr(httpx.AsyncHTTPTransport, "handle_async_request", underlying)
    transport = PublicTransport()
    try:
        request = httpx.Request("GET", "https://public.example/path")
        await transport.handle_async_request(request)
        assert str(request.url) == "https://public.example/path"
    finally:
        await transport.aclose()


@pytest.mark.anyio
@pytest.mark.parametrize("count", [1, 2])
async def test_linkedin_image_alt_text_reaches_posts_api(count):
    from app.modules.channels.adapters.linkedin import LinkedInAdapter

    descriptions = ["A chart of monthly growth", "A detailed comparison"][:count]
    urns = [f"urn:li:image:{index}" for index in range(count)]

    def handler(request):
        content = json.loads(request.content)["content"]
        items = content["multiImage"]["images"] if count > 1 else [content["media"]]
        assert [item["altText"] for item in items] == descriptions
        return httpx.Response(201, headers={"x-restli-id": "urn:li:share:published"})

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        adapter = LinkedInAdapter(http_client=client)
        assert "image/webp" not in adapter.capabilities.supported_media_types
        account = SimpleNamespace(
            encrypted_access_token=encrypt_token("access"),
            account_metadata={"person_urn": "urn:li:person:owner"},
        )
        result = await adapter.publish(
            account,
            SimpleNamespace(
                payload={
                    "text": "Image description",
                    "media_urns": urns,
                    "media_alt_texts": descriptions,
                }
            ),
        )
        assert result.success


@pytest.mark.anyio
@pytest.mark.parametrize("count", [1, 2])
async def test_threads_alt_text_reaches_image_containers(count):
    from urllib.parse import parse_qs

    from app.modules.channels.adapters.threads import ThreadsAdapter

    descriptions = ["A monthly growth chart", "A detailed comparison"][:count]
    observed = []

    def handler(request):
        if request.method == "GET":
            return httpx.Response(200, json={"status": "FINISHED"})
        if request.url.path.endswith("/threads_publish"):
            return httpx.Response(200, json={"id": "published"})
        data = parse_qs(request.content.decode())
        if data["media_type"] == ["IMAGE"]:
            observed.append(data["alt_text"][0])
        return httpx.Response(200, json={"id": f"container-{len(observed)}"})

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        account = SimpleNamespace(
            encrypted_access_token=encrypt_token("access"), external_account_id="owner"
        )
        variant = SimpleNamespace(
            payload={
                "text": "Caption",
                "media_urls": [f"https://example.com/{index}.jpg" for index in range(count)],
                "media_alt_texts": descriptions,
            },
            publish_state={},
        )
        result = await ThreadsAdapter(http_client=client).publish(account, variant)
        assert result.success and observed == descriptions
