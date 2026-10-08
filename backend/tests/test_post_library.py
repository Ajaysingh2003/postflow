from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from uuid import uuid4

import pytest
from sqlalchemy import event

from app.db.session import SessionLocal, engine
from app.modules.channels.models import ConnectedAccount
from app.modules.content.models import Post, PostVariant, PostVariantMedia
from app.modules.content.router import post_library
from app.modules.media.models import MediaAsset
from app.modules.workspaces.models import Workspace


@pytest.fixture
def library(client, auth):
    seed = client.post("/api/v1/posts", headers=auth, json={}).json()
    now = datetime.now(UTC)
    with SessionLocal.begin() as db:
        account = ConnectedAccount(
            workspace_id=seed["workspace_id"],
            platform="x",
            external_account_id="own",
            display_name="Own",
        )
        other = ConnectedAccount(
            workspace_id=seed["workspace_id"],
            platform="threads",
            external_account_id="other",
            display_name="Other",
        )
        private = Workspace(
            owner_user_id=seed["author_id"], name="Private", slug=f"private-{uuid4()}"
        )
        db.add_all([account, other, private])
        db.flush()
        private_account = ConnectedAccount(
            workspace_id=private.id,
            platform="x",
            external_account_id="private",
            display_name="Private",
        )
        db.add(private_account)
        db.flush()
        post = Post(
            workspace_id=seed["workspace_id"],
            author_id=seed["author_id"],
            title="Saved post",
            base_text="Postflow copy",
        )
        hidden = Post(workspace_id=private.id, author_id=seed["author_id"], title="Private post")
        db.add_all([post, hidden])
        db.flush()
        asset = MediaAsset(
            workspace_id=seed["workspace_id"],
            uploaded_by_user_id=seed["author_id"],
            object_key="asset",
            original_filename="image.png",
            content_type="image/png",
            declared_size=10,
            status="ready",
        )
        db.add(asset)
        db.flush()
        ids = []
        for i, status in enumerate(
            ["published", "published", "draft", "failed", "rejected", "scheduled", "publishing"]
        ):
            variant = PostVariant(
                post_id=post.id,
                connected_account_id=account.id,
                platform="x",
                status=status,
                payload={"thread": [{"text": "Root"}, {"text": "Continuation"}]}
                if i == 0
                else {"text": status},
                published_at=now if status == "published" else None,
                scheduled_time=now + timedelta(days=1) if status == "scheduled" else None,
                idempotency_key=str(uuid4()),
                updated_at=now + timedelta(seconds=i),
            )
            variant.media_links = [PostVariantMedia(media_asset_id=asset.id)]
            db.add(variant)
            db.flush()
            ids.append(variant.id)
        db.add_all(
            [
                PostVariant(
                    post_id=post.id,
                    connected_account_id=other.id,
                    platform="threads",
                    status="published",
                    payload={"text": "Other account"},
                    idempotency_key=str(uuid4()),
                ),
                PostVariant(
                    post_id=hidden.id,
                    connected_account_id=private_account.id,
                    platform="x",
                    status="published",
                    payload={"text": "Private copy"},
                    idempotency_key=str(uuid4()),
                ),
            ]
        )
        return {
            "workspace": seed["workspace_id"],
            "account": account.id,
            "other": other.id,
            "private": private_account.id,
            "ids": ids,
            "asset": asset.id,
        }


def test_library_is_stored_only_and_scoped_before_variant_pagination(
    client, auth, library, monkeypatch
):
    def no_platform_calls(*args, **kwargs):
        pytest.fail("Browsing the post library must not call social APIs")

    monkeypatch.setattr("app.modules.channels.registry.channel_registry.get", no_platform_calls)
    params = {"connected_account_id": library["account"], "category": "posts", "limit": 1}
    first = client.get("/api/v1/posts/library", headers=auth, params=params)
    assert first.status_code == 200, first.text
    first = first.json()
    assert first["counts"] == {"posts": 2, "scheduled": 2, "drafts": 3}
    assert first["total"] == 2 and first["next_offset"] == 1
    assert first["items"][0]["id"] == library["ids"][1]
    assert first["items"][0]["media_asset_ids"] == [library["asset"]]
    second = client.get(
        "/api/v1/posts/library", headers=auth, params={**params, "offset": 1}
    ).json()
    assert second["items"][0]["id"] == library["ids"][0]
    assert len(second["items"][0]["payload"]["thread"]) == 2
    assert second["next_offset"] is None
    assert all(
        item["connected_account_id"] == library["account"]
        for item in first["items"] + second["items"]
    )
    private = client.get(
        "/api/v1/posts/library", headers=auth, params={"connected_account_id": library["private"]}
    ).json()
    assert private["items"] == [] and private["total"] == 0
    assert private["counts"] == {"posts": 0, "scheduled": 0, "drafts": 0}


def test_library_keeps_failed_drafts_and_in_flight_schedules(client, auth, library):
    for category, statuses in [
        ("drafts", {"draft", "failed", "rejected"}),
        ("scheduled", {"scheduled", "publishing"}),
    ]:
        data = client.get(
            "/api/v1/posts/library",
            headers=auth,
            params={"connected_account_id": library["account"], "category": category},
        ).json()
        assert {item["status"] for item in data["items"]} == statuses
        assert data["total"] == len(statuses)
    assert (
        client.get(
            "/api/v1/posts/library", headers=auth, params={"category": "replies"}
        ).status_code
        == 422
    )
    assert (
        client.get("/api/v1/posts/library", headers=auth, params={"offset": -1}).status_code == 422
    )
    assert (
        client.get("/api/v1/posts/library", headers=auth, params={"limit": 101}).status_code == 422
    )
    assert client.get("/api/v1/posts/library").status_code == 401


def test_library_bulk_loads_media_without_per_card_queries(library):
    queries = []

    def record(conn, cursor, statement, parameters, context, executemany):
        queries.append(statement)

    event.listen(engine, "before_cursor_execute", record)
    try:
        with SessionLocal() as db:
            result = post_library(
                category="drafts",
                connected_account_id=library["account"],
                offset=0,
                limit=50,
                workspace=SimpleNamespace(id=library["workspace"]),
                db=db,
            )
            assert len(result.items) == 3
            assert all(item.media_asset_ids == [library["asset"]] for item in result.items)
    finally:
        event.remove(engine, "before_cursor_execute", record)
    assert len(queries) == 3  # Grouped counts, bounded variants, bulk attachments.
