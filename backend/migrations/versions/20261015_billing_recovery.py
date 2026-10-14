"""Durable billing reconciliation progress, leases and per-subscription retries."""

import sqlalchemy as sa
from alembic import op

revision = "20261015_billing_recovery"
down_revision = "20261015_social_login"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "billing_reconciliation_states",
        sa.Column("provider", sa.String(40), primary_key=True),
        sa.Column("cursor_id", sa.String(36)),
        sa.Column("upper_bound_id", sa.String(36)),
        sa.Column("started_at", sa.DateTime(timezone=True)),
        sa.Column("completed_at", sa.DateTime(timezone=True)),
        sa.Column("next_run_at", sa.DateTime(timezone=True)),
        sa.Column("next_request_at", sa.DateTime(timezone=True)),
        sa.Column("lease_owner", sa.String(36)),
        sa.Column("lease_expires_at", sa.DateTime(timezone=True)),
        sa.Column("provider_failures", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_table(
        "billing_reconciliation_retries",
        sa.Column(
            "subscription_id",
            sa.String(36),
            sa.ForeignKey("subscriptions.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("attempts", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("next_attempt_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_attempt_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("error_code", sa.String(80), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index(
        "ix_billing_reconciliation_retries_next_attempt_at",
        "billing_reconciliation_retries",
        ["next_attempt_at"],
    )


def downgrade():
    op.drop_table("billing_reconciliation_retries")
    op.drop_table("billing_reconciliation_states")
