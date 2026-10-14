import base64
import hashlib
import secrets
from contextlib import contextmanager
from datetime import UTC, datetime

from fastapi import HTTPException
from mcp.server.auth.middleware.auth_context import get_access_token
from mcp.server.auth.provider import AccessToken
from sqlalchemy import select

from app.core.config import get_settings
from app.core.dependencies import membership_for
from app.core.security import token_hash, utcnow
from app.db.session import SessionLocal
from app.modules.agents.models import AgentConnection
from app.modules.identity.models import User
from app.modules.workspaces.models import Workspace

SCOPES = {
    "draftva:read": "Read accounts, posts, schedules and analytics",
    "draftva:write": "Create and edit drafts",
    "draftva:publish": "Schedule and publish when requested",
    "draftva:assistant": "Use draftva AI within your plan's allowance",
}
EDIT_ROLES = {"owner", "admin", "editor"}


def secret() -> str:
    return secrets.token_urlsafe(48)


def challenge(verifier: str) -> str:
    return base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).decode().rstrip("=")


def live_connection(db, raw_token: str) -> AgentConnection | None:
    return db.scalar(
        select(AgentConnection).where(
            AgentConnection.token_hash == token_hash(raw_token),
            AgentConnection.revoked_at.is_(None),
            AgentConnection.expires_at > utcnow(),
            AgentConnection.grant_expires_at > utcnow(),
        )
    )


class AgentTokenVerifier:
    async def verify_token(self, token: str) -> AccessToken | None:
        with SessionLocal() as db:
            connection = live_connection(db, token)
            if not connection:
                return None
            user = db.get(User, connection.user_id)
            if (
                not user
                or not user.is_active
                or (get_settings().email_verification_required and not user.email_verified)
            ):
                return None
            try:
                membership_for(db, connection.workspace_id, connection.user_id)
            except HTTPException:
                return None
            return AccessToken(
                token=token,
                client_id=connection.client_id or connection.id,
                scopes=connection.scopes,
                subject=connection.user_id,
                resource=connection.resource,
                expires_at=int(connection.expires_at.replace(tzinfo=UTC).timestamp()),
            )


@contextmanager
def agent_context(scope: str = "draftva:read"):
    token = get_access_token()
    if not token:
        raise HTTPException(401, "Connect your draftva account first")
    with SessionLocal() as db:
        connection = live_connection(db, token.token)
        if not connection or scope not in connection.scopes:
            raise HTTPException(403, "This agent connection does not have that permission")
        user = db.get(User, connection.user_id)
        if (
            not user
            or not user.is_active
            or (get_settings().email_verification_required and not user.email_verified)
        ):
            raise HTTPException(401, "This connection is no longer active")
        membership = membership_for(db, connection.workspace_id, user.id)
        if scope != "draftva:read" and membership.role not in EDIT_ROLES:
            raise HTTPException(403, "Editor role required")
        workspace = db.get(Workspace, connection.workspace_id)
        connection.last_used_at = datetime.now(UTC)
        db.commit()
        yield db, user, workspace
