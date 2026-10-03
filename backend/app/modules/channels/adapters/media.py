"""Official upload helpers used by individual platform adapters."""

import base64
import io
from urllib.parse import quote

from fastapi import HTTPException
from PIL import Image

from app.core.config import get_settings
from app.modules.channels.base import MediaProcessingPending
from app.modules.channels.oauth import decrypt_token
from app.modules.media import service
from app.modules.media.publishing import public_media_url


async def save_state(variant, **values):
    variant.publish_state = {**(getattr(variant, "publish_state", None) or {}), **values}
    persist = getattr(variant, "persist_publish_state", None)
    if persist:
        await persist()


async def upload_x(self, account, variant, assets):
    client = await self._get_client()
    headers = {"Authorization": f"Bearer {decrypt_token(account.encrypted_access_token)}"}
    ids = list((variant.publish_state or {}).get("uploaded_media", []))
    if any(alt for _, alt in assets):
        raise HTTPException(422, "X v2 does not document alt-text upload for this OAuth flow")
    try:
        for asset, alt in assets[len(ids) :]:
            data = service.read_ready(get_settings(), asset)
            if asset.content_type == "video/mp4":
                start = await client.post(
                    "https://api.x.com/2/media/upload/initialize",
                    json={
                        "total_bytes": len(data),
                        "media_type": asset.content_type,
                        "media_category": "tweet_video",
                    },
                    headers=headers,
                )
                start.raise_for_status()
                media_id = start.json()["data"]["id"]
                for index, offset in enumerate(range(0, len(data), 4 * 1024 * 1024)):
                    part = await client.post(
                        f"https://api.x.com/2/media/upload/{media_id}/append",
                        json={
                            "segment_index": index,
                            "media": base64.b64encode(
                                data[offset : offset + 4 * 1024 * 1024]
                            ).decode(),
                        },
                        headers=headers,
                    )
                    part.raise_for_status()
                response = await client.post(
                    f"https://api.x.com/2/media/upload/{media_id}/finalize", headers=headers
                )
                response.raise_for_status()
                await save_state(variant, x_processing_media=str(media_id))
            else:
                response = await client.post(
                    "https://api.x.com/2/media/upload",
                    json={
                        "media": base64.b64encode(data).decode(),
                        "media_category": "tweet_gif"
                        if asset.content_type == "image/gif"
                        else "tweet_image",
                        "media_type": asset.content_type,
                    },
                    headers=headers,
                )
                response.raise_for_status()
                media_id = response.json()["data"]["id"]
            ids.append(str(media_id))
            await save_state(variant, uploaded_media=ids)
        pending = (variant.publish_state or {}).get("x_processing_media")
        if pending:
            response = await client.get(
                "https://api.x.com/2/media/upload",
                params={"media_id": pending, "command": "STATUS"},
                headers=headers,
            )
            response.raise_for_status()
            processing = response.json().get("data", {}).get("processing_info", {})
            if processing.get("state") == "failed":
                raise HTTPException(422, "X could not process this media")
            if processing.get("state") not in {None, "succeeded"}:
                raise MediaProcessingPending(
                    "X media is still processing",
                    max(1, int(processing.get("check_after_secs", 60))),
                )
            await save_state(variant, x_processing_media=None)
        variant.payload = {**variant.payload, "media_ids": ids}
    finally:
        if self._http_client is None:
            await client.aclose()


async def upload_linkedin(self, account, variant, assets):
    client = await self._get_client()
    token = decrypt_token(account.encrypted_access_token)
    headers = self._headers(token)
    owner = (
        variant.payload.get("target_urn")
        or account.account_metadata.get("person_urn")
        or account.external_account_id
    )
    urns = list((variant.publish_state or {}).get("uploaded_media", []))
    try:
        for asset, _alt in assets[len(urns) :]:
            video = asset.content_type.startswith("video/")
            kind = (
                "videos"
                if video
                else "documents"
                if asset.content_type == "application/pdf"
                else "images"
            )
            data = service.read_ready(get_settings(), asset)
            request = {"owner": owner}
            if video:
                request.update(fileSizeBytes=len(data), uploadCaptions=False, uploadThumbnail=False)
            response = await client.post(
                f"https://api.linkedin.com/rest/{kind}?action=initializeUpload",
                json={"initializeUploadRequest": request},
                headers=headers,
            )
            response.raise_for_status()
            value = response.json()["value"]
            if video:
                parts = []
                for instruction in value["uploadInstructions"]:
                    upload = await client.put(
                        instruction["uploadUrl"],
                        content=data[instruction["firstByte"] : instruction["lastByte"] + 1],
                        headers={"Content-Type": "application/octet-stream"},
                    )
                    upload.raise_for_status()
                    parts.append(upload.headers["ETag"].strip('"'))
                response = await client.post(
                    "https://api.linkedin.com/rest/videos?action=finalizeUpload",
                    json={
                        "finalizeUploadRequest": {
                            "video": value["video"],
                            "uploadToken": value["uploadToken"],
                            "uploadedPartIds": parts,
                        }
                    },
                    headers=headers,
                )
                response.raise_for_status()
                urn = value["video"]
            else:
                upload = await client.put(
                    value["uploadUrl"],
                    content=data,
                    headers={
                        "Authorization": f"Bearer {token}",
                        "Content-Type": asset.content_type,
                    },
                )
                upload.raise_for_status()
                urn = value["document" if kind == "documents" else "image"]
            urns.append(urn)
            await save_state(variant, uploaded_media=urns)
        for urn in urns:
            kind = (
                "videos"
                if urn.startswith("urn:li:video:")
                else "documents"
                if urn.startswith("urn:li:document:")
                else "images"
            )
            response = await client.get(
                f"https://api.linkedin.com/rest/{kind}/{quote(urn, safe='')}", headers=headers
            )
            response.raise_for_status()
            state = response.json().get("status")
            if state in {"PROCESSING_FAILED", "FAILED"}:
                raise HTTPException(422, "LinkedIn could not process this attachment")
            if state != "AVAILABLE":
                raise MediaProcessingPending("LinkedIn media is still processing")
        variant.payload = {
            **variant.payload,
            "media_urns": urns,
            "media_alt_texts": [alt for _, alt in assets],
        }
    finally:
        if self._http_client is None:
            await client.aclose()


async def upload_mastodon(self, account, variant, assets):
    client = await self._get_client()
    domain = account.account_metadata["instance_domain"]
    headers = {"Authorization": f"Bearer {decrypt_token(account.encrypted_access_token)}"}
    ids = list((variant.publish_state or {}).get("uploaded_media", []))
    try:
        for asset, alt in assets[len(ids) :]:
            response = await client.post(
                f"https://{domain}/api/v2/media",
                data={"description": alt},
                files={
                    "file": (
                        asset.original_filename,
                        service.read_ready(get_settings(), asset),
                        asset.content_type,
                    )
                },
                headers=headers,
            )
            response.raise_for_status()
            ids.append(str(response.json()["id"]))
            await save_state(variant, uploaded_media=ids)
        for media_id in ids:
            status = await client.get(f"https://{domain}/api/v1/media/{media_id}", headers=headers)
            if status.status_code == 206 or (
                status.status_code == 200 and not status.json().get("url")
            ):
                raise MediaProcessingPending("Mastodon media is still processing")
            status.raise_for_status()
        variant.payload = {**variant.payload, "media_ids": ids}
    finally:
        if self._http_client is None:
            await client.aclose()


async def upload_bluesky(self, account, variant, assets):
    client = await self._get_client()
    blobs = list((variant.publish_state or {}).get("uploaded_media", []))
    try:
        for asset, alt in assets[len(blobs) :]:
            if not asset.content_type.startswith("image/"):
                raise HTTPException(422, "Bluesky attachments must be images")
            data = service.read_ready(get_settings(), asset)
            content_type = asset.content_type
            if len(data) > 1_000_000:
                with Image.open(io.BytesIO(data)) as image:
                    image = image.convert("RGB")
                    image.thumbnail((2000, 2000))
                    output = io.BytesIO()
                    image.save(output, "JPEG", quality=85)
                    while output.tell() > 1_000_000 and min(image.size) > 256:
                        image.thumbnail((int(image.width * 0.8), int(image.height * 0.8)))
                        output = io.BytesIO()
                        image.save(output, "JPEG", quality=80)
                    data, content_type = output.getvalue(), "image/jpeg"
                if len(data) > 1_000_000:
                    raise HTTPException(422, "Image cannot fit within the Bluesky blob limit")
            response = await self._oauth_request(
                client,
                "POST",
                account.account_metadata["pds_url"] + "/xrpc/com.atproto.repo.uploadBlob",
                account=account,
                content=data,
                headers={"Content-Type": content_type},
            )
            response.raise_for_status()
            blobs.append({"blob": response.json()["blob"], "alt": alt})
            await save_state(variant, uploaded_media=blobs)
        variant.payload = {**variant.payload, "media_blobs": blobs}
    finally:
        if self._http_client is None:
            await client.aclose()


async def remote_urls(self, account, variant, assets):
    variant.payload = {
        **variant.payload,
        "media_urls": [public_media_url(asset) for asset, _ in assets],
        "media_types": [asset.content_type for asset, _ in assets],
        "media_alt_texts": [alt for _, alt in assets],
    }


async def instagram_urls(self, account, variant, assets):
    # The publishing API accepts JPEG images. Store a separate derived object;
    # source uploads retain their original format.
    urls = []
    types = []
    settings = get_settings()
    for asset, _alt in assets:
        if asset.content_type in {"image/png", "image/webp"}:
            data = service.read_ready(settings, asset)
            with Image.open(io.BytesIO(data)) as image:
                output = io.BytesIO()
                image.convert("RGB").save(output, "JPEG", quality=95)
            derived_key = asset.object_key + ".instagram.jpg"
            service.client(settings).put_object(
                Bucket=settings.r2_bucket_name,
                Key=derived_key,
                Body=output.getvalue(),
                ContentType="image/jpeg",
            )
            from types import SimpleNamespace

            urls.append(public_media_url(SimpleNamespace(object_key=derived_key)))
            types.append("image/jpeg")
        else:
            urls.append(public_media_url(asset))
            types.append(asset.content_type)
    variant.payload = {**variant.payload, "media_urls": urls, "media_types": types}


async def validate_x_media(self, assets):
    from app.modules.channels.base import Issue

    if len(assets) > 1 and any(a.content_type in {"video/mp4", "image/gif"} for a, _ in assets):
        return [
            Issue(
                field="media",
                message="X allows four images, one GIF, or one video; these cannot be mixed",
            )
        ]
    return []


async def validate_linkedin_media(self, assets):
    from app.modules.channels.base import Issue

    if len(assets) > 1 and any(not a.content_type.startswith("image/") for a, _ in assets):
        return [
            Issue(field="media", message="LinkedIn multi-attachment posts must contain only images")
        ]
    return []
