"""Add publishing recovery, OAuth metadata, plans and templates without resetting data."""

import sqlalchemy as sa
from alembic import op

revision = "20261002_reliability"
down_revision = "ceb2b91baf53"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("oauth_states") as batch:
        batch.add_column(sa.Column("encrypted_metadata", sa.Text(), nullable=True))
    with op.batch_alter_table("post_variants") as batch:
        batch.add_column(sa.Column("publishing_started_at", sa.DateTime(timezone=True)))
        batch.add_column(sa.Column("published_at", sa.DateTime(timezone=True)))
        batch.add_column(sa.Column("publish_state", sa.JSON(), nullable=False, server_default="{}"))
        batch.create_index("ix_post_variants_published_at", ["published_at"])
    with op.batch_alter_table("usage_ledger") as batch:
        batch.create_unique_constraint(
            "uq_usage_ledger_workspace_id", ["workspace_id", "kind", "reference_id"]
        )
    op.create_table(
        "plans",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("code", sa.String(40), nullable=False, unique=True),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("limits", sa.JSON(), nullable=False),
        sa.Column("active", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    from datetime import UTC, datetime
    from uuid import uuid4

    PLAN_DEFAULTS = {
        "free": {
            "ai_credits": 20,
            "scheduled_posts": 5,
            "seats": 1,
            "workspaces": 1,
            "connected_accounts": 2,
        },
        "starter": {
            "ai_credits": 250,
            "scheduled_posts": 50,
            "seats": 3,
            "workspaces": 3,
            "connected_accounts": 5,
        },
        "creator": {
            "ai_credits": 250,
            "scheduled_posts": 50,
            "seats": 1,
            "workspaces": 1,
            "connected_accounts": 5,
        },
        "pro": {
            "ai_credits": 1000,
            "scheduled_posts": 250,
            "seats": 5,
            "workspaces": 5,
            "connected_accounts": 15,
        },
        "business": {
            "ai_credits": 5000,
            "scheduled_posts": 1000,
            "seats": 15,
            "workspaces": 10,
            "connected_accounts": 50,
        },
        "agency": {
            "ai_credits": 5000,
            "scheduled_posts": 1000,
            "seats": 25,
            "workspaces": 25,
            "connected_accounts": 100,
        },
    }
    plans = sa.table(
        "plans",
        sa.column("id", sa.String),
        sa.column("code", sa.String),
        sa.column("name", sa.String),
        sa.column("limits", sa.JSON),
        sa.column("active", sa.Boolean),
        sa.column("created_at", sa.DateTime),
        sa.column("updated_at", sa.DateTime),
    )
    now = datetime.now(UTC)
    op.bulk_insert(
        plans,
        [
            {
                "id": str(uuid4()),
                "code": code,
                "name": code.title(),
                "limits": limits,
                "active": True,
                "created_at": now,
                "updated_at": now,
            }
            for code, limits in PLAN_DEFAULTS.items()
        ],
    )
    op.create_table(
        "content_templates",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "workspace_id",
            sa.String(36),
            sa.ForeignKey("workspaces.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(160), nullable=False),
        sa.Column("base_text", sa.Text(), nullable=False),
        sa.Column("variants", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_content_templates_workspace_id", "content_templates", ["workspace_id"])


def downgrade():
    op.drop_table("content_templates")
    op.drop_table("plans")
    with op.batch_alter_table("usage_ledger") as batch:
        batch.drop_constraint("uq_usage_ledger_workspace_id", type_="unique")
    with op.batch_alter_table("post_variants") as batch:
        batch.drop_index("ix_post_variants_published_at")
        batch.drop_column("publish_state")
        batch.drop_column("published_at")
        batch.drop_column("publishing_started_at")
    with op.batch_alter_table("oauth_states") as batch:
        batch.drop_column("encrypted_metadata")
