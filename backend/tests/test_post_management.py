"""Manual management is scoped, permission-aware and durable before sending."""

import json
from datetime import UTC, datetime
from types import SimpleNamespace
from urllib.parse import parse_qs
from uuid import uuid4

import httpx
import pytest
from sqlalchemy import select

from app.db.session import SessionLocal
from app.modules.channels.adapters.bluesky import BlueskyAdapter
from app.modules.channels.adapters.linkedin import LinkedInAdapter
from app.modules.channels.adapters.mastodon import MastodonAdapter
from app.modules.channels.adapters.reddit import RedditAdapter
from app.modules.channels.adapters.threads import ThreadsAdapter
from app.modules.channels.adapters.x import XAdapter
from app.modules.channels.models import ConnectedAccount
from app.modules.channels.oauth import encrypt_token
from app.modules.channels.registry import channel_registry
from app.modules.content.models import PostVariant
from app.modules.publishing.models import PublishAttempt


@pytest.fixture
def managed_post(client):
    owner = client.post("/api/v1/auth/register", json={"email": "manager@example.com", "name": "Manager", "password": "long enough password"}).json()
    headers = {"Authorization": "Bearer " + owner["access_token"]}
    with SessionLocal() as db:
        account = ConnectedAccount(workspace_id=owner["workspace_id"], platform="mastodon", external_account_id="owner", display_name="Manager", encrypted_access_token=encrypt_token("access"), status="active", account_metadata={"instance_domain": "social.example", "instance_config": {"max_characters": 500, "fetched_at": datetime.now(UTC).isoformat()}})
        db.add(account)
        db.commit()
        account_id = account.id
    post = client.post("/api/v1/posts", headers=headers, json={"title": "Original", "variants": [{"platform": "mastodon", "connected_account_id": account_id, "payload": {"text": "Original text"}}]}).json()
    variant_id = post["variants"][0]["id"]
    with SessionLocal() as db:
        variant = db.get(PostVariant, variant_id)
        variant.status = "published"
        variant.external_post_id = "original"
        db.commit()
    return headers, variant_id


def test_management_rejects_foreign_workspace_and_missing_permissions(client, managed_post):
    headers, identifier = managed_post
    foreign = client.post("/api/v1/auth/register", json={"email": "outsider@example.com", "name": "Outsider", "password": "long enough password"}).json()
    url = f"/api/v1/post-management/variants/{identifier}"
    assert client.get(url + "/actions", headers={"Authorization": "Bearer " + foreign["access_token"]}).status_code == 404
    with SessionLocal() as db:
        account = db.get(ConnectedAccount, db.get(PostVariant, identifier).connected_account_id)
        account.status = "needs_reauth"
        db.commit()
    assert not client.get(url + "/actions", headers=headers).json()["can_reply"]
    assert client.post(url + "/reply", headers=headers, json={"text": "Hello", "request_id": str(uuid4())}).status_code == 422


def test_reply_target_binding_deduplication_and_attempt_before_send(client, managed_post, monkeypatch):
    headers, identifier = managed_post
    sent = []
    def handler(request):
        if request.method == "GET":
            return httpx.Response(200, json={"descendants": [{"id": "comment", "account": {"acct": "reader"}, "content": "<p>A question</p>"}]})
        with SessionLocal() as db:
            attempt = db.scalar(select(PublishAttempt).where(PublishAttempt.variant_id == identifier))
            assert attempt.result == "reply_pending"
        sent.append(json.loads(request.content))
        return httpx.Response(200, json={"id": "answer", "url": "https://social.example/@owner/answer"})
    http = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    monkeypatch.setitem(channel_registry._adapters, "mastodon", MastodonAdapter(http_client=http))
    url = f"/api/v1/post-management/variants/{identifier}"
    token = client.get(url + "/replies", headers=headers).json()["items"][0]["target_token"]
    payload = {"text": "My answer", "request_id": str(uuid4()), "target_token": token}
    assert client.post(url + "/reply", headers=headers, json=payload).status_code == 200
    assert client.post(url + "/reply", headers=headers, json=payload).status_code == 200
    assert len(sent) == 1 and sent[0]["in_reply_to_id"] == "comment"
    assert client.post(url + "/reply", headers=headers, json={**payload, "text": "Different"}).status_code == 409
    assert client.post(url + "/reply", headers=headers, json={**payload, "request_id": str(uuid4()), "target_token": "tampered"}).status_code == 422


def test_uncertain_reply_is_held_and_not_repeated(client, managed_post, monkeypatch):
    headers, identifier = managed_post
    calls = []
    def handler(request):
        calls.append(request)
        raise httpx.ReadTimeout("Response lost")
    monkeypatch.setitem(channel_registry._adapters, "mastodon", MastodonAdapter(http_client=httpx.AsyncClient(transport=httpx.MockTransport(handler))))
    url = f"/api/v1/post-management/variants/{identifier}"
    payload = {"text": "A reply", "request_id": str(uuid4())}
    assert client.post(url + "/reply", headers=headers, json=payload).status_code == 502
    assert client.post(url + "/reply", headers=headers, json=payload).status_code == 409
    assert client.post(url + "/reply", headers=headers, json={**payload, "request_id": str(uuid4())}).status_code == 422
    assert len(calls) == 1
    with SessionLocal() as db:
        assert db.scalar(select(PublishAttempt).where(PublishAttempt.variant_id == identifier)).result == "reply_unknown"
        assert db.get(PostVariant, identifier).status == "published"


def test_published_edit_updates_provider_and_local_variant(client, managed_post, monkeypatch):
    headers, identifier = managed_post
    def handler(request):
        assert request.method == "PUT"
        assert json.loads(request.content)["status"] == "Updated text"
        return httpx.Response(200, json={"id": "original"})
    monkeypatch.setitem(channel_registry._adapters, "mastodon", MastodonAdapter(http_client=httpx.AsyncClient(transport=httpx.MockTransport(handler))))
    url = f"/api/v1/post-management/variants/{identifier}/published"
    response = client.patch(url, headers=headers, json={"text": "Updated text", "request_id": str(uuid4())})
    assert response.status_code == 200, response.text
    with SessionLocal() as db:
        row = db.get(PostVariant, identifier)
        assert row.payload["text"] == "Updated text" and row.status == "published"
        assert db.scalar(select(PublishAttempt).where(PublishAttempt.variant_id == identifier)).result == "edit_succeeded"


def test_published_delete_retains_local_audit(client, managed_post, monkeypatch):
    headers, identifier = managed_post
    def handler(request):
        assert request.method == "DELETE"
        return httpx.Response(200, json={})
    monkeypatch.setitem(channel_registry._adapters, "mastodon", MastodonAdapter(http_client=httpx.AsyncClient(transport=httpx.MockTransport(handler))))
    response = client.post(f"/api/v1/post-management/variants/{identifier}/delete-published", headers=headers, json={"request_id": str(uuid4())})
    assert response.status_code == 200
    with SessionLocal() as db:
        assert db.get(PostVariant, identifier).status == "deleted"
        assert db.scalar(select(PublishAttempt).where(PublishAttempt.variant_id == identifier)).result == "delete_succeeded"


@pytest.mark.anyio
@pytest.mark.parametrize("adapter_cls", [XAdapter, RedditAdapter, LinkedInAdapter, ThreadsAdapter])
async def test_official_reply_request_formats(adapter_cls):
    def handler(request):
        body = json.loads(request.content) if request.headers.get("content-type", "").startswith("application/json") else parse_qs(request.content.decode())
        if adapter_cls is XAdapter:
            assert body["reply"]["in_reply_to_tweet_id"] == "comment"
            return httpx.Response(201, json={"data": {"id": "answer"}})
        if adapter_cls is RedditAdapter:
            assert request.headers["User-Agent"].startswith("draftva")
            assert body["thing_id"] == ["comment"]
            return httpx.Response(200, json={"json": {"errors": [], "data": {"things": [{"data": {"name": "answer"}}]}}})
        if adapter_cls is LinkedInAdapter:
            assert body["parentComment"] == "comment" and body["actor"] == "urn:li:person:owner"
            return httpx.Response(201, headers={"x-restli-id": "answer"})
        if request.url.path.endswith("/threads"):
            assert body["reply_to_id"] == ["comment"]
            return httpx.Response(200, json={"id": "container"})
        assert body["creation_id"] == ["container"]
        return httpx.Response(200, json={"id": "answer"})
    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as http:
        account = SimpleNamespace(encrypted_access_token=encrypt_token("access"), external_account_id="owner", account_metadata={"person_urn": "urn:li:person:owner"})
        variant = SimpleNamespace(external_post_id="original", payload={})
        assert (await adapter_cls(http_client=http).reply_to_post(account, variant, "An answer", {"id": "comment"}, str(uuid4()))).external_id == "answer"


@pytest.mark.anyio
async def test_bluesky_reply_uses_actual_root_and_parent_cids(monkeypatch):
    def handler(request):
        if request.method == "GET":
            return httpx.Response(200, json={"thread": {"post": {"uri": "at://did:plc:owner/app.bsky.feed.post/root", "cid": "root-cid", "record": {"text": "Root"}}}})
        data = json.loads(request.content)
        assert data["record"]["reply"] == {"root": {"uri": "at://did:plc:owner/app.bsky.feed.post/root", "cid": "root-cid"}, "parent": {"uri": "at://did:plc:reader/app.bsky.feed.post/comment", "cid": "comment-cid"}}
        return httpx.Response(200, json={"uri": "at://did:plc:owner/app.bsky.feed.post/answer", "cid": "answer-cid"})
    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as http:
        adapter = BlueskyAdapter(http_client=http)
        async def oauth(client, method, url, account=None, **kwargs):
            return await client.request(method, url, **kwargs)
        monkeypatch.setattr(adapter, "_oauth_request", oauth)
        account = SimpleNamespace(encrypted_access_token=encrypt_token("access"), external_account_id="did:plc:owner", account_metadata={"pds_url": "https://pds.example"})
        variant = SimpleNamespace(external_post_id="at://did:plc:owner/app.bsky.feed.post/root", payload={})
        result = await adapter.reply_to_post(account, variant, "An answer", {"id": "at://did:plc:reader/app.bsky.feed.post/comment", "metadata": {"cid": "comment-cid"}}, str(uuid4()))
        assert result.external_id.endswith("/answer")


def test_reply_permissions_are_not_advertised_without_scopes():
    account = SimpleNamespace(granted_scopes=[], account_metadata={})
    variant = SimpleNamespace(external_post_id="123", payload={}, publish_state={})
    for adapter in (RedditAdapter(), LinkedInAdapter(), ThreadsAdapter()):
        actions = adapter.post_actions(account, variant)
        assert not actions.can_reply and not actions.can_read_replies


def test_post_filter_and_pagination_are_workspace_scoped(client, managed_post):
    headers, _ = managed_post
    assert len(client.get("/api/v1/posts?variant_status=published&limit=1", headers=headers).json()) == 1
    assert client.get("/api/v1/posts?variant_status=draft", headers=headers).json() == []
    assert client.get("/api/v1/posts?offset=1", headers=headers).json() == []


@pytest.mark.anyio
async def test_optional_management_oauth_permissions():
    for adapter, expected in [(RedditAdapter(), "edit"), (LinkedInAdapter(), "r_organization_social_feed"), (ThreadsAdapter(), "threads_read_replies")]:
        auth = await adapter.build_auth_url(
            "workspace", "state", manage_replies=True,
            redirect_uri=f"https://api.draftva.test/api/v1/channels/{adapter.platform}/callback",
        )
        assert expected in auth.metadata["requested_scopes"]
