"""Persist private assistant conversations and their ordered turns, preserving existing data."""

import sqlalchemy as sa
from alembic import op

revision = "20261013_chats"
down_revision = "20261009_agents"
branch_labels = None
depends_on = None


def timestamps():
    return [
        sa.Column("id", sa.String(36), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    ]


def upgrade():
    op.create_table(
        "assistant_conversations",
        sa.Column("workspace_id", sa.String(36), nullable=False),
        sa.Column("user_id", sa.String(36), nullable=False),
        sa.Column("title", sa.String(160), nullable=False),
        sa.Column("platform", sa.String(32), nullable=False),
        sa.Column("connected_account_id", sa.String(36), nullable=True),
        sa.Column("context", sa.JSON(), nullable=False),
        sa.Column("turn_count", sa.Integer(), nullable=False),
        *timestamps(),
        sa.ForeignKeyConstraint(["workspace_id"], ["workspaces.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["connected_account_id"], ["connected_accounts.id"], ondelete="SET NULL"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    for column in ["workspace_id", "user_id"]:
        op.create_index(f"ix_assistant_conversations_{column}", "assistant_conversations", [column])
    op.create_index(
        "ix_assistant_conversations_owner_updated",
        "assistant_conversations",
        ["workspace_id", "user_id", "updated_at", "id"],
    )
    op.create_table(
        "assistant_turns",
        sa.Column("conversation_id", sa.String(36), nullable=False),
        sa.Column("request_id", sa.String(36), nullable=False),
        sa.Column("sequence", sa.Integer(), nullable=False),
        sa.Column("prompt", sa.Text(), nullable=False),
        sa.Column("original_text", sa.Text(), nullable=False),
        sa.Column("request_data", sa.JSON(), nullable=False),
        sa.Column("response_data", sa.JSON(), nullable=False),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("error", sa.Text(), nullable=True),
        *timestamps(),
        sa.ForeignKeyConstraint(
            ["conversation_id"], ["assistant_conversations.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "conversation_id", "request_id", name="uq_assistant_turns_conversation_request"
        ),
        sa.UniqueConstraint(
            "conversation_id", "sequence", name="uq_assistant_turns_conversation_sequence"
        ),
    )
    op.create_index("ix_assistant_turns_conversation_id", "assistant_turns", ["conversation_id"])


def downgrade():
    op.drop_table("assistant_turns")
    op.drop_table("assistant_conversations")
