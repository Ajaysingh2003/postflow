"""Add durable email OTP verification state without changing existing users/tokens."""

import sqlalchemy as sa
from alembic import op

revision = "20261014_email_otp"
down_revision = "20261013_chats"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("email_verification_tokens") as batch:
        batch.add_column(sa.Column("otp_hash", sa.String(64), nullable=True))
        batch.add_column(
            sa.Column("attempt_count", sa.Integer(), server_default="0", nullable=False)
        )
        batch.add_column(sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True))


def downgrade():
    with op.batch_alter_table("email_verification_tokens") as batch:
        batch.drop_column("sent_at")
        batch.drop_column("attempt_count")
        batch.drop_column("otp_hash")
