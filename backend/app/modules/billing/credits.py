"""Durable workspace AI counters, reservations, bonus wallet and operator adjustments.

Mutations take the workspace lock before the balance lock. No provider call holds
that transaction open. The old run log is read only on first initialization.
"""

from datetime import UTC, datetime, timedelta

from fastapi import HTTPException
from sqlalchemy import func, or_, select, text

from app.core.security import as_utc
from app.modules.billing.models import AICreditBalance, AICreditEvent, AICreditReservation
from app.modules.billing.usage import lock_workspace

RESERVATION_TTL = timedelta(minutes=30)
FIELDS = (
    "monthly_used",
    "monthly_reserved",
    "bonus_credits",
    "bonus_reserved",
    "bonus_used",
    "cycle_start",
    "cycle_end",
)


def snapshot(balance):
    return {
        name: as_utc(value).isoformat() if isinstance(value, datetime) else value
        for name in FIELDS
        if (value := getattr(balance, name)) is not None
    }


def _write(
    db,
    balance,
    action,
    *,
    before=None,
    actor="system",
    reason="AI credit accounting",
    request_key=None,
):
    postgres = db.get_bind().dialect.name == "postgresql"
    if postgres:
        db.execute(text("SELECT set_config('draftva.credit_managed', 'on', true)"))
    db.add(
        AICreditEvent(
            workspace_id=balance.workspace_id,
            action=action,
            actor=actor,
            reason=reason,
            request_key=request_key,
            before=before or {},
            after=snapshot(balance),
        )
    )
    db.flush()
    if postgres:
        db.execute(text("SELECT set_config('draftva.credit_managed', 'off', true)"))


def _window(db, workspace_id, now):
    from app.modules.billing.entitlements import current_subscription, usage_window

    return usage_window(current_subscription(db, workspace_id), now)


def balance_for_update(db, workspace_id, now=None):
    # The assistant package exports its service/router. Load its model only after
    # this module is initialized so standalone operator commands cannot cycle.
    from app.modules.assistant.models import AssistantRun

    now = as_utc(now or datetime.now(UTC))
    db.flush()
    lock_workspace(db, workspace_id)
    balance = db.scalar(
        select(AICreditBalance)
        .where(AICreditBalance.workspace_id == workspace_id)
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    if balance is None:
        start, end = _window(db, workspace_id, now)
        used = (
            db.scalar(
                select(func.count())
                .select_from(AssistantRun)
                .where(
                    AssistantRun.workspace_id == workspace_id,
                    AssistantRun.status == "succeeded",
                    AssistantRun.created_at >= start,
                    AssistantRun.created_at < end,
                )
            )
            or 0
        )
        running = list(
            db.scalars(
                select(AssistantRun).where(
                    AssistantRun.workspace_id == workspace_id,
                    AssistantRun.status == "running",
                    AssistantRun.created_at >= start,
                    AssistantRun.created_at < end,
                    AssistantRun.created_at > now - RESERVATION_TTL,
                )
            )
        )
        balance = AICreditBalance(
            workspace_id=workspace_id,
            cycle_start=start,
            cycle_end=end,
            monthly_used=used,
            monthly_reserved=len(running),
            bonus_credits=0,
            bonus_reserved=0,
            bonus_used=0,
        )
        db.add(balance)
        for run in running:
            db.add(
                AICreditReservation(
                    run_id=run.id,
                    workspace_id=workspace_id,
                    cycle_start=start,
                    source="monthly",
                    state="reserved",
                    expires_at=as_utc(run.created_at) + RESERVATION_TTL,
                )
            )
        _write(db, balance, "initialize", reason="Preserved existing monthly AI usage")
    elif now >= as_utc(balance.cycle_end):
        before = snapshot(balance)
        start, end = _window(db, workspace_id, now)
        # Changing/renewing a subscription never resets an unexpired window. On
        # rollover avoid counting time already included in the previous window.
        balance.cycle_start = max(start, as_utc(balance.cycle_end))
        balance.cycle_end = end
        balance.monthly_used = balance.monthly_reserved = balance.bonus_used = 0
        _write(db, balance, "monthly_reset", before=before)
    # Recover crashed requests and old workers' already-finished reservations.
    stale = list(
        db.scalars(
            select(AICreditReservation)
            .join(AssistantRun, AssistantRun.id == AICreditReservation.run_id)
            .where(
                AICreditReservation.workspace_id == workspace_id,
                AICreditReservation.state == "reserved",
                or_(AICreditReservation.expires_at <= now, AssistantRun.status != "running"),
            )
            .order_by(AICreditReservation.expires_at)
            .limit(100)
        )
    )
    for reservation in stale:
        run = db.get(AssistantRun, reservation.run_id)
        expired = as_utc(reservation.expires_at) <= now
        _finish(
            db,
            balance,
            reservation,
            success=run.status == "succeeded" and not expired,
            expired=expired,
            now=now,
        )
        if expired and run.status == "running":
            run.status, run.error = (
                "failed",
                "AI credit reservation expired; retry with a new request",
            )
    db.flush()
    return balance


def _limit(db, workspace_id):
    from app.modules.billing.entitlements import entitlement_limit

    return entitlement_limit(db, workspace_id, "ai_credits")


def details(db, workspace_id, now=None):
    balance = balance_for_update(db, workspace_id, now)
    limit = _limit(db, workspace_id)
    monthly_used = balance.monthly_used + balance.monthly_reserved
    bonus_remaining = balance.bonus_credits - balance.bonus_reserved
    return balance, {
        "monthly_limit": limit,
        "monthly_used": balance.monthly_used,
        "monthly_reserved": balance.monthly_reserved,
        "bonus_credits": balance.bonus_credits,
        "bonus_reserved": balance.bonus_reserved,
        "bonus_used": balance.bonus_used,
        "monthly_remaining": None if limit is None else max(0, limit - monthly_used),
        "bonus_remaining": bonus_remaining,
    }


def summary(db, workspace_id, now=None):
    balance, info = details(db, workspace_id, now)
    limit = info["monthly_limit"]
    return (
        balance,
        {
            "used": balance.monthly_used
            + balance.monthly_reserved
            + balance.bonus_used
            + balance.bonus_reserved,
            "limit": None if limit is None else limit + balance.bonus_credits + balance.bonus_used,
            "remaining": None
            if limit is None
            else info["monthly_remaining"] + info["bonus_remaining"],
        },
        info,
    )


def check_available(db, workspace_id, now=None):
    balance, usage, info = summary(db, workspace_id, now)
    if usage["remaining"] == 0:
        raise HTTPException(
            403,
            f"Workspace has reached the monthly limit of {info['monthly_limit']} AI assistant runs and has no bonus credits remaining",
        )
    return balance


def reserve_run(db, run, now=None):
    now = as_utc(now or datetime.now(UTC))
    balance = check_available(db, run.workspace_id, now)
    # Only add the run after bootstrap: otherwise the first request is counted twice.
    db.add(run)
    db.flush()
    existing = db.get(AICreditReservation, run.id)
    if existing:
        raise HTTPException(409, "This AI request already has a credit reservation")
    limit = _limit(db, run.workspace_id)
    source = (
        "monthly"
        if limit is None or balance.monthly_used + balance.monthly_reserved < limit
        else "bonus"
    )
    before = snapshot(balance)
    if source == "monthly":
        balance.monthly_reserved += 1
    else:
        balance.bonus_reserved += 1
    db.add(
        AICreditReservation(
            run_id=run.id,
            workspace_id=run.workspace_id,
            cycle_start=balance.cycle_start,
            source=source,
            state="reserved",
            expires_at=now + RESERVATION_TTL,
        )
    )
    _write(db, balance, "reserve", before=before, reason=run.id)


def _finish(db, balance, reservation, *, success, expired=False, now=None):
    if reservation.state != "reserved":
        return
    before = snapshot(balance)
    same_cycle = as_utc(reservation.cycle_start) == as_utc(balance.cycle_start)
    if reservation.source == "monthly" and same_cycle:
        balance.monthly_reserved -= 1
        if success:
            balance.monthly_used += 1
    elif reservation.source == "bonus":
        balance.bonus_reserved -= 1
        if success:
            balance.bonus_credits -= 1
            if same_cycle:
                balance.bonus_used += 1
    reservation.state = "settled" if success else "expired" if expired else "released"
    _write(db, balance, reservation.state, before=before, reason=reservation.run_id)


def finish_run(db, run_id, workspace_id, *, success, now=None):
    now = as_utc(now or datetime.now(UTC))
    balance = balance_for_update(db, workspace_id, now)
    reservation = db.get(AICreditReservation, run_id)
    if reservation is None or reservation.workspace_id != workspace_id:
        raise HTTPException(409, "AI credit reservation is missing")
    if success and reservation.state not in {"reserved", "settled"}:
        raise HTTPException(
            409, "AI credit reservation expired or was released; retry with a new request"
        )
    _finish(db, balance, reservation, success=success, now=now)


def adjust(db, workspace_id, action, *, amount=0, actor, reason, request_key, now=None):
    if action not in {"grant", "reset"} or (
        action == "grant"
        and (
            isinstance(amount, bool) or not isinstance(amount, int) or not 1 <= amount <= 1_000_000
        )
    ):
        raise ValueError("Grant between 1 and 1,000,000 credits, or reset monthly usage")
    if (
        not actor.strip()
        or len(actor) > 160
        or not reason.strip()
        or len(reason) > 1000
        or not request_key.strip()
        or len(request_key) > 160
    ):
        raise ValueError("Actor, reason and a unique request key are required")
    balance = balance_for_update(db, workspace_id, now)
    prior = db.scalar(
        select(AICreditEvent).where(
            AICreditEvent.workspace_id == workspace_id, AICreditEvent.request_key == request_key
        )
    )
    if prior:
        if prior.action != action or (
            action == "grant"
            and prior.after["bonus_credits"] - prior.before["bonus_credits"] != amount
        ):
            raise ValueError("This request key was already used for a different adjustment")
        return balance
    before = snapshot(balance)
    if action == "grant":
        balance.bonus_credits += amount
    else:
        # Active requests keep their reservation and settle normally after a reset.
        balance.monthly_used = 0
    _write(
        db,
        balance,
        action,
        before=before,
        actor=actor.strip(),
        reason=reason.strip(),
        request_key=request_key,
    )
    return balance


def recover_expired(db, batch_size=100):
    now = datetime.now(UTC)
    workspaces = list(
        db.scalars(
            select(AICreditReservation.workspace_id)
            .where(AICreditReservation.state == "reserved", AICreditReservation.expires_at <= now)
            .distinct()
            .limit(batch_size)
        )
    )
    for workspace_id in workspaces:
        balance_for_update(db, workspace_id, now)
        db.commit()
    return len(workspaces)
