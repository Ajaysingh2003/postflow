import json
from types import SimpleNamespace
from urllib.parse import parse_qs

import httpx
import pytest

from app.modules.channels.adapters.media import bind_uploaded_media, remote_urls
from app.modules.channels.adapters.threads import ThreadsAdapter
from app.modules.channels.models import ConnectedAccount
from app.modules.channels.oauth import encrypt_token
from app.modules.channels.registry import channel_registry
from app.modules.publishing.service import validate_variant


@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.mark.anyio
@pytest.mark.parametrize(
    "payload",
    [
        {"text": "Question", "poll": {"options": ["yes"]}},
        {"text": "Question", "poll": {"options": ["yes", " "]}},
        {"text": "Question", "poll": {"options": ["a" * 26, "no"]}},
        {"text": "Question", "poll": {"options": ["yes", "no"]}, "media_ids": ["asset"]},
        {
            "text": "Question",
            "poll": {"options": ["yes", "no"]},
            "link_attachment": "https://example.com",
        },
        {"thread": [{"text": "First"}, {"text": "Second", "poll": {"options": []}}]},
    ],
)
async def test_threads_rejects_invalid_poll_payloads(payload):
    assert await ThreadsAdapter().validate(SimpleNamespace(payload=payload))


@pytest.mark.anyio
async def test_thread_reply_containers_and_polls_resume_without_recreating_or_reposting():
    created, published = [], []
    ready = False

    def handler(request):
        nonlocal ready
        if request.method == "POST" and request.url.path.endswith("/threads"):
            data = {key: values[0] for key, values in parse_qs(request.content.decode()).items()}
            created.append(data)
            if len(created) == 1:
                assert json.loads(data["poll_attachment"]) == {"option_a": "Yes", "option_b": "No"}
                assert "reply_to_id" not in data
            else:
                assert data["reply_to_id"] == "post-1"
                assert data["image_url"] == "https://media.example/image.png"
            return httpx.Response(200, json={"id": f"container-{len(created)}"})
        if request.method == "GET":
            return httpx.Response(
                200,
                json={
                    "status": "FINISHED"
                    if ready or request.url.path.endswith("container-1")
                    else "IN_PROGRESS"
                },
            )
        if request.url.path.endswith("/threads_publish"):
            published.append(parse_qs(request.content.decode())["creation_id"][0])
            return httpx.Response(200, json={"id": f"post-{len(published)}"})
        pytest.fail("Unexpected Threads request")

    variant = SimpleNamespace(
        payload={
            "thread": [
                {"text": "Question", "poll": {"options": ["Yes", "No"]}},
                {"text": "Follow up", "media_urls": ["https://media.example/image.png"]},
            ]
        },
        idempotency_key="draft",
        publish_state={},
    )
    account = SimpleNamespace(
        external_account_id="creator", encrypted_access_token=encrypt_token("token")
    )
    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        adapter = ThreadsAdapter(http_client=client)
        assert adapter.capabilities.supports_polls and adapter.capabilities.supports_threads
        assert await adapter.validate(variant) == []
        result = await adapter.publish(account, variant)
        assert result.waiting_for_media
        assert len(created) == 2 and len(published) == 1
        ready = True
        result = await adapter.publish(account, variant)
        assert result.success and result.external_post_id == "post-1"
        await adapter.publish(account, variant)
        assert len(created) == 2 and len(published) == 2


@pytest.mark.anyio
async def test_each_thread_post_gets_its_own_media_and_alt_text(monkeypatch):
    monkeypatch.setattr(
        "app.modules.channels.adapters.media.public_media_url",
        lambda asset: f"https://media.example/{asset.id}",
    )
    assets = [
        (SimpleNamespace(id="a", content_type="image/png"), "First image"),
        (SimpleNamespace(id="b", content_type="image/jpeg"), "Second image"),
    ]
    variant = SimpleNamespace(
        payload={
            "thread": [
                {"text": "First", "media_ids": ["a"]},
                {"text": "Second", "media_ids": ["b"]},
            ]
        }
    )
    await remote_urls(None, None, variant, assets)
    first, second = variant.payload["thread"]
    assert first["media_urls"] == ["https://media.example/a"]
    assert second["media_urls"] == ["https://media.example/b"]
    assert second["media_alt_texts"] == ["Second image"]
    assert second["media_types"] == ["image/jpeg"]


@pytest.mark.parametrize("field", ["media_ids", "media_blobs"])
def test_uploaded_media_stays_on_its_post_after_retry(field):
    assets = [(SimpleNamespace(id="a"), ""), (SimpleNamespace(id="b"), "")]
    uploaded = ["provider-a", "provider-b"]
    variant = SimpleNamespace(
        payload={
            "thread": [
                {"text": "First", "media_ids": ["a"]},
                {"text": "Second", "media_ids": ["b"]},
            ]
        }
    )
    for _ in range(2):
        bind_uploaded_media(variant, assets, uploaded, field)
        first, second = variant.payload["thread"]
        assert first[field] == ["provider-a"]
        assert second[field] == ["provider-b"]
        assert second["media_asset_ids"] == ["b"]


def test_legacy_thread_attachments_are_assigned_only_to_root():
    variant = SimpleNamespace(payload={"thread": ["First", "Second"]})
    bind_uploaded_media(variant, [(SimpleNamespace(id="a"), "")], ["provider-a"], "media_ids")
    assert variant.payload["thread"][0]["media_ids"] == ["provider-a"]
    assert variant.payload["thread"][1]["media_ids"] == []


@pytest.mark.anyio
async def test_media_limit_and_validation_apply_to_each_post(monkeypatch):
    adapter = ThreadsAdapter()
    assets = [(SimpleNamespace(id=str(i), content_type="image/png"), "") for i in range(21)]
    monkeypatch.setattr(channel_registry, "get", lambda _: adapter)
    monkeypatch.setattr("app.modules.media.publishing.media_for_variant", lambda *args: assets)
    account = SimpleNamespace(workspace_id="workspace", platform="threads", status="active")
    db = SimpleNamespace(
        scalar=lambda _: account,
        get=lambda model, _: (
            account if model is ConnectedAccount else SimpleNamespace(workspace_id="workspace")
        ),
    )
    variant = SimpleNamespace(
        platform="threads",
        connected_account_id="account",
        post_id="post",
        payload={
            "thread": [
                {"text": "First", "media_asset_ids": [str(i) for i in range(20)]},
                {"text": "Second", "media_asset_ids": ["20"]},
            ]
        },
    )
    assert await validate_variant(variant, db) == []
    variant.payload["thread"][0]["media_asset_ids"].append("20")
    assert any(
        "Too many attachments" in issue.message for issue in await validate_variant(variant, db)
    )
