"""Add durable AI credit counters, one-time bonus balances and reservation audit."""

from calendar import monthrange
from datetime import UTC, datetime, timedelta
from uuid import uuid4

import sqlalchemy as sa
from alembic import op

revision = "20261018_ai_credit_counters"
down_revision = "20261017_plan_brand_profiles"
branch_labels = None
depends_on = None


def _utc(value):
    return value.replace(tzinfo=UTC) if value.tzinfo is None else value.astimezone(UTC)


def _window(subscription, now):
    paid = subscription and (
        subscription.status in {"active", "trialing", "renewed", "updated", "plan_changed"}
        or (
            subscription.status == "cancelled"
            and subscription.current_period_end
            and _utc(subscription.current_period_end) > now
        )
        or (
            subscription.status == "on_hold"
            and subscription.grace_until
            and _utc(subscription.grace_until) > now
        )
    )
    anchor = (
        _utc(subscription.current_period_start)
        if paid and subscription.current_period_start
        else now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    )
    if anchor > now:
        anchor = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    def anniversary(offset):
        year, month = divmod(anchor.year * 12 + anchor.month - 1 + offset, 12)
        month += 1
        return anchor.replace(
            year=year, month=month, day=min(anchor.day, monthrange(year, month)[1])
        )

    offset = (now.year - anchor.year) * 12 + now.month - anchor.month
    if anniversary(offset) > now:
        offset -= 1
    return anniversary(offset), anniversary(offset + 1)


def install_postgres_sql(connection):
    """SQL operator entry points and an audit trigger for direct terminal edits."""
    connection.execute(
        sa.text("""
CREATE OR REPLACE FUNCTION draftva_audit_ai_balance() RETURNS trigger
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE ctx jsonb;
BEGIN
  IF current_setting('draftva.credit_managed', true) = 'on' THEN RETURN NEW; END IF;
  ctx := COALESCE(NULLIF(current_setting('draftva.credit_context', true), ''), '{}')::jsonb;
  INSERT INTO ai_credit_events(id, workspace_id, action, actor, reason, request_key, "before", "after", created_at)
  VALUES (gen_random_uuid()::text, NEW.workspace_id, COALESCE(ctx->>'action', 'sql_adjustment'),
    COALESCE(ctx->>'actor', current_user), COALESCE(ctx->>'reason', 'Direct PostgreSQL balance edit'),
    NULLIF(ctx->>'request_key', ''), CASE WHEN TG_OP = 'INSERT' THEN '{}'::jsonb ELSE to_jsonb(OLD) END,
    to_jsonb(NEW), clock_timestamp());
  RETURN NEW;
END $$;
""")
    )
    connection.execute(
        sa.text("""
CREATE TRIGGER draftva_ai_balance_audit AFTER INSERT OR UPDATE ON ai_credit_balances
FOR EACH ROW EXECUTE FUNCTION draftva_audit_ai_balance();
""")
    )
    connection.execute(
        sa.text("""
CREATE OR REPLACE FUNCTION draftva_adjust_ai_credits(
  target_workspace text, adjustment text, credit_amount integer, adjustment_reason text, operation_key text
) RETURNS jsonb LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE balance ai_credit_balances%ROWTYPE; prior ai_credit_events%ROWTYPE; old_context text;
BEGIN
  IF adjustment NOT IN ('grant', 'reset') OR adjustment IS NULL
    OR (adjustment = 'grant' AND (credit_amount IS NULL OR credit_amount < 1 OR credit_amount > 1000000))
    OR COALESCE(trim(adjustment_reason), '') = '' OR COALESCE(trim(operation_key), '') = ''
    OR length(operation_key) > 160 THEN RAISE EXCEPTION 'Invalid adjustment, reason or operation key'; END IF;
  PERFORM id FROM workspaces WHERE id = target_workspace FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Workspace not found'; END IF;
  SELECT * INTO balance FROM ai_credit_balances WHERE workspace_id = target_workspace FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Initialize this workspace using the credit-admin balance command first'; END IF;
  IF balance.cycle_end <= clock_timestamp() THEN
    RAISE EXCEPTION 'Refresh the monthly window using the credit-admin balance command first';
  END IF;
  SELECT * INTO prior FROM ai_credit_events WHERE workspace_id = target_workspace AND request_key = operation_key;
  IF FOUND THEN
    IF prior.action <> adjustment OR (adjustment = 'grant' AND
       (prior."after"->>'bonus_credits')::integer - (prior."before"->>'bonus_credits')::integer <> credit_amount)
       THEN RAISE EXCEPTION 'Operation key was already used for a different adjustment'; END IF;
    RETURN to_jsonb(balance);
  END IF;
  old_context := current_setting('draftva.credit_context', true);
  PERFORM set_config('draftva.credit_context', jsonb_build_object('action', adjustment,
    'actor', current_user, 'reason', adjustment_reason, 'request_key', operation_key)::text, true);
  UPDATE ai_credit_balances SET
    monthly_used = CASE WHEN adjustment = 'reset' THEN 0 ELSE monthly_used END,
    bonus_credits = bonus_credits + CASE WHEN adjustment = 'grant' THEN credit_amount ELSE 0 END,
    updated_at = clock_timestamp()
  WHERE workspace_id = target_workspace RETURNING * INTO balance;
  PERFORM set_config('draftva.credit_context', COALESCE(old_context, ''), true);
  RETURN to_jsonb(balance);
END $$;
""")
    )


def upgrade():
    op.create_table(
        "ai_credit_balances",
        sa.Column(
            "workspace_id",
            sa.String(36),
            sa.ForeignKey("workspaces.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("cycle_start", sa.DateTime(timezone=True), nullable=False),
        sa.Column("cycle_end", sa.DateTime(timezone=True), nullable=False),
        *[
            sa.Column(name, sa.Integer, nullable=False, server_default="0")
            for name in (
                "monthly_used",
                "monthly_reserved",
                "bonus_credits",
                "bonus_reserved",
                "bonus_used",
            )
        ],
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.CheckConstraint(
            "monthly_used >= 0 AND monthly_reserved >= 0", name="ck_ai_monthly_nonnegative"
        ),
        sa.CheckConstraint(
            "bonus_credits >= bonus_reserved AND bonus_reserved >= 0 AND bonus_used >= 0",
            name="ck_ai_bonus_nonnegative",
        ),
        sa.CheckConstraint("cycle_end > cycle_start", name="ck_ai_credit_cycle"),
    )
    op.create_table(
        "ai_credit_reservations",
        sa.Column(
            "run_id",
            sa.String(36),
            sa.ForeignKey("assistant_runs.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "workspace_id",
            sa.String(36),
            sa.ForeignKey("workspaces.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("cycle_start", sa.DateTime(timezone=True), nullable=False),
        sa.Column("source", sa.String(20), nullable=False),
        sa.Column("state", sa.String(20), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.CheckConstraint("source IN ('monthly', 'bonus')", name="ck_ai_reservation_source"),
        sa.CheckConstraint(
            "state IN ('reserved', 'settled', 'released', 'expired')",
            name="ck_ai_reservation_state",
        ),
    )
    for column in ("workspace_id", "state", "expires_at"):
        op.create_index(f"ix_ai_credit_reservations_{column}", "ai_credit_reservations", [column])
    op.create_table(
        "ai_credit_events",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "workspace_id",
            sa.String(36),
            sa.ForeignKey("workspaces.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("action", sa.String(40), nullable=False),
        sa.Column("actor", sa.String(160), nullable=False),
        sa.Column("reason", sa.Text, nullable=False),
        sa.Column("request_key", sa.String(160)),
        sa.Column("before", sa.JSON, nullable=False),
        sa.Column("after", sa.JSON, nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.UniqueConstraint("workspace_id", "request_key", name="uq_ai_credit_event_request"),
    )
    op.create_index("ix_ai_credit_events_workspace_id", "ai_credit_events", ["workspace_id"])
    connection = op.get_bind()
    metadata = sa.MetaData()
    metadata.reflect(
        connection,
        only=[
            "workspaces",
            "subscriptions",
            "assistant_runs",
            "ai_credit_balances",
            "ai_credit_reservations",
            "ai_credit_events",
        ],
    )
    workspaces, subscriptions, runs, balances, reservations, events = [
        metadata.tables[name]
        for name in (
            "workspaces",
            "subscriptions",
            "assistant_runs",
            "ai_credit_balances",
            "ai_credit_reservations",
            "ai_credit_events",
        )
    ]
    now, cursor = datetime.now(UTC), ""
    while True:
        ids = list(
            connection.scalars(
                sa.select(workspaces.c.id)
                .where(workspaces.c.id > cursor)
                .order_by(workspaces.c.id)
                .limit(100)
            )
        )
        if not ids:
            break
        for workspace_id in ids:
            sub = connection.execute(
                sa.select(subscriptions)
                .where(subscriptions.c.workspace_id == workspace_id)
                .order_by(subscriptions.c.created_at.desc(), subscriptions.c.id.desc())
                .limit(1)
            ).first()
            start, end = _window(sub, now)
            where = [
                runs.c.workspace_id == workspace_id,
                runs.c.created_at >= start,
                runs.c.created_at < end,
            ]
            used = connection.scalar(
                sa.select(sa.func.count())
                .select_from(runs)
                .where(*where, runs.c.status == "succeeded")
            )
            pending = list(
                connection.execute(
                    sa.select(runs.c.id, runs.c.created_at).where(
                        *where,
                        runs.c.status == "running",
                        runs.c.created_at > now - timedelta(minutes=30),
                    )
                )
            )
            values = {
                "workspace_id": workspace_id,
                "cycle_start": start,
                "cycle_end": end,
                "monthly_used": used,
                "monthly_reserved": len(pending),
                "bonus_credits": 0,
                "bonus_reserved": 0,
                "bonus_used": 0,
                "created_at": now,
                "updated_at": now,
            }
            connection.execute(balances.insert().values(**values))
            for run in pending:
                connection.execute(
                    reservations.insert().values(
                        run_id=run.id,
                        workspace_id=workspace_id,
                        cycle_start=start,
                        source="monthly",
                        state="reserved",
                        expires_at=_utc(run.created_at) + timedelta(minutes=30),
                        created_at=now,
                        updated_at=now,
                    )
                )
            connection.execute(
                events.insert().values(
                    id=str(uuid4()),
                    workspace_id=workspace_id,
                    action="initialize",
                    actor="migration",
                    reason="Preserved existing AI usage",
                    before={},
                    after={
                        key: value.isoformat() if isinstance(value, datetime) else value
                        for key, value in values.items()
                    },
                    created_at=now,
                )
            )
        cursor = ids[-1]
    if connection.dialect.name == "postgresql":
        install_postgres_sql(connection)


def downgrade():
    connection = op.get_bind()
    if connection.scalar(sa.text("SELECT count(*) FROM ai_credit_balances")):
        raise RuntimeError(
            "AI credit balances contain financial state; restore a reviewed backup instead"
        )
    # A fresh empty installation has no balances to lose and can be reversed.
    if connection.dialect.name == "postgresql":
        connection.execute(
            sa.text(
                "DROP FUNCTION IF EXISTS draftva_adjust_ai_credits(text,text,integer,text,text)"
            )
        )
        connection.execute(
            sa.text("DROP TRIGGER IF EXISTS draftva_ai_balance_audit ON ai_credit_balances")
        )
        connection.execute(sa.text("DROP FUNCTION IF EXISTS draftva_audit_ai_balance()"))
    op.drop_table("ai_credit_events")
    op.drop_table("ai_credit_reservations")
    op.drop_table("ai_credit_balances")
