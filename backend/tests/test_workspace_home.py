from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from uuid import uuid4

import pytest
from sqlalchemy import event

from app.db.session import SessionLocal, engine
from app.modules.channels.models import ConnectedAccount
from app.modules.content.home import home_summary
from app.modules.content.models import Post, PostVariant
from app.modules.workspaces.models import Workspace, WorkspaceMembership


@pytest.fixture
def home(client, auth):
    orphan = client.post(
        "/api/v1/posts", headers=auth, json={"base_text": "An unassigned idea"}
    ).json()
    now = datetime.now(UTC)
    with SessionLocal.begin() as db:
        account = ConnectedAccount(
            workspace_id=orphan["workspace_id"],
            platform="x",
            external_account_id="own",
            display_name="Writer",
            encrypted_access_token="private-token",
        )
        reconnect = ConnectedAccount(
            workspace_id=orphan["workspace_id"],
            platform="threads",
            external_account_id="reconnect",
            display_name="Reconnect me",
            status="needs_reauth",
        )
        private = Workspace(owner_user_id=orphan["author_id"], name="Private", slug=str(uuid4()))
        db.add_all([account, reconnect, private])
        db.flush()
        private_post = Post(
            workspace_id=private.id,
            author_id=orphan["author_id"],
            title="Private post",
            base_text="Never leak this",
        )
        db.add(private_post)
        db.flush()
        db.add(
            PostVariant(
                post_id=private_post.id, platform="x", status="failed", idempotency_key=str(uuid4())
            )
        )
        ids = []
        for status, date in [
            ("draft", now),
            ("draft", now - timedelta(hours=1)),
            ("scheduled", now + timedelta(days=2)),
            ("scheduled", now - timedelta(hours=1)),
            ("publishing", now),
            ("published", now - timedelta(days=1)),
            ("published", now - timedelta(days=9)),
            ("published", now + timedelta(days=1)),
            ("failed", now),
            ("rejected", now),
        ]:
            post = Post(
                workspace_id=orphan["workspace_id"],
                author_id=orphan["author_id"],
                title=status,
                base_text="Base copy",
            )
            db.add(post)
            db.flush()
            variant = PostVariant(
                post_id=post.id,
                connected_account_id=account.id,
                platform="x",
                status=status,
                payload={"thread": [{"text": "Root text"}, {"text": "Continuation"}]},
                updated_at=date,
                scheduled_time=date if status in {"scheduled", "publishing"} else None,
                published_at=date if status == "published" else None,
                last_error="Please reconnect" if status == "failed" else None,
                idempotency_key=str(uuid4()),
            )
            db.add(variant)
            db.flush()
            ids.append(variant.id)
        return {
            "workspace": orphan["workspace_id"],
            "orphan": orphan["id"],
            "account": account.id,
            "ids": ids,
        }


def test_home_is_workspace_scoped_local_only_and_excludes_credentials(
    client, auth, home, monkeypatch
):
    def no_api(*args, **kwargs):
        pytest.fail("Home must never call a social platform")

    monkeypatch.setattr("app.modules.channels.registry.channel_registry.get", no_api)
    response = client.get("/api/v1/posts/home", headers=auth)
    assert response.status_code == 200, response.text
    assert response.headers["cache-control"] == "private, no-store"
    data = response.json()
    assert data["workspace_id"] == home["workspace"]
    assert data["counts"] == {
        "drafts": 3,
        "scheduled": 3,
        "published_week": 1,
        "published": 3,
        "failed": 2,
    }
    assert data["can_edit"]
    assert len(data["accounts"]) == 2
    assert "private-token" not in response.text
    assert "encrypted_access_token" not in response.text
    assert "Never leak this" not in response.text
    assert any(p["post_id"] == home["orphan"] and p["variant_id"] is None for p in data["drafts"])
    assert data["upcoming"][0]["status"] == "publishing"
    assert [p["variant_id"] for p in data["upcoming"][1:]] == [home["ids"][3], home["ids"][2]]
    assert data["drafts"][0]["text"] in {"An unassigned idea", "Root text"}
    assert {p["status"] for p in data["failed"]} == {"failed", "rejected"}
    assert all("Continuation" not in p["text"] for p in data["drafts"])
    assert client.get("/api/v1/posts/home").status_code == 401
    assert (
        client.get(
            "/api/v1/posts/home", headers={**auth, "X-Workspace-ID": str(uuid4())}
        ).status_code
        == 403
    )


def test_home_limits_previews_without_truncating_counts_and_has_fixed_query_cost(home):
    with SessionLocal.begin() as db:
        post = db.get(Post, home["orphan"])
        for i in range(100):
            db.add(
                PostVariant(
                    post_id=post.id,
                    platform="instagram",
                    status="draft",
                    payload={"caption": "c" * 1000},
                    idempotency_key=str(uuid4()),
                )
            )
    queries = []

    def record(conn, cursor, statement, parameters, context, executemany):
        queries.append(statement)

    event.listen(engine, "before_cursor_execute", record)
    try:
        with SessionLocal() as db:
            result = home_summary(db, SimpleNamespace(id=home["workspace"], name="Workspace"), True)
        assert len(result.drafts) == 3
        assert (
            result.counts["drafts"] == 102
        )  # The orphan now has variants, counted once per destination.
        assert all(len(p.text) <= 600 for p in result.drafts)
        assert len(queries) == 12  # Six preview queries plus six bounded usage queries. No lazy loads.
    finally:
        event.remove(engine, "before_cursor_execute", record)


def test_home_empty_workspace_has_real_zeroes(client, auth):
    response = client.get("/api/v1/posts/home", headers=auth)
    assert response.status_code == 200
    data = response.json()
    assert all(v == 0 for v in data["counts"].values())
    assert all(data[key] == [] for key in ["accounts", "drafts", "upcoming", "published", "failed"])


def test_home_respects_read_only_membership(client, auth, home):
    with SessionLocal.begin() as db:
        member = db.query(WorkspaceMembership).filter_by(workspace_id=home["workspace"]).one()
        member.role = "viewer"
    response = client.get("/api/v1/posts/home", headers=auth)
    assert response.status_code == 200, response.text
    assert response.json()["can_edit"] is False
