"""Signed uploads stay private until size, type and content validation succeed."""

from io import BytesIO
from urllib.parse import parse_qs, urlsplit

import pytest
from sqlalchemy import select

from app.db.session import SessionLocal
from app.modules.media import service
from app.modules.media.models import MediaAsset
from app.modules.media.service import r2_client


@pytest.fixture
def storage(monkeypatch):
    class Storage:
        def __init__(self):
            self.signed = []
            self.objects = {}
            self.promoted = []

        def generate_presigned_url(self, operation, **kwargs):
            self.signed.append((operation, kwargs))
            return "https://storage.example.invalid/signed"

        def head_object(self, **kwargs):
            obj = self.objects[kwargs["Key"]]
            return {"ContentLength": len(obj["data"]), "Metadata": obj["metadata"]}

        def get_object(self, **kwargs):
            return {"Body": BytesIO(self.objects[kwargs["Key"]]["data"])}

        def put_object(self, **kwargs):
            self.promoted.append(kwargs)
            self.objects[kwargs["Key"]] = {"data": kwargs["Body"], "metadata": {}}
            return {"ETag": '"verified"'}

        def delete_object(self, **kwargs):
            self.objects.pop(kwargs["Key"], None)

    bucket = Storage()
    monkeypatch.setattr("app.modules.media.service.client", lambda _: bucket)
    return bucket


def ticket(
    client, auth, storage, data=b"%PDF-1.7\nexample", content_type="application/pdf", purpose="post"
):
    response = client.post(
        "/api/v1/media/uploads",
        headers=auth,
        json={
            "filename": "file.pdf",
            "content_type": content_type,
            "size": len(data),
            "purpose": purpose,
        },
    )
    assert response.status_code == 201, response.text
    info = response.json()
    params = storage.signed[-1][1]["Params"]
    storage.objects[params["Key"]] = {"data": data, "metadata": params["Metadata"]}
    return info["asset_id"], params["Key"]


def test_large_video_signed_upload_validates_and_returns_ready_without_a_multipart_request(
    client, auth, storage
):
    data = b"\x00\x00\x00\x18ftypisom" + b"\0" * (5 * 1024 * 1024)
    asset_id, key = ticket(client, auth, storage, data, "video/mp4")
    params = storage.signed[-1][1]["Params"]
    assert params["ContentLength"] == len(data)
    assert params["Metadata"] == {"purpose": "post"}
    done = client.post(f"/api/v1/media/uploads/{asset_id}/complete", headers=auth)
    assert done.status_code == 200, done.text
    assert done.json()["status"] == "ready"
    assert done.json()["actual_size"] == len(data)
    assert key not in storage.objects
    assert storage.promoted[0]["Body"] == data
    assert (
        client.post(f"/api/v1/media/uploads/{asset_id}/complete", headers=auth).status_code == 200
    )
    assert len(storage.promoted) == 1
    download = client.post(f"/api/v1/media/{asset_id}/download", headers=auth)
    assert download.status_code == 200
    assert storage.signed[-1][0] == "get_object"
    assert storage.signed[-1][1]["Params"]["Key"].startswith("media/")


@pytest.mark.parametrize("purpose,expected", [("assistant", 201), ("post", 422), ("unknown", 422)])
def test_signed_source_types_are_only_available_with_valid_purpose(
    client, auth, storage, purpose, expected
):
    response = client.post(
        "/api/v1/media/uploads",
        headers=auth,
        json={
            "filename": "notes.txt",
            "content_type": "text/plain",
            "size": 12,
            "purpose": purpose,
        },
    )
    assert response.status_code == expected
    if expected == 201:
        assert response.json()["headers"]["x-amz-meta-purpose"] == "assistant"
        params = storage.signed[-1][1]["Params"]
        storage.objects[params["Key"]] = {"data": b"source notes", "metadata": params["Metadata"]}
        complete = client.post(
            f"/api/v1/media/uploads/{response.json()['asset_id']}/complete", headers=auth
        )
        assert complete.status_code == 200, complete.text


def test_signed_limits_preserve_twenty_mb_sources_and_hundred_mb_post_videos(client, auth, storage):
    for purpose, size, expected in [
        ("assistant", 21 * 1024 * 1024, 413),
        ("post", 100 * 1024 * 1024, 201),
        ("post", 100 * 1024 * 1024 + 1, 413),
    ]:
        response = client.post(
            "/api/v1/media/uploads",
            headers=auth,
            json={
                "filename": "clip.mp4",
                "content_type": "video/mp4",
                "size": size,
                "purpose": purpose,
            },
        )
        assert response.status_code == expected


@pytest.mark.parametrize("failure", ["size", "contents", "storage", "short_body"])
def test_failed_verification_never_promotes_or_returns_a_download(
    client, auth, storage, monkeypatch, failure
):
    asset_id, key = ticket(client, auth, storage)
    if failure == "size":
        storage.objects[key]["data"] += b"extra"
    if failure == "contents":
        storage.objects[key]["data"] = b"x" * len(storage.objects[key]["data"])
    if failure == "storage":
        def unavailable(**kwargs):
            raise OSError("Storage unavailable")

        monkeypatch.setattr(storage, "put_object", unavailable)
    if failure == "short_body":
        monkeypatch.setattr(storage, "get_object", lambda **kwargs: {"Body": BytesIO(b"%PDF-")})
    complete = client.post(f"/api/v1/media/uploads/{asset_id}/complete", headers=auth)
    assert complete.status_code in {422, 502}, complete.text
    assert not storage.promoted
    assert client.post(f"/api/v1/media/{asset_id}/download", headers=auth).status_code == 409


def test_replaying_quarantine_during_validation_cannot_change_published_bytes(
    client, auth, storage, monkeypatch
):
    original = b"%PDF-1.7\noriginal"
    asset_id, key = ticket(client, auth, storage, original)

    validate = service.validate_contents

    def check_contents(data, content_type):
        validate(data, content_type)
        assert data == original
        storage.objects[key]["data"] = b"unsafe replacement"

    monkeypatch.setattr(service, "validate_contents", check_contents)
    assert (
        client.post(f"/api/v1/media/uploads/{asset_id}/complete", headers=auth).status_code == 200
    )
    assert storage.promoted[0]["Body"] == original


def test_quarantine_delete_failure_does_not_undo_a_verified_file(
    client, auth, storage, monkeypatch
):
    asset_id, _ = ticket(client, auth, storage)

    def unavailable(**kwargs):
        raise OSError("storage unavailable")

    monkeypatch.setattr(storage, "delete_object", unavailable)
    assert (
        client.post(f"/api/v1/media/uploads/{asset_id}/complete", headers=auth).status_code == 200
    )
    with SessionLocal() as db:
        asset = db.scalar(select(MediaAsset).where(MediaAsset.id == asset_id))
        assert asset.status == "ready"
        assert asset.object_key.startswith("media/")


def test_sigv4_binds_size_content_type_and_purpose_without_network():
    s3 = r2_client("https://storage.example.invalid", "test-access", "test-secret")
    url = s3.generate_presigned_url(
        "put_object",
        Params={
            "Bucket": "test",
            "Key": "quarantine/file",
            "ContentLength": 12,
            "ContentType": "text/plain",
            "Metadata": {"purpose": "assistant"},
        },
        ExpiresIn=900,
    )
    signed = parse_qs(urlsplit(url).query)["X-Amz-SignedHeaders"][0]
    assert set(signed.split(";")) >= {"content-type", "content-length", "x-amz-meta-purpose"}


def test_uploads_and_completion_are_scoped_to_workspace(client, auth, storage):
    asset_id, _ = ticket(client, auth, storage)
    other = client.post(
        "/api/v1/auth/register",
        json={
            "email": "other@example.com",
            "password": "another secure password",
            "name": "Other",
        },
    ).json()
    headers = {"Authorization": f"Bearer {other['access_token']}"}
    assert (
        client.post(f"/api/v1/media/uploads/{asset_id}/complete", headers=headers).status_code
        == 404
    )
    assert client.post(f"/api/v1/media/{asset_id}/download", headers=headers).status_code == 404


@pytest.mark.parametrize("purpose", ["post", "assistant"])
@pytest.mark.parametrize("flow", ["direct", "legacy"])
def test_uploads_complete_after_file_validation(
    client, auth, storage, purpose, flow
):
    if flow == "direct":
        asset_id, _ = ticket(client, auth, storage, purpose=purpose)
        response = client.post(f"/api/v1/media/uploads/{asset_id}/complete", headers=auth)
    else:
        response = client.post(
            "/api/v1/media/attachments", headers=auth,
            files={"file": ("file.pdf", b"%PDF-1.7\nexample", "application/pdf")},
            data={"purpose": purpose, "content_type": "application/pdf"},
        )
    assert response.status_code in {200, 201}, response.text
    assert response.json()["status"] == "ready"
    assert storage.promoted[-1]["Body"] == b"%PDF-1.7\nexample"
    download = client.post(f"/api/v1/media/{response.json()['id']}/download", headers=auth)
    assert download.status_code == 200


def test_legacy_failed_upload_can_be_revalidated(client, auth, storage):
    asset_id, _ = ticket(client, auth, storage)
    with SessionLocal.begin() as db:
        asset = db.get(MediaAsset, asset_id)
        asset.status = "scan_failed"
        asset.rejection_reason = "Legacy verification failure"
    response = client.post(f"/api/v1/media/uploads/{asset_id}/complete", headers=auth)
    assert response.status_code == 200
    assert response.json()["status"] == "ready"
    assert response.json()["rejection_reason"] is None
