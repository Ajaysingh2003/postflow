from datetime import UTC, datetime, timedelta
from uuid import uuid4

from app.db.session import SessionLocal
from app.modules.content.models import Post, PostVariant
from app.modules.identity.models import User, Workspace


def seed_calendar():
    start = datetime(2026, 10, 5, tzinfo=UTC)
    with SessionLocal.begin() as db:
        owner = db.query(User).filter_by(email="owner@example.com").one()
        workspace = db.query(Workspace).filter_by(owner_user_id=owner.id).one()
        post = Post(workspace_id=workspace.id, author_id=owner.id, title="A calendar post")
        db.add(post)
        db.flush()
        variants = []
        for i, status in enumerate(["draft", "scheduled", "publishing", "published", "failed"]):
            variant = PostVariant(
                post_id=post.id, platform="x", status=status,
                idempotency_key=str(uuid4()), payload={"text": f"Version {i}"},
                scheduled_time=start + timedelta(hours=i),
                published_at=start + timedelta(hours=6) if status == "published" else None,
            )
            db.add(variant)
            variants.append(variant)
        # The end boundary belongs to the next period.
        db.add(PostVariant(post_id=post.id, platform="x", status="scheduled", scheduled_time=start + timedelta(days=1), idempotency_key=str(uuid4())))
        return start


def test_calendar_range_statuses_actual_publication_and_pagination(client, auth):
    start = seed_calendar()
    params = {"start": start.isoformat(), "end": (start + timedelta(days=1)).isoformat(), "limit": 2}
    first = client.get("/api/v1/publishing/calendar", headers=auth, params=params)
    assert first.status_code == 200, first.text
    assert first.json()["next_cursor"] == 2
    second = client.get("/api/v1/publishing/calendar", headers=auth, params={**params, "cursor": 2})
    assert second.json()["next_cursor"] is None
    entries = first.json()["items"] + second.json()["items"]
    assert [entry["variant"]["status"] for entry in entries] == ["scheduled", "publishing", "failed", "published"]
    assert entries[-1]["time"] == "2026-10-05T06:00:00Z"
    assert all(entry["post_title"] == "A calendar post" for entry in entries)


def test_calendar_workspace_isolation_and_timezone_input(client, auth):
    start = seed_calendar()
    params = {"start": start.isoformat(), "end": (start + timedelta(days=1)).isoformat()}
    other = client.post("/api/v1/auth/register", json={"email": "other@example.com", "password": "a secure other password", "name": "Other"}).json()
    headers = {"Authorization": f"Bearer {other['access_token']}"}
    assert client.get("/api/v1/publishing/calendar", headers=headers, params=params).json()["items"] == []
    for invalid in [
        {**params, "start": "2026-10-05T00:00:00"},
        {**params, "end": start.isoformat()},
        {**params, "end": (start + timedelta(days=64)).isoformat()},
        {**params, "cursor": -1},
    ]:
        assert client.get("/api/v1/publishing/calendar", headers=auth, params=invalid).status_code == 422
    # The same interval expressed in a non-UTC timezone returns the same rows.
    offset = {"start": "2026-10-05T05:30:00+05:30", "end": "2026-10-06T05:30:00+05:30"}
    assert client.get("/api/v1/publishing/calendar", headers=auth, params=offset).json() == client.get("/api/v1/publishing/calendar", headers=auth, params=params).json()


def test_add_destination_replays_request_without_creating_duplicate(client, auth):
    post = client.post("/api/v1/posts", headers=auth, json={"title": "One idea"}).json()
    data = {"platform": "x", "payload": {"text": "Version for X"}, "idempotency_key": "stable-destination-request"}
    path = f"/api/v1/posts/{post['id']}/variants"
    first = client.post(path, headers=auth, json=data)
    second = client.post(path, headers=auth, json=data)
    assert first.status_code == second.status_code == 201
    assert first.json()["id"] == second.json()["id"]
    assert len(client.get(f"/api/v1/posts/{post['id']}", headers=auth).json()["variants"]) == 1
    assert client.post(path, headers=auth, json={**data, "platform": "linkedin"}).status_code == 409
    another = client.post("/api/v1/posts", headers=auth, json={"title": "Another idea"}).json()
    assert client.post(f"/api/v1/posts/{another['id']}/variants", headers=auth, json=data).status_code == 409
