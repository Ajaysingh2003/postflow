"""Update paid AI credits and add brand-profile plan allowances without resetting usage."""

import sqlalchemy as sa
from alembic import op

revision = "20261017_plan_brand_profiles"
down_revision = "20261015_billing_recovery"
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
    credits = {"starter": 1000, "creator": 1000, "pro": 5000, "business": 8000, "agency": 8000}
    profiles = {"free": 0, "starter": 3, "creator": 3, "pro": 5, "business": 10, "agency": 10}
    for code, limits in connection.execute(sa.select(plans.c.code, plans.c.limits)):
        if code not in profiles:
            continue
        updated = {**(limits or {}), "brand_profiles": profiles[code]}
        if code in credits:
            updated.update(ai_credits=credits[code], scheduled_posts=None)
        connection.execute(plans.update().where(plans.c.code == code).values(limits=updated))
    # Update only plan-generated credit grants. Manual bonuses/custom grants and
    # consumed usage remain intact; a downgrade still uses the Free allowance.
    latest = {}
    for row in connection.execute(
        sa.select(subscriptions).order_by(
            subscriptions.c.created_at.asc(), subscriptions.c.id.asc()
        )
    ):
        latest[row.workspace_id] = row.plan_code
    for workspace_id, code in latest.items():
        if code in credits:
            connection.execute(
                grants.update()
                .where(
                    grants.c.workspace_id == workspace_id,
                    grants.c.source == "plan",
                    grants.c.capability == "ai_credits",
                )
                .values(limit_value=credits[code])
            )


def downgrade():
    # Commercial allowance changes do not have a safe automatic reversal: restoring
    # guessed limits could revoke credits that customers have already purchased.
    pass
