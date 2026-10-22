import importlib.util
from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest
from alembic.migration import MigrationContext
from alembic.operations import Operations
from sqlalchemy import create_engine, select, text

from app.db.base import Base
from app.db.session import SessionLocal
from app.modules.assistant.models import AssistantRun
from app.modules.billing.credits import balance_for_update
from app.modules.billing.models import AICreditBalance, AICreditEvent
from app.modules.identity.models import User
from app.modules.workspaces.models import Workspace


def migration(connection):
    spec = importlib.util.spec_from_file_location(
        "ai_credit_migration", "migrations/versions/20261018_ai_credit_counters.py"
    )
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    module.op = Operations(MigrationContext.configure(connection))
    return module


def test_migration_preserves_history_and_seeds_existing_workspaces_without_free_refills(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'migration.db'}")
    old_tables = [
        table for table in Base.metadata.sorted_tables if not table.name.startswith("ai_credit_")
    ]
    Base.metadata.create_all(engine, tables=old_tables)
    user_id, ws, empty_ws = str(uuid4()), str(uuid4()), str(uuid4())
    now = datetime.now(UTC)
    with engine.begin() as connection:
        connection.execute(
            User.__table__.insert().values(
                id=user_id,
                email="migration@example.com",
                name="Owner",
                is_active=True,
                created_at=now,
                updated_at=now,
            )
        )
        for workspace_id in (ws, empty_ws):
            connection.execute(
                Workspace.__table__.insert().values(
                    id=workspace_id,
                    owner_user_id=user_id,
                    name="Workspace",
                    slug=workspace_id,
                    created_at=now,
                    updated_at=now,
                )
            )
        for status, age in [
            ("succeeded", timedelta()),
            ("running", timedelta(minutes=1)),
            ("failed", timedelta()),
            ("running", timedelta(hours=1)),
            ("succeeded", timedelta(days=60)),
        ]:
            connection.execute(
                AssistantRun.__table__.insert().values(
                    id=str(uuid4()),
                    workspace_id=ws,
                    user_id=user_id,
                    platform="x",
                    feature_id="rewrite",
                    status=status,
                    tokens_used=1,
                    cost_micros=0,
                    input_summary="",
                    created_at=now - age,
                )
            )
        migration(connection).upgrade()
        rows = connection.execute(select(AICreditBalance.__table__)).mappings().all()
        values = {row["workspace_id"]: row for row in rows}
        assert len(rows) == 2
        assert values[ws]["monthly_used"] == 1
        assert values[ws]["monthly_reserved"] == 1
        assert values[empty_ws]["monthly_used"] == 0
        assert connection.scalar(text("SELECT count(*) FROM assistant_runs")) == 5
        assert connection.scalar(text("SELECT count(*) FROM ai_credit_reservations")) == 1
        assert connection.scalar(text("SELECT count(*) FROM ai_credit_events")) == 2
        assert connection.scalar(text("SELECT count(*) FROM users")) == 1
    engine.dispose()


def test_postgres_operator_sql_is_idempotent_audited_and_preserves_active_reservations(
    client, auth
):
    with SessionLocal() as db:
        if db.bind.dialect.name != "postgresql":
            pytest.skip("PostgreSQL SQL functions and audit triggers")
        user = db.query(User).filter_by(email="owner@example.com").one()
        workspace = db.query(Workspace).filter_by(owner_user_id=user.id).one()
        ws = workspace.id
        balance_for_update(db, ws)
        db.commit()
        migration(db.connection()).install_postgres_sql(db.connection())
        db.commit()
        command = text("SELECT draftva_adjust_ai_credits(:ws, :action, :amount, :reason, :key)")
        params = {
            "ws": ws,
            "action": "grant",
            "amount": 500,
            "reason": "Launch campaign",
            "key": "campaign-1",
        }
        first = db.scalar(command, params)
        repeated = db.scalar(command, params)
        assert first["bonus_credits"] == repeated["bonus_credits"] == 500
        db.commit()
        assert (
            db.scalar(select(AICreditEvent).where(AICreditEvent.request_key == "campaign-1")).action
            == "grant"
        )
        db.execute(
            text(
                "UPDATE ai_credit_balances SET monthly_used=12, monthly_reserved=1 WHERE workspace_id=:ws"
            ),
            {"ws": ws},
        )
        db.commit()
        result = db.scalar(command, {**params, "action": "reset", "amount": 0, "key": "reset-1"})
        assert result["monthly_used"] == 0 and result["monthly_reserved"] == 1
        db.commit()
        assert (
            db.scalar(select(AICreditEvent).where(AICreditEvent.request_key == "reset-1")).reason
            == "Launch campaign"
        )
        assert (
            db.query(AICreditEvent).filter_by(workspace_id=ws, action="sql_adjustment").count() == 1
        )
        with pytest.raises(Exception, match="different adjustment"):
            db.execute(command, {**params, "amount": 600})
        db.rollback()
