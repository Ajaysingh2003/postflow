from datetime import timedelta
from io import BytesIO
from types import SimpleNamespace

from fastapi import HTTPException
from PIL import Image
from sqlalchemy import select

from app.core.config import get_settings
from app.core.rate_limit import RateLimiter
from app.core.security import utcnow
from app.db.session import SessionLocal
from app.modules.identity.models import User
from app.modules.media.limits import cleanup_abandoned_uploads, reserve_storage, storage_usage
from app.modules.media.models import MediaAsset
from app.modules.workspaces.models import Workspace


def scope():
    with SessionLocal() as db:
        user = db.scalar(select(User).where(User.email == "owner@example.com"))
        workspace = db.scalar(select(Workspace).where(Workspace.owner_user_id == user.id))
        return user.id, workspace.id


def asset(db, user_id, workspace_id, status="awaiting_upload", size=1024, old=False):
    from uuid import uuid4

    when = utcnow() - timedelta(days=2) if old else utcnow()
    item = MediaAsset(
        workspace_id=workspace_id,
        uploaded_by_user_id=user_id,
        object_key=f"quarantine/{workspace_id}/{uuid4()}/file.png",
        original_filename="file.png",
        content_type="image/png",
        declared_size=size,
        actual_size=size if status == "ready" else None,
        status=status,
        created_at=when,
        updated_at=when,
    )
    db.add(item)
    db.flush()
    return item


def test_storage_reservations_cover_ready_pending_and_failures_and_both_upload_paths(
    client, auth, monkeypatch
):
    user_id, workspace_id = scope()
    monkeypatch.setattr(get_settings(), "media_workspace_quota_bytes", 1024 * 1024)
    with SessionLocal.begin() as db:
        asset(db, user_id, workspace_id, "ready", 500000)
        asset(db, user_id, workspace_id, "scan_failed", 300000)
        asset(db, user_id, workspace_id, "awaiting_upload", 248576)
    response = client.get("/api/v1/media/usage", headers=auth)
    assert response.json() == {"used_bytes": 1048576, "limit_bytes": 1048576, "remaining_bytes": 0}
    assert (
        client.post(
            "/api/v1/media/uploads",
            headers=auth,
            json={"filename": "file.png", "content_type": "image/png", "size": 20},
        ).status_code
        == 413
    )
    image = BytesIO()
    Image.new("RGB", (2, 2)).save(image, "PNG")
    monkeypatch.setattr("app.modules.media.service.client", lambda _: object())
    assert (
        client.post(
            "/api/v1/media/attachments",
            headers=auth,
            files={"file": ("file.png", image.getvalue(), "image/png")},
            data={"content_type": "image/png", "purpose": "post"},
        ).status_code
        == 413
    )
    limiter = RateLimiter(get_settings())
    assert limiter.policy("/api/v1/media/attachments") == (10, 60)


def test_cleanup_is_bounded_retains_ready_and_recent_and_retries_storage_failure(
    client, auth, monkeypatch
):
    user_id, workspace_id = scope()
    deleted = []

    def delete(**kwargs):
        if "retry" in kwargs["Key"]:
            raise OSError("storage offline")
        deleted.append(kwargs["Key"])

    monkeypatch.setattr(
        "app.modules.media.service.client", lambda _: SimpleNamespace(delete_object=delete)
    )
    with SessionLocal.begin() as db:
        stale = asset(db, user_id, workspace_id, "awaiting_upload", old=True)
        retry = asset(db, user_id, workspace_id, "scan_failed", old=True)
        retry.object_key += "retry"
        ready = asset(db, user_id, workspace_id, "ready", old=True)
        recent = asset(db, user_id, workspace_id)
        ids = stale.id, retry.id, ready.id, recent.id
    with SessionLocal() as db:
        assert cleanup_abandoned_uploads(db) == 1
        assert db.get(MediaAsset, ids[0]) is None
        assert all(db.get(MediaAsset, value) is not None for value in ids[1:])
        assert storage_usage(db, workspace_id)["used_bytes"] == 3072
    assert len(deleted) == 1


def test_old_upload_cannot_be_completed_after_reservation_expiry(client, auth):
    user_id, workspace_id = scope()
    with SessionLocal.begin() as db:
        item = asset(db, user_id, workspace_id, old=True)
        asset_id = item.id
    response = client.post(f"/api/v1/media/uploads/{asset_id}/complete", headers=auth)
    assert response.status_code == 410


def test_signed_upload_binds_declared_size(client, auth, monkeypatch):
    captured = []

    def signed(*args, **kwargs):
        captured.append(kwargs)
        return "https://storage.example.invalid/signed"

    monkeypatch.setattr(
        "app.modules.media.service.client", lambda _: SimpleNamespace(generate_presigned_url=signed)
    )
    response = client.post(
        "/api/v1/media/uploads",
        headers=auth,
        json={"filename": "file.png", "content_type": "image/png", "size": 1200},
    )
    assert response.status_code == 201
    assert captured[0]["Params"]["ContentLength"] == 1200
    assert client.get("/api/v1/media/usage", headers=auth).json()["used_bytes"] == 1200


def test_quarantine_sweep_removes_only_old_orphans_and_advances_cursor(client, auth, monkeypatch):
    from app.modules.media.limits import cleanup_quarantine_objects

    user_id, workspace_id = scope()
    with SessionLocal.begin() as db:
        existing = asset(db, user_id, workspace_id, old=True)
        protected_key = existing.object_key
    old = utcnow() - timedelta(days=3)
    state = {}

    class Cache:
        def __enter__(self):
            return self

        def __exit__(self, *_):
            pass

        def get(self, key):
            return state.get(key)

        def set(self, key, value, **kwargs):
            state[key] = value

        def delete(self, key):
            state.pop(key, None)

    monkeypatch.setattr("redis.Redis.from_url", lambda *a, **kw: Cache())
    deleted = []
    calls = []

    def page(**kwargs):
        calls.append(kwargs)
        return {
            "Contents": [
                {"Key": "quarantine/orphan", "LastModified": old},
                {"Key": protected_key, "LastModified": old},
                {"Key": "quarantine/recent", "LastModified": utcnow()},
            ],
            "IsTruncated": True,
            "NextContinuationToken": "next-page",
        }

    monkeypatch.setattr(
        "app.modules.media.service.client",
        lambda _: SimpleNamespace(
            list_objects_v2=page, delete_object=lambda **kwargs: deleted.append(kwargs["Key"])
        ),
    )
    with SessionLocal() as db:
        assert cleanup_quarantine_objects(db) == 1
        assert cleanup_quarantine_objects(db) == 1
    assert deleted == ["quarantine/orphan", "quarantine/orphan"]
    assert calls[0]["Prefix"] == "quarantine/"
    assert calls[1]["ContinuationToken"] == "next-page"
    assert calls[0]["MaxKeys"] == get_settings().media_cleanup_batch_size


def test_concurrent_storage_reservations_are_serialized_on_postgres(client, auth, monkeypatch):
    from concurrent.futures import ThreadPoolExecutor

    import pytest

    user_id, workspace_id = scope()
    with SessionLocal() as db:
        if db.bind.dialect.name != "postgresql":
            pytest.skip("PostgreSQL row-lock concurrency check")
    monkeypatch.setattr(get_settings(), "media_workspace_quota_bytes", 1048576)

    def reserve(_):
        with SessionLocal() as db:
            try:
                reserve_storage(db, workspace_id, 700000)
                asset(db, user_id, workspace_id, size=700000)
                db.commit()
                return 201
            except HTTPException as error:
                db.rollback()
                return error.status_code

    with ThreadPoolExecutor(max_workers=2) as pool:
        statuses = list(pool.map(reserve, range(2)))
    assert sorted(statuses) == [201, 413]
