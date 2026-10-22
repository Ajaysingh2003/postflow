import importlib.util
from datetime import timedelta
from urllib.parse import parse_qs, urlparse

import pytest
import sqlalchemy as sa
from alembic.migration import MigrationContext
from alembic.operations import Operations

from app.core.config import get_settings
from app.core.security import utcnow
from app.db.session import SessionLocal
from app.modules.channels.models import OAuthState
from app.modules.channels.oauth import decrypt_token
from app.modules.channels.registry import channel_registry
from app.modules.identity.models import User
from app.modules.workspaces.models import WorkspaceMembership
from tests.test_channels_framework import FakePlatformAdapter


def test_new_user_can_skip_without_connecting_and_completion_is_idempotent(client, auth):
    assert client.get("/api/v1/auth/me", headers=auth).json()["onboarding_completed_at"] is None
    setup = client.get("/api/v1/auth/onboarding", headers=auth)
    assert setup.status_code == 200
    assert setup.json()["can_connect"] is True
    assert setup.json()["completed_at"] is None
    assert client.post("/api/v1/auth/onboarding/complete", headers=auth).status_code == 200
    completed = client.get("/api/v1/auth/me", headers=auth).json()["onboarding_completed_at"]
    assert completed
    assert client.post("/api/v1/auth/onboarding/complete", headers=auth).status_code == 200
    assert (
        client.get("/api/v1/auth/me", headers=auth).json()["onboarding_completed_at"] == completed
    )
    assert client.get("/api/v1/channels/accounts", headers=auth).json() == []
    # Completion is durable across signing in again, not attached to a session.
    login = client.post(
        "/api/v1/auth/login",
        json={"email": "owner@example.com", "password": "correct horse battery"},
    )
    another_session = {"Authorization": f"Bearer {login.json()['access_token']}"}
    assert client.get("/api/v1/auth/onboarding", headers=another_session).json()["completed_at"]


def test_onboarding_permissions_and_workspace_isolation(client, auth):
    with SessionLocal() as db:
        user = db.scalar(sa.select(User))
        membership = db.scalar(
            sa.select(WorkspaceMembership).where(WorkspaceMembership.user_id == user.id)
        )
        membership.role = "viewer"
        db.commit()
    assert client.get("/api/v1/auth/onboarding", headers=auth).json()["can_connect"] is False
    assert client.post("/api/v1/auth/onboarding/complete", headers=auth).status_code == 200
    assert (
        client.get(
            "/api/v1/auth/onboarding", headers={**auth, "X-Workspace-ID": "other-workspace"}
        ).status_code
        == 403
    )
    assert client.post("/api/v1/auth/onboarding/complete").status_code == 401


def test_unverified_users_cannot_bypass_verification(client, auth, monkeypatch):
    monkeypatch.setattr(get_settings(), "email_verification_required", True)
    assert client.get("/api/v1/auth/onboarding", headers=auth).status_code == 403
    assert client.post("/api/v1/auth/onboarding/complete", headers=auth).status_code == 403
    assert client.get("/api/v1/auth/me", headers=auth).json()["onboarding_completed_at"] is None


@pytest.fixture
def adapter():
    channel_registry.register(FakePlatformAdapter("onboarding_test"))
    yield
    channel_registry.unregister("onboarding_test")


@pytest.mark.parametrize("cancel", [False, True])
def test_oauth_returns_to_connections_and_consumes_state(client, auth, adapter, cancel):
    start = client.post(
        "/api/v1/channels/onboarding_test/connect",
        headers=auth,
        json={"return_to": "/onboarding?step=connect"},
    )
    assert start.status_code == 200, start.text
    state = start.json()["state"]
    with SessionLocal() as db:
        record = db.scalar(sa.select(OAuthState))
        assert '"return_to": "/onboarding?step=connect"' in decrypt_token(record.encrypted_metadata)
    params = (
        {"state": state, "error": "access_denied"} if cancel else {"state": state, "code": "code"}
    )
    response = client.get(
        "/api/v1/channels/onboarding_test/callback", params=params, follow_redirects=False
    )
    destination = urlparse(response.headers["location"])
    assert destination.path == "/onboarding"
    assert parse_qs(destination.query)["step"] == ["connect"]
    assert ("error" if cancel else "connected") in parse_qs(destination.query)
    with SessionLocal() as db:
        assert db.scalar(sa.select(OAuthState)) is None
    replay = client.get(
        "/api/v1/channels/onboarding_test/callback", params=params, follow_redirects=False
    )
    assert urlparse(replay.headers["location"]).path == "/dashboard/channels"
    assert "error" in parse_qs(urlparse(replay.headers["location"]).query)


@pytest.mark.parametrize(
    "return_to",
    [
        "https://evil.example/",
        "//evil.example",
        "/onboarding?step=connect&next=https://evil.example",
        "/api/secrets",
    ],
)
def test_oauth_rejects_unapproved_return_paths(client, auth, adapter, return_to):
    response = client.post(
        "/api/v1/channels/onboarding_test/connect", headers=auth, json={"return_to": return_to}
    )
    assert response.status_code == 422
    with SessionLocal() as db:
        assert db.scalar(sa.select(OAuthState)) is None


def test_expired_oauth_does_not_use_stored_return_path(client, auth, adapter):
    start = client.post(
        "/api/v1/channels/onboarding_test/connect",
        headers=auth,
        json={"return_to": "/onboarding?step=connect"},
    )
    with SessionLocal() as db:
        db.scalar(sa.select(OAuthState)).expires_at = utcnow() - timedelta(minutes=1)
        db.commit()
    response = client.get(
        "/api/v1/channels/onboarding_test/callback",
        params={"state": start.json()["state"], "code": "test"},
        follow_redirects=False,
    )
    assert urlparse(response.headers["location"]).path == "/dashboard/channels"


def test_migration_grandfathers_existing_users_but_new_users_start_incomplete(tmp_path):
    engine = sa.create_engine(f"sqlite:///{tmp_path / 'onboarding.db'}")
    with engine.begin() as connection:
        connection.execute(sa.text("CREATE TABLE users (id TEXT PRIMARY KEY, name TEXT)"))
        connection.execute(sa.text("INSERT INTO users (id, name) VALUES ('old', 'Existing')"))
        spec = importlib.util.spec_from_file_location(
            "onboarding_migration", "migrations/versions/20261018_onboarding.py"
        )
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        module.op = Operations(MigrationContext.configure(connection))
        module.upgrade()
        connection.execute(sa.text("INSERT INTO users (id, name) VALUES ('new', 'New')"))
        assert connection.scalar(
            sa.text("SELECT onboarding_completed_at FROM users WHERE id='old'")
        )
        assert (
            connection.scalar(sa.text("SELECT onboarding_completed_at FROM users WHERE id='new'"))
            is None
        )
