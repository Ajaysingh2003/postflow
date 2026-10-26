"""Workspace-serialized storage reservations and bounded abandoned-upload cleanup."""

import logging
from datetime import timedelta

from fastapi import HTTPException
from sqlalchemy import func, select

from app.core.config import get_settings
from app.core.security import as_utc, utcnow
from app.modules.billing.usage import lock_workspace
from app.modules.media import service
from app.modules.media.models import MediaAsset

logger = logging.getLogger(__name__)
# Include the legacy failure value only so old reservations can still be cleaned up.
PENDING = ("awaiting_upload", "uploading", "rejected", "scan_failed", "upload_failed")


def storage_usage(db, workspace_id):
    used = (
        db.scalar(
            select(
                func.coalesce(
                    func.sum(func.coalesce(MediaAsset.actual_size, MediaAsset.declared_size)), 0
                )
            ).where(MediaAsset.workspace_id == workspace_id)
        )
        or 0
    )
    limit = get_settings().media_workspace_quota_bytes
    return {"used_bytes": used, "limit_bytes": limit, "remaining_bytes": max(0, limit - used)}


def reserve_storage(db, workspace_id, size):
    # All upload paths take this same workspace row lock before adding a reservation.
    lock_workspace(db, workspace_id)
    usage = storage_usage(db, workspace_id)
    if size > usage["remaining_bytes"]:
        raise HTTPException(
            413,
            "Workspace storage limit reached. Delete unused files or ask your administrator to increase storage",
        )


def cleanup_abandoned_uploads(db):
    settings = get_settings()
    cutoff = utcnow() - timedelta(hours=settings.media_pending_ttl_hours)
    candidates = list(
        db.execute(
            select(MediaAsset.id, MediaAsset.workspace_id)
            .where(MediaAsset.status.in_(PENDING), MediaAsset.updated_at < cutoff)
            .order_by(MediaAsset.updated_at, MediaAsset.id)
            .limit(settings.media_cleanup_batch_size)
        )
    )
    deleted = 0
    for asset_id, workspace_id in candidates:
        try:
            lock_workspace(db, workspace_id)
            asset = db.scalar(
                select(MediaAsset)
                .where(MediaAsset.id == asset_id)
                .execution_options(populate_existing=True)
            )
            if asset is None or asset.status not in PENDING or as_utc(asset.updated_at) >= cutoff:
                db.rollback()
                continue
            # Delete storage first: a failed object deletion must not release reserved space.
            service.client(settings).delete_object(
                Bucket=settings.r2_bucket_name, Key=asset.object_key
            )
            db.delete(asset)
            db.commit()
            deleted += 1
        except Exception:  # noqa: BLE001 - isolate maintenance failures and retry later
            db.rollback()
            logger.warning("Abandoned upload cleanup will retry for asset %s", asset_id)
    return deleted


def cleanup_quarantine_objects(db):
    """Sweep a single S3 page, including replayed PUTs/orphans with no SQL record.

    Never touches media/ (ready files). Continuation lives in Redis, not the SQL database.
    """
    from redis import Redis

    settings = get_settings()
    with Redis.from_url(
        settings.redis_url, decode_responses=True, socket_connect_timeout=2, socket_timeout=2
    ) as cache:
        cursor_key = "media:quarantine:cleanup-cursor"
        cursor = cache.get(cursor_key)
        params = {
            "Bucket": settings.r2_bucket_name,
            "Prefix": "quarantine/",
            "MaxKeys": settings.media_cleanup_batch_size,
        }
        if cursor:
            params["ContinuationToken"] = cursor
        storage = service.client(settings)
        page = storage.list_objects_v2(**params)
        cutoff = utcnow() - timedelta(hours=settings.media_pending_ttl_hours)
        deleted = 0
        for item in page.get("Contents", []):
            if as_utc(item["LastModified"]) >= cutoff:
                continue
            asset = db.scalar(select(MediaAsset).where(MediaAsset.object_key == item["Key"]))
            if asset is not None:
                # SQL-backed pending reservations are handled by the locked sweep above.
                continue
            storage.delete_object(Bucket=settings.r2_bucket_name, Key=item["Key"])
            deleted += 1
        if page.get("IsTruncated") and page.get("NextContinuationToken"):
            cache.set(cursor_key, page["NextContinuationToken"], ex=172800)
        else:
            cache.delete(cursor_key)
        return deleted
