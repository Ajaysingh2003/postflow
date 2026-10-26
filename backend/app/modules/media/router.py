import logging
from datetime import timedelta
from urllib.parse import quote
from uuid import uuid4

from botocore.exceptions import ClientError
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.dependencies import get_current_user, get_current_workspace, require_content_access
from app.core.security import as_utc, utcnow
from app.db.session import get_db
from app.modules.billing.usage import lock_workspace
from app.modules.identity.models import User, Workspace
from app.modules.media import service
from app.modules.media.limits import reserve_storage, storage_usage
from app.modules.media.models import MediaAsset
from app.modules.media.schemas import DownloadResponse, MediaResponse, UploadRequest, UploadResponse

router = APIRouter(prefix="/media", tags=["media"], dependencies=[Depends(require_content_access)])
logger = logging.getLogger(__name__)


def _asset(db: Session, workspace_id: str, asset_id: str) -> MediaAsset:
    asset = db.scalar(
        select(MediaAsset).where(MediaAsset.id == asset_id, MediaAsset.workspace_id == workspace_id)
    )
    if asset is None:
        raise HTTPException(status_code=404, detail="Media asset not found")
    return asset


@router.get("", response_model=list[MediaResponse])
def list_assets(
    workspace: Workspace = Depends(get_current_workspace), db: Session = Depends(get_db)
):
    return list(
        db.scalars(
            select(MediaAsset)
            .where(MediaAsset.workspace_id == workspace.id)
            .order_by(MediaAsset.created_at.desc())
            .limit(200)
        )
    )


@router.get("/usage")
def media_usage(
    workspace: Workspace = Depends(get_current_workspace), db: Session = Depends(get_db)
):
    return storage_usage(db, workspace.id)


@router.post("/attachments", response_model=MediaResponse, status_code=201)
def upload_attachment(
    file: UploadFile = File(...),
    purpose: str = Form("post"),
    content_type: str = Form(...),
    user: User = Depends(get_current_user),
    workspace: Workspace = Depends(get_current_workspace),
    db: Session = Depends(get_db),
):
    """Validate file contents and size before making an upload usable."""
    settings = get_settings()
    if purpose not in {"post", "assistant"}:
        raise HTTPException(422, "Invalid upload purpose")
    try:
        limit = (
            settings.media_max_bytes
            if purpose == "assistant"
            else service.max_bytes(settings, content_type)
        )
        data = file.file.read(limit + 1)
        filename = service.validate_upload(
            settings, file.filename or "", content_type, len(data), source=purpose == "assistant"
        )
        service.validate_contents(data, content_type)
        width, height = service.dimensions(data, content_type)
        s3 = service.client(settings)
        reserve_storage(db, workspace.id, len(data))
        key = f"media/{workspace.id}/{uuid4()}/{filename}"
        asset = MediaAsset(
            workspace_id=workspace.id,
            uploaded_by_user_id=user.id,
            object_key=key,
            original_filename=filename,
            content_type=content_type,
            declared_size=len(data),
            status="uploading",
        )
        db.add(asset)
        db.commit()
        lock_workspace(db, workspace.id)
        asset = _asset(db, workspace.id, asset.id)
        try:
            stored = s3.put_object(
                Bucket=settings.r2_bucket_name,
                Key=key,
                Body=data,
                ContentType=content_type,
            )
        except HTTPException:
            raise
        except ClientError as exc:
            code = exc.response.get("Error", {}).get("Code")
            access_error = "File storage access is unavailable. Ask your workspace administrator to check the storage configuration"
            messages = {
                "NoSuchBucket": "File storage bucket is missing. Ask your workspace administrator to check the storage configuration",
                "AccessDenied": access_error,
                "InvalidAccessKeyId": access_error,
                "SignatureDoesNotMatch": access_error,
            }
            raise HTTPException(
                503 if code in messages else 502,
                messages.get(code, "Could not store this file. Please retry"),
            ) from exc
        except Exception as exc:
            raise HTTPException(502, "Could not store this file. Please retry") from exc
        asset.width, asset.height = width, height
        asset.actual_size = len(data)
        asset.status = "ready"
        asset.etag = str(stored.get("ETag", "")).strip('"')
        try:
            db.add(asset)
            db.commit()
        except Exception as exc:
            db.rollback()
            try:
                service.client(settings).delete_object(Bucket=settings.r2_bucket_name, Key=key)
            except Exception:
                logger.warning("Unable to clean up an unrecorded upload", exc_info=True)
            raise HTTPException(503, "Could not save this file. Please retry") from exc
        return asset
    finally:
        file.file.close()


@router.post("/uploads", response_model=UploadResponse, status_code=201)
def create_upload(
    payload: UploadRequest,
    user: User = Depends(get_current_user),
    workspace: Workspace = Depends(get_current_workspace),
    db: Session = Depends(get_db),
) -> UploadResponse:
    settings = get_settings()
    filename = service.validate_upload(
        settings,
        payload.filename,
        payload.content_type,
        payload.size,
        source=payload.purpose == "assistant",
    )
    reserve_storage(db, workspace.id, payload.size)
    key = f"quarantine/{workspace.id}/{uuid4()}/{filename}"
    asset = MediaAsset(
        workspace_id=workspace.id,
        uploaded_by_user_id=user.id,
        object_key=key,
        original_filename=filename,
        content_type=payload.content_type,
        declared_size=payload.size,
    )
    db.add(asset)
    url = service.client(settings).generate_presigned_url(
        "put_object",
        Params={
            "Bucket": settings.r2_bucket_name,
            "Key": key,
            "ContentType": payload.content_type,
            "ContentLength": payload.size,
            "Metadata": {"purpose": payload.purpose},
        },
        ExpiresIn=settings.media_url_ttl_seconds,
    )
    db.commit()
    db.refresh(asset)
    return UploadResponse(
        asset_id=asset.id,
        upload_url=url,
        headers={"Content-Type": payload.content_type, "x-amz-meta-purpose": payload.purpose},
        expires_in=settings.media_url_ttl_seconds,
    )


@router.post("/uploads/{asset_id}/complete", response_model=MediaResponse)
def complete_upload(
    asset_id: str,
    workspace: Workspace = Depends(get_current_workspace),
    db: Session = Depends(get_db),
) -> MediaAsset:
    settings = get_settings()
    lock_workspace(db, workspace.id)
    asset = _asset(db, workspace.id, asset_id)
    db.refresh(asset)
    if asset.status == "ready":
        return asset
    if as_utc(asset.created_at) + timedelta(hours=settings.media_pending_ttl_hours) <= utcnow():
        raise HTTPException(410, "This upload has expired. Start a new upload")
    s3 = service.client(settings)
    try:
        head = s3.head_object(Bucket=settings.r2_bucket_name, Key=asset.object_key)
        actual_size = int(head["ContentLength"])
        # Purpose is bound into the signed PUT headers, never taken from completion input.
        purpose = head.get("Metadata", {}).get("purpose", "post")
        service.validate_upload(
            settings,
            asset.original_filename,
            asset.content_type,
            actual_size,
            source=purpose == "assistant",
        )
        limit = (
            settings.media_max_bytes
            if purpose == "assistant"
            else service.max_bytes(settings, asset.content_type)
        )
        if actual_size <= 0 or actual_size > limit or actual_size != asset.declared_size:
            raise HTTPException(status_code=422, detail="Uploaded size does not match declaration")
        body = s3.get_object(Bucket=settings.r2_bucket_name, Key=asset.object_key)["Body"]
        try:
            data = body.read(limit + 1)
        finally:
            body.close()
        if len(data) != actual_size:
            raise HTTPException(422, "Uploaded file is incomplete. Start a new upload")
        service.validate_contents(data, asset.content_type)
        asset.width, asset.height = service.dimensions(data, asset.content_type)
        final_key = asset.object_key.replace("quarantine/", "media/", 1)
        # A signed PUT can be replayed until expiry. Promote precisely the bytes validated,
        # rather than copying a quarantine object that could have changed during validation.
        stored = s3.put_object(
            Bucket=settings.r2_bucket_name,
            Key=final_key,
            Body=data,
            ContentType=asset.content_type,
        )
        quarantine_key = asset.object_key
        asset.object_key = final_key
        asset.actual_size = actual_size
        asset.etag = str(stored.get("ETag", "")).strip('"')
        asset.status = "ready"
        asset.rejection_reason = None
    except HTTPException as exc:
        asset.status = "rejected" if exc.status_code == 422 else "upload_failed"
        asset.rejection_reason = str(exc.detail)
        db.commit()
        raise
    except Exception as exc:
        asset.status = "upload_failed"
        asset.rejection_reason = "Unable to verify uploaded object"
        db.commit()
        raise HTTPException(status_code=502, detail="Unable to verify uploaded object") from exc
    db.commit()
    db.refresh(asset)
    try:
        s3.delete_object(Bucket=settings.r2_bucket_name, Key=quarantine_key)
    except Exception:
        # The verified file is already committed; the orphan sweep will retry cleanup.
        logger.warning("Unable to remove completed upload quarantine object", exc_info=True)
    return asset


@router.get("/{asset_id}/content")
def asset_content(
    asset_id: str,
    workspace: Workspace = Depends(get_current_workspace),
    db: Session = Depends(get_db),
):
    asset = _asset(db, workspace.id, asset_id)
    data = service.read_ready(get_settings(), asset)
    return Response(
        data,
        media_type=asset.content_type,
        headers={
            "Cache-Control": "private, no-store",
            "X-Content-Type-Options": "nosniff",
            "Content-Disposition": "inline; filename*=UTF-8''"
            + quote(asset.original_filename, safe=""),
        },
    )


@router.get("/{asset_id}", response_model=MediaResponse)
def get_asset(
    asset_id: str,
    workspace: Workspace = Depends(get_current_workspace),
    db: Session = Depends(get_db),
) -> MediaAsset:
    return _asset(db, workspace.id, asset_id)


@router.post("/{asset_id}/download", response_model=DownloadResponse)
def download(
    asset_id: str,
    workspace: Workspace = Depends(get_current_workspace),
    db: Session = Depends(get_db),
) -> DownloadResponse:
    settings = get_settings()
    asset = _asset(db, workspace.id, asset_id)
    if asset.status != "ready":
        raise HTTPException(status_code=409, detail="Media asset is not ready")
    url = service.client(settings).generate_presigned_url(
        "get_object",
        Params={
            "Bucket": settings.r2_bucket_name,
            "Key": asset.object_key,
            "ResponseCacheControl": "private, no-store",
            "ResponseContentDisposition": "inline; filename*=UTF-8''"
            + quote(asset.original_filename, safe=""),
        },
        ExpiresIn=settings.media_url_ttl_seconds,
    )
    return DownloadResponse(download_url=url, expires_in=settings.media_url_ttl_seconds)


@router.delete("/{asset_id}", status_code=204)
def delete_asset(
    asset_id: str,
    workspace: Workspace = Depends(get_current_workspace),
    db: Session = Depends(get_db),
) -> None:
    settings = get_settings()
    lock_workspace(db, workspace.id)
    asset = _asset(db, workspace.id, asset_id)
    try:
        service.client(settings).delete_object(Bucket=settings.r2_bucket_name, Key=asset.object_key)
    except Exception as exc:
        raise HTTPException(status_code=502, detail="Unable to delete stored object") from exc
    db.delete(asset)
    db.commit()


@router.patch("/{asset_id}", response_model=MediaResponse)
def update_asset(
    asset_id: str,
    payload: dict[str, str | None],
    workspace: Workspace = Depends(get_current_workspace),
    db: Session = Depends(get_db),
):
    asset = _asset(db, workspace.id, asset_id)
    if set(payload) != {"alt_text"} or len(payload.get("alt_text") or "") > 1000:
        raise HTTPException(422, "Provide alt_text of at most 1000 characters")
    asset.alt_text = payload["alt_text"]
    db.commit()
    return asset
