"""Resolve owned, scanned assets and delegate platform uploads to the adapter."""

from urllib.parse import quote

from fastapi import HTTPException

from app.core.config import get_settings
from app.modules.media import service
from app.modules.media.models import MediaAsset


def media_for_variant(db, account, variant):
    assets = []
    for link in variant.media_links:
        asset = db.get(MediaAsset, link.media_asset_id)
        if not asset or asset.workspace_id != account.workspace_id or asset.status != "ready":
            raise HTTPException(422, "Attached media is unavailable in this workspace")
        assets.append((asset, link.alt_text or asset.alt_text or ""))
    return assets


def public_media_url(asset):
    settings = get_settings()
    if settings.r2_public_url:
        return settings.r2_public_url.rstrip("/") + "/" + quote(asset.object_key, safe="/")
    return service.client(settings).generate_presigned_url(
        "get_object",
        Params={"Bucket": settings.r2_bucket_name, "Key": asset.object_key},
        ExpiresIn=3600,
    )


async def prepare_media(db, account, variant, adapter):
    assets = media_for_variant(db, account, variant)
    if not assets:
        return
    upload = getattr(adapter, "prepare_media", None)
    if upload is None:
        raise HTTPException(422, "This platform does not support uploading these attachments")
    # Uploads and container IDs are persisted independently from public posting.
    await upload(account, variant, assets)
    db.commit()
