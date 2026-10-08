import io
from types import SimpleNamespace

import pytest
from PIL import Image


@pytest.mark.parametrize(
    "platform",
    ["x", "linkedin", "reddit", "bluesky", "mastodon", "facebook", "instagram", "threads"],
)
def test_uploaded_attachments_survive_repeated_save_reorder_and_removal(
    client, auth, monkeypatch, platform
):
    from app.db.session import SessionLocal
    from app.modules.content.models import PostVariant

    image = io.BytesIO()
    Image.new("RGB", (640, 360), "green").save(image, "PNG")
    monkeypatch.setattr(
        "app.modules.media.service.client",
        lambda *_: SimpleNamespace(put_object=lambda **kwargs: {"ETag": "etag"}),
    )
    monkeypatch.setattr("app.modules.media.service.scan_clamav", lambda *args: None)
    ids = []
    for i in range(2):
        response = client.post(
            "/api/v1/media/attachments",
            headers=auth,
            data={"content_type": "image/png", "purpose": "post"},
            files={"file": (f"image-{i}.png", image.getvalue(), "image/png")},
        )
        assert response.status_code == 201, response.text
        ids.append(response.json()["id"])
    post = client.post(
        "/api/v1/posts",
        headers=auth,
        json={
            "variants": [
                {"platform": platform, "payload": {"text": "Initial"}, "media_asset_ids": ids}
            ]
        },
    ).json()
    variant_id = post["variants"][0]["id"]
    with SessionLocal() as db:
        initial = {
            link.media_asset_id: link.id for link in db.get(PostVariant, variant_id).media_links
        }
    for selected in (ids, ids, ids[::-1], ids[1:], [], ids):
        response = client.patch(
            f"/api/v1/variants/{variant_id}",
            headers=auth,
            json={"payload": {"text": "Edited draft"}, "media_asset_ids": selected},
        )
        assert response.status_code == 200, response.text
        assert response.json()["media_asset_ids"] == selected
        if selected == ids[::-1]:
            with SessionLocal() as db:
                assert {
                    link.media_asset_id: link.id
                    for link in db.get(PostVariant, variant_id).media_links
                } == initial
