"""Workspace-serialized quota reservations and auditable provider expenses."""

from datetime import UTC, datetime

from fastapi import HTTPException
from sqlalchemy import func, select, update

from app.modules.billing.models import UsageLedger
from app.modules.workspaces.models import Workspace


def lock_workspace(db, workspace_id):
    if db.get_bind().dialect.name == "sqlite":
        db.execute(
            update(Workspace).where(Workspace.id == workspace_id).values(name=Workspace.name)
        )
    workspace = db.scalar(select(Workspace).where(Workspace.id == workspace_id).with_for_update())
    if workspace is None:
        raise HTTPException(404, "Workspace not found")


def reserve_provider_cost(db, workspace_id, variant, amount, budget_limit):
    kind = variant.platform + "_publish_cost_micros"
    lock_workspace(db, workspace_id)
    prior = db.scalar(
        select(UsageLedger).where(
            UsageLedger.workspace_id == workspace_id,
            UsageLedger.kind == kind,
            UsageLedger.reference_id == variant.id,
        )
    )
    if prior:
        return
    start = datetime.now(UTC).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    used = (
        db.scalar(
            select(func.sum(UsageLedger.amount)).where(
                UsageLedger.workspace_id == workspace_id,
                UsageLedger.kind == kind,
                UsageLedger.created_at >= start,
            )
        )
        or 0
    )
    if used + amount > budget_limit:
        raise HTTPException(403, "Provider publication spend limit reached for this workspace")
    db.add(
        UsageLedger(
            workspace_id=workspace_id,
            kind=kind,
            amount=amount,
            state="reserved",
            reference_id=variant.id,
        )
    )
    db.flush()
