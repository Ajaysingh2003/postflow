from datetime import timedelta

import pytest
from fastapi import HTTPException
from sqlalchemy import select

from app.core.security import utcnow
from app.db.session import SessionLocal
from app.modules.billing.entitlements import sync_entitlements
from app.modules.billing.models import EntitlementGrant, Subscription
from app.modules.identity.models import User
from app.modules.workspaces.models import Workspace, WorkspaceInvitation, WorkspaceMembership


def paid_team(client, auth, seats=5):
    with SessionLocal.begin() as db:
        owner = db.scalar(select(User).where(User.email == "owner@example.com"))
        workspace = db.scalar(select(Workspace).where(Workspace.owner_user_id == owner.id))
        db.add(
            Subscription(
                user_id=owner.id,
                workspace_id=workspace.id,
                provider_subscription_id="invite-plan",
                plan_code="pro",
                status="active",
                quantity=seats,
            )
        )
        sync_entitlements(db, workspace.id, "pro", seats)
        if seats != 5:
            grant = db.scalar(
                select(EntitlementGrant).where(
                    EntitlementGrant.workspace_id == workspace.id,
                    EntitlementGrant.capability == "seats",
                )
            )
            grant.limit_value = seats
            grant.source = "manual"
        return workspace.id


def register(client, email):
    data = client.post(
        "/api/v1/auth/register",
        json={"email": email, "name": "Teammate", "password": "correct horse battery"},
    ).json()
    return {"Authorization": "Bearer " + data["access_token"]}


def invite(client, auth, email="friend@example.com"):
    return client.post(
        "/api/v1/workspaces/current/invitations",
        headers=auth,
        json={"email": email, "role": "editor"},
    )


def accept(client, headers, token):
    return client.post(
        "/api/v1/workspaces/invitations/accept", headers=headers, json={"token": token}
    )


def test_email_link_preview_and_acceptance_are_scoped_and_idempotent(client, auth, monkeypatch):
    workspace_id = paid_team(client, auth)
    deliveries = []
    monkeypatch.setattr(
        "app.modules.workspaces.router.deliver_token", lambda *args: deliveries.append(args)
    )
    response = invite(client, auth)
    assert response.status_code == 201, response.text
    token = response.json()["development_token"]
    assert deliveries == [("friend@example.com", token, "invitations/accept")]
    preview = client.post("/api/v1/workspaces/invitations/preview", json={"token": token})
    assert preview.status_code == 200
    assert preview.json()["email_hint"] == "f•••@example.com"
    assert "friend@example.com" not in preview.text
    assert "token_hash" not in preview.text
    wrong = register(client, "wrong@example.com")
    assert accept(client, wrong, token).status_code == 403
    friend = register(client, "friend@example.com")
    assert accept(client, friend, token).json()["id"] == workspace_id
    assert accept(client, friend, token).status_code == 200
    with SessionLocal() as db:
        assert (
            len(
                list(
                    db.scalars(
                        select(WorkspaceMembership).where(
                            WorkspaceMembership.workspace_id == workspace_id
                        )
                    )
                )
            )
            == 2
        )
    assert (
        client.post("/api/v1/workspaces/invitations/preview", json={"token": token}).json()[
            "status"
        ]
        == "accepted"
    )


def test_pending_seats_resend_revoke_and_accept_after_downgrade(client, auth):
    workspace_id = paid_team(client, auth, seats=2)
    first = invite(client, auth).json()
    assert invite(client, auth, "other@example.com").status_code == 409
    resent = invite(client, auth).json()
    assert resent["id"] != first["id"]
    friend = register(client, "friend@example.com")
    assert accept(client, friend, first["development_token"]).status_code == 410
    assert len(client.get("/api/v1/workspaces/current/invitations", headers=auth).json()) == 1
    with SessionLocal.begin() as db:
        db.scalar(
            select(EntitlementGrant).where(
                EntitlementGrant.workspace_id == workspace_id,
                EntitlementGrant.capability == "seats",
            )
        ).limit_value = 1
    assert accept(client, friend, resent["development_token"]).status_code == 409
    with SessionLocal() as db:
        assert db.get(WorkspaceInvitation, resent["id"]).accepted_at is None
    assert (
        client.delete(
            f"/api/v1/workspaces/current/invitations/{resent['id']}", headers=auth
        ).status_code
        == 204
    )
    assert accept(client, friend, resent["development_token"]).status_code == 410


def test_expired_replaced_wrong_workspace_and_lost_inviter_permissions(client, auth):
    workspace_id = paid_team(client, auth)
    sent = invite(client, auth).json()
    friend = register(client, "friend@example.com")
    assert (
        client.get("/api/v1/workspaces/current/invitations", headers=friend).status_code == 200
    )  # own workspace
    assert (
        client.delete(
            f"/api/v1/workspaces/current/invitations/{sent['id']}", headers=friend
        ).status_code
        == 404
    )
    with SessionLocal.begin() as db:
        db.get(WorkspaceInvitation, sent["id"]).expires_at = utcnow() - timedelta(seconds=1)
    assert (
        client.post(
            "/api/v1/workspaces/invitations/preview", json={"token": sent["development_token"]}
        ).status_code
        == 410
    )
    assert accept(client, friend, sent["development_token"]).status_code == 410
    sent = invite(client, auth).json()
    with SessionLocal.begin() as db:
        db.scalar(
            select(WorkspaceMembership).where(WorkspaceMembership.workspace_id == workspace_id)
        ).role = "viewer"
    assert accept(client, friend, sent["development_token"]).status_code == 410
    assert client.get("/api/v1/workspaces/current/invitations", headers=auth).status_code == 403


def test_delivery_failure_preserves_old_link_and_does_not_reserve_another_seat(
    client, auth, monkeypatch
):
    paid_team(client, auth, seats=2)
    first = invite(client, auth).json()

    def fail(*args):
        raise HTTPException(503, "Email delivery unavailable")

    monkeypatch.setattr("app.modules.workspaces.router.deliver_token", fail)
    assert invite(client, auth).status_code == 503
    with SessionLocal() as db:
        assert db.get(WorkspaceInvitation, first["id"]).revoked_at is None
    assert (
        accept(
            client, register(client, "friend@example.com"), first["development_token"]
        ).status_code
        == 200
    )


def test_partial_bulk_delivery_keeps_delivered_links_working(client, auth, monkeypatch):
    paid_team(client, auth)
    deliveries = []

    def send(email, token, purpose):
        if email.startswith("second"):
            raise HTTPException(503, "Email delivery unavailable")
        deliveries.append((email, token))

    monkeypatch.setattr("app.modules.workspaces.router.deliver_token", send)
    response = client.post(
        "/api/v1/workspaces/current/invitations/bulk",
        headers=auth,
        json={
            "invitations": [
                {"email": email, "role": "editor"}
                for email in ["first@example.com", "second@example.com"]
            ]
        },
    )
    assert response.status_code == 503
    assert "1 invitations sent" in response.text
    assert accept(client, register(client, deliveries[0][0]), deliveries[0][1]).status_code == 200


def test_concurrent_acceptance_obeys_postgres_capacity(client, auth):
    from concurrent.futures import ThreadPoolExecutor

    with SessionLocal() as db:
        if db.bind.dialect.name != "postgresql":
            pytest.skip("PostgreSQL row-lock concurrency check")
    workspace_id = paid_team(client, auth, seats=3)
    records = [
        invite(client, auth, email).json() for email in ["one@example.com", "two@example.com"]
    ]
    headers = [register(client, email) for email in ["one@example.com", "two@example.com"]]
    with SessionLocal.begin() as db:
        db.scalar(
            select(EntitlementGrant).where(
                EntitlementGrant.workspace_id == workspace_id,
                EntitlementGrant.capability == "seats",
            )
        ).limit_value = 2
    with ThreadPoolExecutor(max_workers=2) as pool:
        statuses = list(
            pool.map(
                lambda item: accept(client, item[0], item[1]["development_token"]).status_code,
                zip(headers, records, strict=True),
            )
        )
    assert sorted(statuses) == [200, 409]


def test_public_invitation_preview_limiter_uses_signed_client_ip_not_arbitrary_bearer():
    import hashlib
    import hmac
    import time

    from starlette.requests import Request

    from app.core.config import Settings
    from app.core.rate_limit import RateLimiter

    secret = "test-invitation-proxy-secret"
    limiter = RateLimiter(Settings(_env_file=None, app_env="test", auth_proxy_secret=secret))
    stamp = str(int(time.time()))
    ip = "203.0.113.7"
    signature = hmac.new(secret.encode(), f"{stamp}:{ip}".encode(), hashlib.sha256).hexdigest()

    def request(extra):
        return Request(
            {
                "type": "http",
                "path": "/api/v1/workspaces/invitations/preview",
                "client": ("127.0.0.1", 1234),
                "headers": [(key.encode(), value.encode()) for key, value in extra.items()],
            }
        )

    assert limiter.identity(request({"authorization": "Bearer arbitrary"})) == "127.0.0.1"
    assert (
        limiter.identity(
            request(
                {
                    "x-auth-client-ip": ip,
                    "x-auth-client-timestamp": stamp,
                    "x-auth-client-signature": signature,
                }
            )
        )
        == ip
    )
    assert (
        limiter.identity(
            request(
                {
                    "x-auth-client-ip": ip,
                    "x-auth-client-timestamp": stamp,
                    "x-auth-client-signature": "forged",
                }
            )
        )
        == "127.0.0.1"
    )


@pytest.mark.parametrize(("plan", "included"), [("starter", 3), ("pro", 5), ("business", 15)])
def test_paid_teams_receive_included_seats_and_manual_overrides_survive_sync(
    client, auth, plan, included
):
    from app.modules.billing.entitlements import entitlement_limit

    workspace_id = paid_team(client, auth)
    with SessionLocal.begin() as db:
        subscription = db.scalar(
            select(Subscription).where(Subscription.workspace_id == workspace_id)
        )
        subscription.plan_code = plan
        subscription.quantity = 1
        sync_entitlements(db, workspace_id, plan, 1)
        grant = db.scalar(
            select(EntitlementGrant).where(
                EntitlementGrant.workspace_id == workspace_id,
                EntitlementGrant.capability == "seats",
            )
        )
        assert grant.limit_value == included
        grant.limit_value = 1  # An old quantity-derived grant is repaired at read time.
        assert entitlement_limit(db, workspace_id, "seats") == included
        grant.limit_value, grant.source = 2, "manual"
        db.flush()
        sync_entitlements(db, workspace_id, plan, 1)
        assert entitlement_limit(db, workspace_id, "seats") == 2
