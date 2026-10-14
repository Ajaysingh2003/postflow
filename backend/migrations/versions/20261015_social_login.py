"""Browser-bound OAuth sign-in challenges; preserves existing users and channel tokens."""

import sqlalchemy as sa
from alembic import op

revision = "20261015_social_login"
down_revision = "20261014_email_otp"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "auth_oauth_states",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("provider", sa.String(32), nullable=False),
        sa.Column("state_hash", sa.String(64), nullable=False),
        sa.Column("browser_hash", sa.String(64), nullable=False),
        sa.Column("encrypted_verifier", sa.Text(), nullable=False),
        sa.Column("redirect_uri", sa.String(500), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("consumed_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index(
        "ix_auth_oauth_states_state_hash", "auth_oauth_states", ["state_hash"], unique=True
    )
    op.create_index("ix_auth_oauth_states_expires_at", "auth_oauth_states", ["expires_at"])


def downgrade():
    op.drop_table("auth_oauth_states")
