"""Remember onboarding completion without interrupting existing customers."""

import sqlalchemy as sa
from alembic import op

revision = "20261018_onboarding"
down_revision = "20261018_ai_credit_counters"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("users", sa.Column("onboarding_completed_at", sa.DateTime(timezone=True)))
    # Only accounts created after this migration need the new welcome flow.
    op.execute(sa.text("UPDATE users SET onboarding_completed_at = CURRENT_TIMESTAMP"))


def downgrade():
    op.drop_column("users", "onboarding_completed_at")
