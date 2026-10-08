from datetime import UTC, datetime, timedelta
from types import SimpleNamespace

import httpx
import pytest
from sqlalchemy import select

from app.db.session import SessionLocal
from app.modules.channels.adapters.text import contains_post_link
from app.modules.channels.adapters.x import XAdapter
from app.modules.channels.models import ConnectedAccount
from app.modules.channels.oauth import encrypt_token
from app.modules.channels.registry import channel_registry
from app.modules.content.models import PostVariant
from app.modules.publishing.service import publish_variant_job


@pytest.mark.parametrize(
    "text",
    [
        "Read https://example.com/news",
        "HTTP://EXAMPLE.COM",
        "Visit www.example.com today",
        "Read\nexample.com/path?ref=post",
        "(blog.example.co.uk)",
        "Try t.co/short",
        "See пример.рф",
        "See xn--e1afmkfd.xn--p1ai",
    ],
)
@pytest.mark.anyio
async def test_x_rejects_links_without_changing_drafts(text):
    payload = {"text": text}
    adapter = XAdapter()
    issues = await adapter.validate(SimpleNamespace(payload=payload))
    assert contains_post_link(text)
    assert any(issue.code == "links_disabled" and issue.field == "text" for issue in issues)
    assert payload == {"text": text}
    assert adapter.publishing_cost(SimpleNamespace(payload=payload)) == 0
    assert not adapter.capabilities.supports_links


@pytest.mark.parametrize(
    "text",
    [
        "An idea worth sharing.",
        "Email writer@example.com or first.last@sub.example.co.uk",
        "Version 1.3.0 costs $3.50",
        "@writer and #Writing",
    ],
)
@pytest.mark.anyio
async def test_x_still_accepts_plain_text_and_email(text):
    assert not contains_post_link(text)
    assert not await XAdapter().validate(SimpleNamespace(payload={"text": text}))


@pytest.mark.anyio
async def test_thread_link_is_identified_and_prevents_partial_publication():
    requests = []

    def handler(request):
        requests.append(request)
        return httpx.Response(201, json={"data": {"id": "unexpected"}})

    payload = {"thread": ["Root without links", {"text": "Then example.com"}]}
    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        adapter = XAdapter(http_client=client)
        issues = await adapter.validate(SimpleNamespace(payload=payload))
        assert [(issue.field, issue.code) for issue in issues] == [
            ("thread.1.text", "links_disabled")
        ]
        result = await adapter.publish(SimpleNamespace(), SimpleNamespace(payload=payload))
        assert not result.success and not result.is_retryable
        assert "Remove links" in result.error_message
        assert not requests


@pytest.mark.anyio
async def test_x_attachment_urls_are_not_post_links():
    payload = {
        "text": "A photo",
        "media_ids": ["image-id"],
        "media_urls": ["https://storage.example.com/image.png"],
    }
    assert not await XAdapter().validate(SimpleNamespace(payload=payload))


@pytest.mark.anyio
@pytest.mark.parametrize("platform", ["linkedin", "bluesky", "mastodon", "facebook", "threads"])
async def test_other_channels_keep_text_links(platform):
    adapter = channel_registry.require(platform)
    issues = await adapter.validate(SimpleNamespace(payload={"text": "Read https://example.com"}))
    assert not any(issue.code == "links_disabled" for issue in issues)


@pytest.mark.anyio
async def test_scheduling_and_queued_x_publish_enforce_link_policy(client, auth, monkeypatch):
    post = client.post("/api/v1/posts", headers=auth, json={"base_text": "A draft"}).json()
    requests = []
    async with httpx.AsyncClient(
        transport=httpx.MockTransport(
            lambda request: requests.append(request) or httpx.Response(500)
        )
    ) as http_client:
        monkeypatch.setitem(channel_registry._adapters, "x", XAdapter(http_client=http_client))
        with SessionLocal.begin() as db:
            account = ConnectedAccount(
                workspace_id=post["workspace_id"],
                platform="x",
                external_account_id="policy-test",
                display_name="Writer",
                encrypted_access_token=encrypt_token("test-token"),
                token_expires_at=datetime.now(UTC) + timedelta(hours=2),
                granted_scopes=["tweet.read", "tweet.write", "users.read", "offline.access"],
                status="active",
            )
            db.add(account)
            db.flush()
            account_id = account.id
        payload = {"thread": [{"text": "First"}, {"text": "Read https://example.com"}]}
        response = client.post(
            f"/api/v1/posts/{post['id']}/variants",
            headers=auth,
            json={"connected_account_id": account_id, "platform": "x", "payload": payload},
        )
        assert response.status_code == 201, response.text
        variant_id = response.json()["id"]
        response = client.post(
            f"/api/v1/publishing/variants/{variant_id}/schedule",
            headers=auth,
            json={"scheduled_time": (datetime.now(UTC) + timedelta(days=1)).isoformat()},
        )
        assert response.status_code == 422, response.text
        assert "Remove links" in response.text
        with SessionLocal() as db:
            variant = db.get(PostVariant, variant_id)
            assert variant.status == "draft" and variant.payload == payload
            # Simulate an older already-queued version from before the policy changed.
            variant.status = "scheduled"
            db.commit()
            attempt = await publish_variant_job(variant_id, db)
            assert attempt.result == "fatal_error" and attempt.status_code == 422
            assert db.get(PostVariant, variant_id).status == "failed"
            from app.modules.billing.models import UsageLedger

            charges = db.scalars(select(UsageLedger).where(UsageLedger.reference_id == variant_id))
            assert sum(charge.amount for charge in charges) == 0
        assert not requests
