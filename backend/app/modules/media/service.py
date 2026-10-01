import io
import os
import socket
import struct
import zipfile
from functools import lru_cache
from urllib.parse import urlsplit

import boto3
from botocore.config import Config
from fastapi import HTTPException

from app.core.config import Settings

ALLOWED_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "application/pdf",
    "video/mp4",
}
TEXT_TYPES = {"text/plain", "text/markdown", "text/csv", "application/json"}
OFFICE_TYPES = {
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "word/document.xml",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": "ppt/presentation.xml",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xl/workbook.xml",
}
SOURCE_TYPES = ALLOWED_TYPES | TEXT_TYPES | set(OFFICE_TYPES) | {"audio/mpeg", "audio/wav"}


def max_bytes(settings: Settings, content_type: str) -> int:
    return settings.video_max_bytes if content_type == "video/mp4" else settings.media_max_bytes


def validate_upload(
    settings: Settings, filename: str, content_type: str, size: int, *, source: bool = False
) -> str:
    if content_type not in (SOURCE_TYPES if source else ALLOWED_TYPES):
        raise HTTPException(
            status_code=422,
            detail="Choose a supported image, PDF, video, audio, document, or text file"
            if source
            else "Only JPEG, PNG, WebP, GIF, PDF, and MP4 are allowed",
        )
    if size <= 0:
        raise HTTPException(422, "This file is empty")
    if size > (settings.media_max_bytes if source else max_bytes(settings, content_type)):
        raise HTTPException(status_code=413, detail="File exceeds the configured upload limit")
    safe = os.path.basename(filename.replace("\\", "/")).replace("\x00", "").strip()
    if not safe or safe in {".", ".."}:
        raise HTTPException(status_code=422, detail="Invalid filename")
    if len(safe) > 255:
        raise HTTPException(422, "Shorten the filename and retry")
    return safe


def validate_contents(data: bytes, content_type: str) -> None:
    valid = detected_type(data[:32]) == content_type
    if content_type in TEXT_TYPES:
        try:
            text = data.decode("utf-8-sig")
            valid = "\x00" not in text
        except UnicodeError:
            valid = False
    elif content_type in OFFICE_TYPES:
        try:
            with zipfile.ZipFile(io.BytesIO(data)) as archive:
                entries = archive.infolist()
                valid = (
                    len(entries) <= 2000
                    and sum(e.file_size for e in entries) <= 40 * 1024 * 1024
                    and not any(e.flag_bits & 1 for e in entries)
                    and OFFICE_TYPES[content_type] in archive.namelist()
                )
        except (zipfile.BadZipFile, ValueError):
            valid = False
    elif content_type == "audio/wav":
        valid = data.startswith(b"RIFF") and data[8:12] == b"WAVE"
    elif content_type == "audio/mpeg":
        valid = data.startswith(b"ID3") or (
            len(data) > 1 and data[0] == 255 and data[1] & 224 == 224
        )
    if not valid:
        raise HTTPException(
            422, "File contents do not match its type. Export the file again and retry"
        )


def read_ready(settings: Settings, asset) -> bytes:
    if asset.status != "ready":
        raise HTTPException(409, "This file is not ready. Upload it again")
    try:
        body = client(settings).get_object(Bucket=settings.r2_bucket_name, Key=asset.object_key)[
            "Body"
        ]
        try:
            data = body.read(max_bytes(settings, asset.content_type) + 1)
        finally:
            body.close()
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(502, "Could not read this file. Please retry") from exc
    if len(data) != asset.actual_size or len(data) > max_bytes(settings, asset.content_type):
        raise HTTPException(422, "This file is incomplete. Upload it again")
    return data


def detected_type(data: bytes) -> str | None:
    if data.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if data.startswith((b"GIF87a", b"GIF89a")):
        return "image/gif"
    if data.startswith(b"RIFF") and data[8:12] == b"WEBP":
        return "image/webp"
    if data.startswith(b"%PDF-"):
        return "application/pdf"
    if (
        len(data) >= 12
        and data[4:8] == b"ftyp"
        and data[8:12] in {b"isom", b"iso2", b"mp41", b"mp42", b"avc1", b"M4V ", b"dash"}
    ):
        return "video/mp4"
    return None


@lru_cache
def r2_client(endpoint: str, access_key: str, secret_key: str):
    return boto3.client(
        "s3",
        endpoint_url=endpoint,
        aws_access_key_id=access_key,
        aws_secret_access_key=secret_key,
        region_name="auto",
        config=Config(signature_version="s3v4"),
    )


def client(settings: Settings):
    endpoint = settings.r2_endpoint or (
        f"https://{settings.r2_account_id}.r2.cloudflarestorage.com"
        if settings.r2_account_id
        else None
    )
    if not all(
        (
            endpoint,
            settings.r2_access_key_id,
            settings.r2_secret_access_key,
            settings.r2_bucket_name,
        )
    ):
        raise HTTPException(status_code=503, detail="R2 storage is not configured")
    if (urlsplit(endpoint).hostname or "").endswith(".r2.cloudflarestorage.com") and len(
        settings.r2_access_key_id
    ) != 32:
        raise HTTPException(
            503,
            "File storage credentials are invalid. Ask your workspace administrator to check the R2 Access Key ID",
        )
    return r2_client(endpoint, settings.r2_access_key_id, settings.r2_secret_access_key)


def scan_clamav(settings: Settings, data: bytes) -> None:
    if not settings.clamav_host:
        raise HTTPException(status_code=503, detail="Malware scanner is not configured")
    try:
        with socket.create_connection(
            (settings.clamav_host, settings.clamav_port),
            timeout=60 if len(data) > settings.media_max_bytes else 15,
        ) as sock:
            sock.sendall(b"zINSTREAM\0")
            for offset in range(0, len(data), 1024 * 1024):
                chunk = data[offset : offset + 1024 * 1024]
                sock.sendall(struct.pack(">I", len(chunk)) + chunk)
            sock.sendall(struct.pack(">I", 0))
            result = sock.recv(4096).decode("utf-8", errors="replace")
    except OSError as exc:
        raise HTTPException(status_code=503, detail="Malware scanner is unavailable") from exc
    if "FOUND" in result:
        raise HTTPException(status_code=422, detail="Upload was rejected by malware scanning")
    if "OK" not in result:
        raise HTTPException(status_code=502, detail="Malware scan did not complete")
