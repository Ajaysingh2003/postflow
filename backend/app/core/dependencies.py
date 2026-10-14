from fastapi import Depends, Header, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import token_hash, utcnow
from app.db.session import get_db
from app.modules.identity.models import SessionToken, User
from app.modules.workspaces.models import Workspace, WorkspaceMembership

bearer = HTTPBearer(auto_error=False)


def _raw_bearer(credentials: HTTPAuthorizationCredentials | None) -> str:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required"
        )
    return credentials.credentials


def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
    db: Session = Depends(get_db),
) -> User:
    raw_token = _raw_bearer(credentials)
    session = db.scalar(
        select(SessionToken).where(
            SessionToken.token_hash == token_hash(raw_token),
            SessionToken.revoked_at.is_(None),
            SessionToken.expires_at > utcnow(),
        )
    )
    if session is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid session")
    user = db.get(User, session.user_id)
    if user is None or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid session")
    if (
        get_settings().email_verification_required
        and not user.email_verified
        and not request.url.path.startswith("/api/v1/auth/")
    ):
        raise HTTPException(403, "Verify your email before accessing your workspace")
    return user


def get_current_workspace(
    user: User = Depends(get_current_user),
    workspace_header: str | None = Header(default=None, alias="X-Workspace-ID"),
    db: Session = Depends(get_db),
) -> Workspace:
    if get_settings().email_verification_required and not user.email_verified:
        raise HTTPException(403, "Verify your email before accessing your workspace")
    query = select(WorkspaceMembership).where(WorkspaceMembership.user_id == user.id)
    if workspace_header:
        query = query.where(WorkspaceMembership.workspace_id == workspace_header)
    membership = db.scalar(query.order_by(WorkspaceMembership.created_at.asc()))
    if workspace_header and membership is None:
        raise HTTPException(status_code=403, detail="Workspace access denied")
    workspace = db.get(Workspace, membership.workspace_id) if membership else None
    if workspace is None:
        workspace = db.scalar(select(Workspace).where(Workspace.owner_user_id == user.id))
    if workspace is None:
        raise HTTPException(status_code=404, detail="Workspace not found")
    return workspace


def membership_for(db: Session, workspace_id: str, user_id: str) -> WorkspaceMembership:
    membership = db.scalar(
        select(WorkspaceMembership).where(
            WorkspaceMembership.workspace_id == workspace_id, WorkspaceMembership.user_id == user_id
        )
    )
    if membership is None:
        raise HTTPException(status_code=403, detail="Workspace access denied")
    return membership


def require_roles(*roles: str):
    def dependency(
        user: User = Depends(get_current_user),
        workspace: Workspace = Depends(get_current_workspace),
        db: Session = Depends(get_db),
    ) -> WorkspaceMembership:
        membership = membership_for(db, workspace.id, user.id)
        if membership.role not in roles:
            raise HTTPException(status_code=403, detail="Insufficient workspace role")
        return membership

    return dependency


def require_content_access(
    request: Request,
    user: User = Depends(get_current_user),
    workspace: Workspace = Depends(get_current_workspace),
    db: Session = Depends(get_db),
) -> WorkspaceMembership:
    membership = membership_for(db, workspace.id, user.id)
    if request.method not in {"GET", "HEAD", "OPTIONS"} and membership.role not in {
        "owner",
        "admin",
        "editor",
    }:
        raise HTTPException(status_code=403, detail="Editor role required")
    return membership


def require_billing_access(
    user: User = Depends(get_current_user),
    workspace: Workspace = Depends(get_current_workspace),
    db: Session = Depends(get_db),
) -> WorkspaceMembership:
    membership = membership_for(db, workspace.id, user.id)
    if membership.role not in {"owner", "admin", "billing"}:
        raise HTTPException(status_code=403, detail="Billing role required")
    return membership
