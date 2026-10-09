"""Add agent OAuth and scoped connections without changing existing product data."""

import sqlalchemy as sa
from alembic import op

revision = "20261009_agents"
down_revision = "20261002_reliability"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "agent_clients",
        sa.Column("name", sa.String(length=160), nullable=False),
        sa.Column("redirect_uris", sa.JSON(), nullable=False),
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_agent_clients")),
    )
    op.create_table(
        "agent_authorizations",
        sa.Column("request_hash", sa.String(length=64), nullable=False),
        sa.Column("client_id", sa.String(length=36), nullable=False),
        sa.Column("redirect_uri", sa.Text(), nullable=False),
        sa.Column("state", sa.Text(), nullable=True),
        sa.Column("code_challenge", sa.String(length=43), nullable=False),
        sa.Column("scopes", sa.JSON(), nullable=False),
        sa.Column("resource", sa.Text(), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("code_hash", sa.String(length=64), nullable=True),
        sa.Column("consumed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("user_id", sa.String(length=36), nullable=True),
        sa.Column("workspace_id", sa.String(length=36), nullable=True),
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["client_id"],
            ["agent_clients.id"],
            name=op.f("fk_agent_authorizations_client_id_agent_clients"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name=op.f("fk_agent_authorizations_user_id_users"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["workspace_id"],
            ["workspaces.id"],
            name=op.f("fk_agent_authorizations_workspace_id_workspaces"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_agent_authorizations")),
        sa.UniqueConstraint("code_hash", name=op.f("uq_agent_authorizations_code_hash")),
        sa.UniqueConstraint("request_hash", name=op.f("uq_agent_authorizations_request_hash")),
    )
    op.create_table(
        "agent_connections",
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("workspace_id", sa.String(length=36), nullable=False),
        sa.Column("client_id", sa.String(length=36), nullable=True),
        sa.Column("name", sa.String(length=160), nullable=False),
        sa.Column("scopes", sa.JSON(), nullable=False),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("refresh_hash", sa.String(length=64), nullable=True),
        sa.Column("resource", sa.Text(), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("grant_expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["client_id"],
            ["agent_clients.id"],
            name=op.f("fk_agent_connections_client_id_agent_clients"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name=op.f("fk_agent_connections_user_id_users"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["workspace_id"],
            ["workspaces.id"],
            name=op.f("fk_agent_connections_workspace_id_workspaces"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_agent_connections")),
        sa.UniqueConstraint("refresh_hash", name=op.f("uq_agent_connections_refresh_hash")),
        sa.UniqueConstraint("token_hash", name=op.f("uq_agent_connections_token_hash")),
    )
    op.create_index(
        op.f("ix_agent_connections_user_id"), "agent_connections", ["user_id"], unique=False
    )
    op.create_index(
        op.f("ix_agent_connections_workspace_id"),
        "agent_connections",
        ["workspace_id"],
        unique=False,
    )


def downgrade():
    op.drop_table("agent_connections")
    op.drop_table("agent_authorizations")
    op.drop_table("agent_clients")
