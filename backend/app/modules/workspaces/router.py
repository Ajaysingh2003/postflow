from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.dependencies import get_current_user, get_current_workspace, membership_for
from app.core.security import new_token, normalize_email, token_hash, utcnow
from app.db.session import get_db
from app.modules.billing.entitlements import PLAN_DEFAULTS, effective_plan, entitlement_limit
from app.modules.identity import service as identity_service
from app.modules.identity.models import User, Workspace, WorkspaceInvitation, WorkspaceMembership
from app.modules.workspaces.schemas import (
    InvitationAccept,
    InvitationCreate,
    InvitationCreateBulk,
    InvitationResponse,
    MemberResponse,
    RoleUpdate,
    WorkspaceCreate,
    WorkspaceResponse,
)

router = APIRouter(prefix="/workspaces", tags=["workspaces"])
MANAGE_ROLES = {"owner", "admin"}


def _can_manage(db: Session, workspace: Workspace, user: User) -> WorkspaceMembership:
    membership = membership_for(db, workspace.id, user.id)
    if membership.role not in MANAGE_ROLES:
        raise HTTPException(status_code=403, detail="Owner or admin role required")
    return membership


@router.get("", response_model=list[WorkspaceResponse])
def list_workspaces(
    user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> list[Workspace]:
    return list(
        db.scalars(
            select(Workspace)
            .join(WorkspaceMembership, WorkspaceMembership.workspace_id == Workspace.id)
            .where(WorkspaceMembership.user_id == user.id)
            .order_by(Workspace.created_at.asc())
        )
    )


@router.post("", response_model=WorkspaceResponse, status_code=201)
def create_workspace(
    payload: WorkspaceCreate,
    user: User = Depends(get_current_user),
    source_workspace: Workspace = Depends(get_current_workspace),
    db: Session = Depends(get_db),
) -> Workspace:
    limit = PLAN_DEFAULTS[effective_plan(db, source_workspace.id)]["workspaces"] or 1
    owned = (
        db.scalar(
            select(func.count())
            .select_from(WorkspaceMembership)
            .where(WorkspaceMembership.user_id == user.id, WorkspaceMembership.role == "owner")
        )
        or 0
    )
    if owned >= limit:
        raise HTTPException(status_code=402, detail="Workspace limit reached for the current plan")
    workspace = Workspace(
        owner_user_id=user.id, name=payload.name.strip(), slug=identity_service._slug(payload.name)
    )
    db.add(workspace)
    db.flush()
    db.add(WorkspaceMembership(workspace_id=workspace.id, user_id=user.id, role="owner"))
    db.commit()
    db.refresh(workspace)
    return workspace


@router.get("/current", response_model=WorkspaceResponse)
def current_workspace(workspace: Workspace = Depends(get_current_workspace)) -> Workspace:
    return workspace


@router.get("/current/members", response_model=list[MemberResponse])
def members(
    workspace: Workspace = Depends(get_current_workspace), db: Session = Depends(get_db)
) -> list[MemberResponse]:
    rows = db.execute(
        select(WorkspaceMembership, User)
        .join(User, User.id == WorkspaceMembership.user_id)
        .where(WorkspaceMembership.workspace_id == workspace.id)
        .order_by(WorkspaceMembership.created_at.asc())
    ).all()
    return [
        MemberResponse(
            id=membership.id,
            user_id=user.id,
            email=user.email,
            name=user.name,
            role=membership.role,
        )
        for membership, user in rows
    ]


@router.post("/current/invitations", response_model=InvitationResponse, status_code=201)
def invite(
    payload: InvitationCreate,
    user: User = Depends(get_current_user),
    workspace: Workspace = Depends(get_current_workspace),
    db: Session = Depends(get_db),
) -> InvitationResponse:
    _can_manage(db, workspace, user)
    seat_count = (
        db.scalar(
            select(func.count())
            .select_from(WorkspaceMembership)
            .where(WorkspaceMembership.workspace_id == workspace.id)
        )
        or 0
    )
    seat_limit = entitlement_limit(db, workspace.id, "seats") or 1
    if seat_count >= seat_limit:
        raise HTTPException(status_code=409, detail="Workspace seat limit reached")
    email = normalize_email(str(payload.email))
    raw = new_token(48)
    item = WorkspaceInvitation(
        workspace_id=workspace.id,
        invited_by_user_id=user.id,
        email=email,
        role=payload.role,
        token_hash=token_hash(raw),
        expires_at=utcnow() + timedelta(days=7),
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return InvitationResponse(
        id=item.id,
        email=item.email,
        role=item.role,
        expires_at=item.expires_at,
        development_token=raw if get_settings().debug else None,
    )


@router.post("/current/invitations/bulk", response_model=list[InvitationResponse], status_code=201)
def bulk_invite(
    payload: InvitationCreateBulk,
    user: User = Depends(get_current_user),
    workspace: Workspace = Depends(get_current_workspace),
    db: Session = Depends(get_db),
) -> list[InvitationResponse]:
    _can_manage(db, workspace, user)
    seat_count = (
        db.scalar(
            select(func.count())
            .select_from(WorkspaceMembership)
            .where(WorkspaceMembership.workspace_id == workspace.id)
        )
        or 0
    )
    seat_limit = entitlement_limit(db, workspace.id, "seats") or 1
    if seat_count + len(payload.invitations) > seat_limit:
        available = max(0, seat_limit - seat_count)
        raise HTTPException(
            status_code=409,
            detail=f"Workspace seat limit reached. Available seats: {available}, requested: {len(payload.invitations)}",
        )

    now = utcnow()
    expires_at = now + timedelta(days=7)
    is_debug = get_settings().debug

    created_pairs = []
    for inv in payload.invitations:
        email = normalize_email(str(inv.email))
        raw = new_token(48)
        item = WorkspaceInvitation(
            workspace_id=workspace.id,
            invited_by_user_id=user.id,
            email=email,
            role=inv.role,
            token_hash=token_hash(raw),
            expires_at=expires_at,
        )
        db.add(item)
        created_pairs.append((item, raw))

    db.commit()

    results = []
    for item, raw in created_pairs:
        db.refresh(item)
        results.append(
            InvitationResponse(
                id=item.id,
                email=item.email,
                role=item.role,
                expires_at=item.expires_at,
                development_token=raw if is_debug else None,
            )
        )
    return results


@router.post("/invitations/accept", response_model=WorkspaceResponse)
def accept_invitation(
    payload: InvitationAccept, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> Workspace:
    item = db.scalar(
        select(WorkspaceInvitation).where(
            WorkspaceInvitation.token_hash == token_hash(payload.token),
            WorkspaceInvitation.accepted_at.is_(None),
            WorkspaceInvitation.revoked_at.is_(None),
            WorkspaceInvitation.expires_at > utcnow(),
        )
    )
    if item is None or item.email != user.email:
        raise HTTPException(status_code=400, detail="Invitation is invalid or expired")
    if not db.scalar(
        select(WorkspaceMembership).where(
            WorkspaceMembership.workspace_id == item.workspace_id,
            WorkspaceMembership.user_id == user.id,
        )
    ):
        db.add(WorkspaceMembership(workspace_id=item.workspace_id, user_id=user.id, role=item.role))
    item.accepted_at = utcnow()
    db.commit()
    workspace = db.get(Workspace, item.workspace_id)
    if workspace is None:
        raise HTTPException(status_code=404, detail="Workspace not found")
    return workspace


@router.patch("/current/members/{membership_id}", response_model=MemberResponse)
def change_role(
    membership_id: str,
    payload: RoleUpdate,
    user: User = Depends(get_current_user),
    workspace: Workspace = Depends(get_current_workspace),
    db: Session = Depends(get_db),
) -> MemberResponse:
    actor = _can_manage(db, workspace, user)
    membership = db.scalar(
        select(WorkspaceMembership).where(
            WorkspaceMembership.id == membership_id,
            WorkspaceMembership.workspace_id == workspace.id,
        )
    )
    if membership is None:
        raise HTTPException(status_code=404, detail="Member not found")
    if membership.role == "owner" or (actor.role == "admin" and membership.role == "admin"):
        raise HTTPException(
            status_code=403, detail="Only ownership transfer can change this member"
        )
    membership.role = payload.role
    db.commit()
    member = db.get(User, membership.user_id)
    return MemberResponse(
        id=membership.id,
        user_id=member.id,
        email=member.email,
        name=member.name,
        role=membership.role,
    )


@router.delete("/current/members/{membership_id}", status_code=204)
def remove_member(
    membership_id: str,
    user: User = Depends(get_current_user),
    workspace: Workspace = Depends(get_current_workspace),
    db: Session = Depends(get_db),
) -> None:
    _can_manage(db, workspace, user)
    membership = db.scalar(
        select(WorkspaceMembership).where(
            WorkspaceMembership.id == membership_id,
            WorkspaceMembership.workspace_id == workspace.id,
        )
    )
    if membership is None:
        raise HTTPException(status_code=404, detail="Member not found")
    if membership.role == "owner":
        raise HTTPException(status_code=409, detail="Workspace owner cannot be removed")
    db.delete(membership)
    db.commit()
