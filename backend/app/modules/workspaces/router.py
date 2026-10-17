from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.dependencies import get_current_user, get_current_workspace, membership_for
from app.core.security import new_token, normalize_email, token_hash, utcnow
from app.db.session import get_db
from app.modules.billing.entitlements import PLAN_DEFAULTS, effective_plan, entitlement_limit
from app.modules.billing.usage import lock_workspace
from app.modules.identity import service as identity_service
from app.modules.identity.mail import deliver_token
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


def _live_invitations(workspace_id):
    return select(WorkspaceInvitation).where(
        WorkspaceInvitation.workspace_id == workspace_id,
        WorkspaceInvitation.accepted_at.is_(None),
        WorkspaceInvitation.revoked_at.is_(None),
        WorkspaceInvitation.expires_at > utcnow(),
    )


def _send_invitations(payloads, user, workspace, db):
    _can_manage(db, workspace, user)
    lock_workspace(db, workspace.id)
    members = list(
        db.execute(
            select(WorkspaceMembership, User.email)
            .join(User)
            .where(WorkspaceMembership.workspace_id == workspace.id)
        )
    )
    member_emails = {email for _, email in members}
    emails = {normalize_email(str(inv.email)) for inv in payloads}
    if emails & member_emails:
        raise HTTPException(409, "This person is already a workspace member")
    pending = list(db.scalars(_live_invitations(workspace.id)))
    reserved = {item.email for item in pending} | emails
    limit = entitlement_limit(db, workspace.id, "seats")
    if limit is not None and len(members) + len(reserved) > limit:
        raise HTTPException(409, "Workspace seat limit reached, including pending invitations")
    if len(payloads) > 1:
        # Email cannot be rolled back: later failures must keep already delivered links valid.
        db.rollback()
        results = []
        for inv in payloads:
            try:
                results.extend(_send_invitations([inv], user, workspace, db))
            except HTTPException as exc:
                raise HTTPException(
                    exc.status_code,
                    f"{len(results)} invitations sent. Could not invite {inv.email}: {exc.detail}. Retry the remaining invitations",
                ) from exc
        return results
    # A resend replaces the old link only if delivery and the transaction succeed.
    for old in pending:
        if old.email in emails:
            old.revoked_at = utcnow()
    pairs = []
    for inv in payloads:
        raw = new_token(48)
        item = WorkspaceInvitation(
            workspace_id=workspace.id,
            invited_by_user_id=user.id,
            email=normalize_email(str(inv.email)),
            role=inv.role,
            token_hash=token_hash(raw),
            expires_at=utcnow() + timedelta(days=7),
        )
        db.add(item)
        pairs.append((item, raw))
    db.flush()
    try:
        for item, raw in pairs:
            deliver_token(item.email, raw, "invitations/accept")
        db.commit()
    except Exception:
        db.rollback()
        raise
    return [
        InvitationResponse(
            id=item.id,
            email=item.email,
            role=item.role,
            expires_at=item.expires_at,
            development_token=raw if get_settings().debug else None,
        )
        for item, raw in pairs
    ]


@router.post("/current/invitations", response_model=InvitationResponse, status_code=201)
def invite(
    payload: InvitationCreate,
    user: User = Depends(get_current_user),
    workspace: Workspace = Depends(get_current_workspace),
    db: Session = Depends(get_db),
):
    return _send_invitations([payload], user, workspace, db)[0]


@router.post("/current/invitations/bulk", response_model=list[InvitationResponse], status_code=201)
def bulk_invite(
    payload: InvitationCreateBulk,
    user: User = Depends(get_current_user),
    workspace: Workspace = Depends(get_current_workspace),
    db: Session = Depends(get_db),
):
    return _send_invitations(payload.invitations, user, workspace, db)


@router.get("/current/invitations", response_model=list[InvitationResponse])
def pending_invitations(
    user: User = Depends(get_current_user),
    workspace: Workspace = Depends(get_current_workspace),
    db: Session = Depends(get_db),
):
    _can_manage(db, workspace, user)
    return list(
        db.scalars(_live_invitations(workspace.id).order_by(WorkspaceInvitation.created_at))
    )


@router.delete("/current/invitations/{invitation_id}", status_code=204)
def revoke_invitation(
    invitation_id: str,
    user: User = Depends(get_current_user),
    workspace: Workspace = Depends(get_current_workspace),
    db: Session = Depends(get_db),
):
    _can_manage(db, workspace, user)
    lock_workspace(db, workspace.id)
    item = db.scalar(_live_invitations(workspace.id).where(WorkspaceInvitation.id == invitation_id))
    if item is None:
        raise HTTPException(404, "Pending invitation not found")
    item.revoked_at = utcnow()
    db.commit()


@router.post("/invitations/preview")
def preview_invitation(payload: InvitationAccept, db: Session = Depends(get_db)):
    item = db.scalar(
        select(WorkspaceInvitation).where(
            WorkspaceInvitation.token_hash == token_hash(payload.token)
        )
    )
    if item is None or item.revoked_at:
        raise HTTPException(
            404, "This invitation is invalid or has been replaced. Ask for a new invitation"
        )
    if item.accepted_at:
        return {"status": "accepted"}
    from app.core.security import as_utc

    if as_utc(item.expires_at) <= utcnow():
        raise HTTPException(
            410, "This invitation has expired. Ask the workspace owner to send a new one"
        )
    workspace = db.get(Workspace, item.workspace_id)
    if workspace is None:
        raise HTTPException(404, "This workspace is no longer available")
    local, domain = item.email.split("@", 1)
    return {
        "status": "pending",
        "workspace_name": workspace.name,
        "role": item.role,
        "email_hint": local[:1] + "•••@" + domain,
        "expires_at": item.expires_at,
    }


@router.post("/invitations/accept", response_model=WorkspaceResponse)
def accept_invitation(
    payload: InvitationAccept, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> Workspace:
    token = token_hash(payload.token)
    item = db.scalar(select(WorkspaceInvitation).where(WorkspaceInvitation.token_hash == token))
    if item is None:
        raise HTTPException(404, "This invitation is invalid. Ask for a new invitation")
    workspace_id = item.workspace_id
    lock_workspace(db, workspace_id)
    db.expire_all()
    item = db.scalar(
        select(WorkspaceInvitation).where(WorkspaceInvitation.token_hash == token).with_for_update()
    )
    from app.core.security import as_utc

    if item.revoked_at or as_utc(item.expires_at) <= utcnow():
        raise HTTPException(410, "This invitation has expired or was revoked. Ask for a new one")
    if item.email != normalize_email(user.email):
        raise HTTPException(403, "Sign in with the email address that received this invitation")
    member = db.scalar(
        select(WorkspaceMembership).where(
            WorkspaceMembership.workspace_id == workspace_id, WorkspaceMembership.user_id == user.id
        )
    )
    if item.accepted_at and member is None:
        raise HTTPException(410, "This invitation was already used. Ask for a new one")
    if member is None:
        inviter = db.scalar(
            select(WorkspaceMembership).where(
                WorkspaceMembership.workspace_id == workspace_id,
                WorkspaceMembership.user_id == item.invited_by_user_id,
            )
        )
        if inviter is None or inviter.role not in MANAGE_ROLES:
            raise HTTPException(410, "This invitation is no longer authorized. Ask for a new one")
        count = (
            db.scalar(
                select(func.count())
                .select_from(WorkspaceMembership)
                .where(WorkspaceMembership.workspace_id == workspace_id)
            )
            or 0
        )
        limit = entitlement_limit(db, workspace_id, "seats")
        if limit is not None and count >= limit:
            raise HTTPException(
                409, "This workspace is full. Ask its owner to make a seat available"
            )
        db.add(WorkspaceMembership(workspace_id=workspace_id, user_id=user.id, role=item.role))
    item.accepted_at = item.accepted_at or utcnow()
    db.commit()
    return db.get(Workspace, workspace_id)


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
