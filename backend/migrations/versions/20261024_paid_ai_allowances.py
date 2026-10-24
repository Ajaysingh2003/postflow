"""Align stored paid AI allowances with the current catalog without resetting usage."""

import sqlalchemy as sa
from alembic import op

revision = "20261024_paid_ai_allowances"
down_revision = "20261018_onboarding"
branch_labels = None
depends_on = None


def upgrade():
    connection = op.get_bind()
    plans = sa.table("plans", sa.column("code", sa.String), sa.column("limits", sa.JSON))
    grants = sa.table(
        "entitlement_grants",
        sa.column("workspace_id", sa.String),
        sa.column("capability", sa.String),
        sa.column("limit_value", sa.Integer),
        sa.column("source", sa.String),
    )
    subscriptions = sa.table(
        "subscriptions",
        sa.column("workspace_id", sa.String),
        sa.column("plan_code", sa.String),
        sa.column("created_at", sa.DateTime),
        sa.column("id", sa.String),
    )
    # Legacy subscription codes retain the allowance of their canonical plan.
    credits = {"starter": 300, "creator": 300, "pro": 2000, "business": 5000, "agency": 5000}
    for code, limits in connection.execute(sa.select(plans.c.code, plans.c.limits)):
        if code in credits:
            connection.execute(
                plans.update()
                .where(plans.c.code == code)
                .values(limits={**(limits or {}), "ai_credits": credits[code]})
            )

    latest_plan = (
        sa.select(subscriptions.c.plan_code)
        .where(subscriptions.c.workspace_id == grants.c.workspace_id)
        .order_by(subscriptions.c.created_at.desc(), subscriptions.c.id.desc())
        .limit(1)
        .scalar_subquery()
    )
    for code, allowance in credits.items():
        connection.execute(
            grants.update()
            .where(
                grants.c.source == "plan",
                grants.c.capability == "ai_credits",
                latest_plan == code,
            )
            .values(limit_value=allowance)
        )


def downgrade():
    # A schema rollback must not silently restore outdated commercial allowances.
    pass
