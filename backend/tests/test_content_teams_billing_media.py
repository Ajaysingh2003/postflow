from datetime import UTC, datetime, timedelta

from app.core.config import get_settings
from app.core.rate_limit import RateLimiter
from app.db.session import SessionLocal
from app.modules.billing.entitlements import has_paid_access, sync_entitlements
from app.modules.billing.models import Subscription
from app.modules.identity.models import User, Workspace
from app.modules.media.service import detected_type, validate_upload


def test_post_and_variants_creation(client, auth):
    post_res = client.post(
        "/api/v1/posts",
        headers=auth,
        json={
            "title": "Multi-Channel Post",
            "base_text": "Hello world across channels!",
            "variants": [
                {"platform": "x", "payload": {"text": "Hello X!"}},
                {"platform": "linkedin", "payload": {"text": "Hello LinkedIn!"}},
            ],
        },
    )
    assert post_res.status_code == 201
    data = post_res.json()
    assert data["title"] == "Multi-Channel Post"
    assert data["base_text"] == "Hello world across channels!"
    assert len(data["variants"]) == 2


def test_workspace_invitation_selection_and_editor_permissions(client, auth):
    with SessionLocal.begin() as db:
        owner = db.query(User).filter_by(email="owner@example.com").one()
        workspace = db.query(Workspace).filter_by(owner_user_id=owner.id).one()
        db.add(
            Subscription(
                user_id=owner.id,
                workspace_id=workspace.id,
                provider_subscription_id="sub_team",
                plan_code="pro",
                status="active",
                quantity=5,
            )
        )
        sync_entitlements(db, workspace.id, "pro", 5)
        workspace_id = workspace.id

    other = client.post(
        "/api/v1/auth/register",
        json={
            "email": "editor@example.com",
            "password": "another secure password",
            "name": "Editor",
        },
    ).json()
    invite = client.post(
        "/api/v1/workspaces/current/invitations",
        headers=auth,
        json={"email": "editor@example.com", "role": "viewer"},
    )
    assert invite.status_code == 201, invite.text
    other_headers = {
        "Authorization": f"Bearer {other['access_token']}",
        "X-Workspace-ID": workspace_id,
    }
    accepted = client.post(
        "/api/v1/workspaces/invitations/accept",
        headers={"Authorization": f"Bearer {other['access_token']}"},
        json={"token": invite.json()["development_token"]},
    )
    assert accepted.status_code == 200
    assert (
        client.post(
            "/api/v1/posts", headers=other_headers, json={"title": "No", "content": "blocked"}
        ).status_code
        == 403
    )

    members = client.get("/api/v1/workspaces/current/members", headers=auth).json()
    editor_membership = next(item for item in members if item["email"] == "editor@example.com")
    assert (
        client.patch(
            f"/api/v1/workspaces/current/members/{editor_membership['id']}",
            headers=auth,
            json={"role": "editor"},
        ).status_code
        == 200
    )
    assert (
        client.post(
            "/api/v1/posts", headers=other_headers, json={"title": "Allowed", "content": "draft"}
        ).status_code
        == 201
    )


def test_grace_period_and_media_validation():
    now = datetime.now(UTC)
    on_hold = Subscription(
        user_id="u",
        workspace_id="w",
        provider_subscription_id="sub",
        plan_code="pro",
        status="on_hold",
        grace_until=now + timedelta(days=1),
    )
    assert has_paid_access(on_hold, now)
    on_hold.grace_until = now - timedelta(seconds=1)
    assert not has_paid_access(on_hold, now)
    cancelled = Subscription(
        user_id="u",
        workspace_id="w",
        provider_subscription_id="sub2",
        plan_code="pro",
        status="cancelled",
        current_period_end=now + timedelta(days=1),
    )
    assert has_paid_access(cancelled, now)

    settings = get_settings()
    assert validate_upload(settings, "../profile.png", "image/png", 100) == "profile.png"
    assert detected_type(b"\x89PNG\r\n\x1a\nrest") == "image/png"
    assert detected_type(b"%PDF-1.7 rest") == "application/pdf"


def test_rate_limit_policies_are_scoped():
    limiter = RateLimiter(get_settings())
    assert limiter.policy("/api/v1/auth/login") == (20, 60)
    assert limiter.policy("/api/v1/assistant/generate") == (30, 60)
    assert limiter.policy("/api/v1/posts") is None
