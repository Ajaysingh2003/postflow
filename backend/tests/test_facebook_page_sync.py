"""Real Facebook callback routes persist destinations consumed by the composer."""

import asyncio
from types import SimpleNamespace
from urllib.parse import parse_qs

import httpx
import pytest
from sqlalchemy import select

from app.db.session import SessionLocal
from app.modules.billing.models import EntitlementGrant
from app.modules.channels.adapters.facebook import FacebookAdapter
from app.modules.channels.models import ConnectedAccount
from app.modules.channels.oauth import decrypt_token, encrypt_token
from app.modules.channels.registry import channel_registry


def page(page_id="111", token="page-token-111", tasks=None):
    return {
        "id": page_id,
        "name": f"Brand {page_id}",
        "access_token": token,
        "tasks": tasks if tasks is not None else ["CREATE_CONTENT"],
        "picture": {"data": {"url": f"https://cdn.example/{page_id}.jpg"}},
    }


def install_adapter(monkeypatch, snapshot):
    calls = []

    def handler(request):
        calls.append(request)
        path = request.url.path
        if path.endswith("/oauth/access_token"):
            long = request.url.params.get("grant_type") == "fb_exchange_token"
            return httpx.Response(
                200,
                json={
                    "access_token": snapshot.get("user_token", "user-token")
                    if long
                    else "short-token",
                    "expires_in": 5184000,
                },
            )
        if path.endswith("/me"):
            return httpx.Response(200, json={"id": snapshot.get("user_id", "555"), "name": "Owner"})
        if path.endswith("/me/accounts"):
            assert request.url.params["fields"] == "id,name,access_token,tasks,picture"
            assert request.url.params["access_token"] == snapshot.get("user_token", "user-token")
            return httpx.Response(snapshot.get("status", 200), json=snapshot["body"])
        if path.endswith("/next"):
            return httpx.Response(snapshot.get("next_status", 200), json=snapshot["next_body"])
        if request.method == "POST" and path.endswith("/feed"):
            assert parse_qs(request.content.decode())["access_token"] == [snapshot["publish_token"]]
            return httpx.Response(200, json={"id": "111_999"})
        raise AssertionError(f"Unexpected API path {path}")

    http = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    adapter = FacebookAdapter(app_id="test-id", app_secret="test-secret", http_client=http)
    monkeypatch.setitem(channel_registry._adapters, "facebook", adapter)
    return adapter, http, calls


def callback(client, auth, browser=False):
    start = client.post("/api/v1/channels/facebook/connect", headers=auth)
    assert start.status_code == 200, start.text
    state = start.json()["state"]
    assert "business_management" in start.json()["auth_url"]
    if browser:
        result = client.get(
            "/api/v1/channels/facebook/callback",
            params={"code": "code", "state": state},
            headers={"accept": "text/html"},
            follow_redirects=False,
        )
    else:
        result = client.post(
            "/api/v1/channels/facebook/callback", json={"code": "code", "state": state}
        )
    return result, state


def stored_account():
    with SessionLocal() as db:
        account = db.scalar(select(ConnectedAccount).where(ConnectedAccount.platform == "facebook"))
        db.expunge(account)
        return account


def test_callback_pagination_persistence_composer_and_page_token(client, auth, monkeypatch):
    snapshot = {
        "body": {"data": [page()], "paging": {"next": "https://graph.facebook.com/next"}},
        "next_body": {
            "data": [
                page("222", "page-token-222"),
                page("333", tasks=["ANALYZE"]),
                {"id": "444"},
                {"access_token": "unusable"},
            ]
        },
        "publish_token": "page-token-111",
    }
    adapter, http, calls = install_adapter(monkeypatch, snapshot)
    result, state = callback(client, auth, browser=True)
    assert result.status_code == 302
    assert result.headers["location"].endswith("?connected=facebook")
    account = stored_account()
    assert account.external_account_id == "fb_user_555"
    assert account.last_synced_at is not None
    assert decrypt_token(account.encrypted_access_token) == "user-token"
    assert [p["id"] for p in account.account_metadata["pages"]] == ["111", "222"]
    assert decrypt_token(account.account_metadata["page_tokens"]["111"]) == "page-token-111"
    assert "page-token-111" not in str(account.account_metadata)
    before = len(calls)
    targets = client.get(f"/api/v1/channels/accounts/{account.id}/targets", headers=auth)
    assert targets.status_code == 200
    assert len(calls) == before  # Composer reads the saved snapshot without another Graph request.
    assert targets.json()["account_id"] == account.id
    first = targets.json()["targets"][0]
    assert first["id"] == "111" and first["name"] == "Brand 111"
    assert first["target_type"] == "page"
    assert first["metadata"] == {
        "parent_connection_id": account.id,
        "tasks": ["CREATE_CONTENT"],
        "picture_url": "https://cdn.example/111.jpg",
    }
    accounts = client.get("/api/v1/channels/accounts", headers=auth)
    for response in (accounts, targets):
        assert "user-token" not in response.text and "page-token" not in response.text
        assert "page_tokens" not in response.text
    replay = client.post(
        "/api/v1/channels/facebook/callback", json={"code": "code", "state": state}
    )
    assert replay.status_code == 400 and len(calls) == before
    published = asyncio.run(
        adapter.publish(account, SimpleNamespace(payload={"page_id": "111", "text": "Hi"}))
    )
    assert published.success
    asyncio.run(http.aclose())


def test_reconnect_at_quota_replaces_destinations_and_tokens(client, auth, monkeypatch):
    snapshot = {"body": {"data": [page(), page("222", "old-token")]}}
    adapter, http, calls = install_adapter(monkeypatch, snapshot)
    result, _ = callback(client, auth)
    assert result.status_code == 200
    account = stored_account()
    with SessionLocal() as db:
        db.add(
            EntitlementGrant(
                workspace_id=account.workspace_id,
                capability="connected_accounts",
                limit_value=1,
                source="manual",
            )
        )
        db.commit()
    snapshot.update(
        body={"data": [page(token="new-page-token")]},
        user_token="new-user-token",
        publish_token="new-page-token",
    )
    result, _ = callback(client, auth)
    assert result.status_code == 200 and result.json()["id"] == account.id
    assert len(client.get("/api/v1/channels/accounts", headers=auth).json()) == 1
    refreshed = stored_account()
    assert list(refreshed.account_metadata["page_tokens"]) == ["111"]
    assert decrypt_token(refreshed.encrypted_access_token) == "new-user-token"
    assert decrypt_token(refreshed.account_metadata["page_tokens"]["111"]) == "new-page-token"
    assert refreshed.last_synced_at >= account.last_synced_at
    assert asyncio.run(
        adapter.publish(refreshed, SimpleNamespace(payload={"page_id": "111", "text": "Hi"}))
    ).success
    before = len(calls)
    denied = asyncio.run(
        adapter.publish(refreshed, SimpleNamespace(payload={"page_id": "222", "text": "Hi"}))
    )
    assert not denied.success and len(calls) == before
    snapshot["user_id"] = "another-user"
    result, _ = callback(client, auth)
    assert result.status_code == 403  # Starting a reconnect cannot bypass the new-account quota.
    assert len(client.get("/api/v1/channels/accounts", headers=auth).json()) == 1
    asyncio.run(http.aclose())


@pytest.mark.parametrize("failure", ["initial", "next", "malformed", "profile"])
def test_failed_reconnect_preserves_saved_snapshot(client, auth, monkeypatch, failure):
    snapshot = {"body": {"data": [page()]}}
    _, http, _ = install_adapter(monkeypatch, snapshot)
    result, _ = callback(client, auth)
    assert result.status_code == 200
    original = stored_account()
    if failure == "initial":
        snapshot.update(status=403, body={"error": {"message": "private-provider-secret"}})
    elif failure == "next":
        snapshot.update(
            body={"data": [page("999")], "paging": {"next": "https://graph.facebook.com/next"}},
            next_status=500,
            next_body={"error": "private-provider-secret"},
        )
    elif failure == "malformed":
        snapshot["body"] = {"unexpected": []}
    else:
        snapshot["user_id"] = ""
    result, _ = callback(client, auth)
    assert result.status_code in {400, 502}
    assert "private-provider-secret" not in result.text
    saved = stored_account()
    assert saved.id == original.id
    assert saved.account_metadata == original.account_metadata
    assert saved.encrypted_access_token == original.encrypted_access_token
    asyncio.run(http.aclose())


def test_refresh_updates_snapshot_and_preserves_it_on_failure(client, auth, monkeypatch):
    snapshot = {"body": {"data": [page()]}}
    _, http, _ = install_adapter(monkeypatch, snapshot)
    result, _ = callback(client, auth)
    account_id = result.json()["id"]
    snapshot.update(body={"data": [page("222", "fresh-page-token")]}, user_token="fresh-user-token")
    refreshed = client.post(f"/api/v1/channels/accounts/{account_id}/refresh", headers=auth)
    assert refreshed.status_code == 200
    account = stored_account()
    assert decrypt_token(account.account_metadata["page_tokens"]["222"]) == "fresh-page-token"
    target = client.get(f"/api/v1/channels/accounts/{account_id}/targets", headers=auth).json()[
        "targets"
    ][0]
    assert target["id"] == "222" and target["metadata"]["picture_url"].endswith("222.jpg")
    snapshot.update(status=503, body={"error": "private-provider-secret"})
    failed = client.post(f"/api/v1/channels/accounts/{account_id}/refresh", headers=auth)
    assert failed.status_code == 502 and "private-provider-secret" not in failed.text
    saved = stored_account()
    assert saved.account_metadata == account.account_metadata and saved.status == "active"
    assert saved.encrypted_access_token == account.encrypted_access_token
    asyncio.run(http.aclose())


def test_empty_reconnect_removes_destinations_and_reports_next_step(client, auth, monkeypatch):
    snapshot = {"body": {"data": [page()]}}
    adapter, http, calls = install_adapter(monkeypatch, snapshot)
    result, _ = callback(client, auth)
    account_id = result.json()["id"]
    snapshot["body"] = {"data": []}
    result, _ = callback(client, auth)
    assert result.status_code == 200 and result.json()["id"] == account_id
    account = stored_account()
    assert account.account_metadata["pages"] == [] and account.account_metadata["page_tokens"] == {}
    targets = client.get(f"/api/v1/channels/accounts/{account_id}/targets", headers=auth)
    assert targets.status_code == 409 and "Reconnect" in targets.json()["detail"]
    before = len(calls)
    result = asyncio.run(
        adapter.publish(account, SimpleNamespace(payload={"page_id": "111", "text": "Hi"}))
    )
    assert not result.success and len(calls) == before  # Never falls back to the user token.
    asyncio.run(http.aclose())


@pytest.mark.anyio
async def test_legacy_or_inactive_connections_need_reconnect():
    adapter = FacebookAdapter()
    account = ConnectedAccount(
        status="active",
        encrypted_access_token=encrypt_token("user-token"),
        account_metadata={"pages": [{"id": "111", "name": "Page"}]},
    )
    from fastapi import HTTPException

    with pytest.raises(HTTPException, match="Reconnect"):
        await adapter.list_targets(account)
    account.status = "needs_reauth"
    with pytest.raises(HTTPException, match="Reconnect"):
        await adapter.list_targets(account)
