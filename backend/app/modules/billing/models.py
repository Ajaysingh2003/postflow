from datetime import UTC, datetime

from sqlalchemy import (
    JSON,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class BillingCustomer(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "billing_customers"

    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), unique=True)
    provider_customer_id: Mapped[str] = mapped_column(String(100), unique=True, index=True)


class Subscription(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "subscriptions"

    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    workspace_id: Mapped[str] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), index=True
    )
    provider_subscription_id: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    plan_code: Mapped[str] = mapped_column(String(40), default="free")
    status: Mapped[str] = mapped_column(String(40), index=True)
    current_period_end: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    cancel_at_period_end: Mapped[bool] = mapped_column(default=False)
    quantity: Mapped[int] = mapped_column(Integer, default=1)
    current_period_start: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    grace_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)
    last_reconciled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    provider_updated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), index=True
    )


class BillingWebhookEvent(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "billing_webhook_events"
    __table_args__ = (UniqueConstraint("provider", "provider_event_id"),)

    provider: Mapped[str] = mapped_column(String(40), default="dodo")
    provider_event_id: Mapped[str] = mapped_column(String(160))
    event_type: Mapped[str] = mapped_column(String(100), index=True)
    payload: Mapped[dict] = mapped_column(JSON)
    processed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    processing_error: Mapped[str | None] = mapped_column(Text)


class UsageLedger(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "usage_ledger"
    __table_args__ = (UniqueConstraint("workspace_id", "kind", "reference_id"),)

    workspace_id: Mapped[str] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), index=True
    )
    kind: Mapped[str] = mapped_column(String(50), index=True)
    amount: Mapped[int] = mapped_column(Integer)
    state: Mapped[str] = mapped_column(String(20), default="settled", index=True)
    reference_id: Mapped[str | None] = mapped_column(String(100), index=True)
    metadata_json: Mapped[dict] = mapped_column(JSON, default=dict)


class EntitlementGrant(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "entitlement_grants"
    __table_args__ = (UniqueConstraint("workspace_id", "capability"),)

    workspace_id: Mapped[str] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), index=True
    )
    capability: Mapped[str] = mapped_column(String(80))
    limit_value: Mapped[int | None] = mapped_column(Integer)
    source: Mapped[str] = mapped_column(String(30), default="plan")
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class Plan(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "plans"
    code: Mapped[str] = mapped_column(String(40), unique=True)
    name: Mapped[str] = mapped_column(String(100))
    limits: Mapped[dict] = mapped_column(JSON, default=dict)
    active: Mapped[bool] = mapped_column(default=True)


class AICreditBalance(TimestampMixin, Base):
    __tablename__ = "ai_credit_balances"
    __table_args__ = (
        CheckConstraint(
            "monthly_used >= 0 AND monthly_reserved >= 0", name="ck_ai_monthly_nonnegative"
        ),
        CheckConstraint(
            "bonus_credits >= bonus_reserved AND bonus_reserved >= 0 AND bonus_used >= 0",
            name="ck_ai_bonus_nonnegative",
        ),
        CheckConstraint("cycle_end > cycle_start", name="ck_ai_credit_cycle"),
    )
    workspace_id: Mapped[str] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), primary_key=True
    )
    cycle_start: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    cycle_end: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    monthly_used: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    monthly_reserved: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    bonus_credits: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    bonus_reserved: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    bonus_used: Mapped[int] = mapped_column(Integer, default=0, server_default="0")


class AICreditReservation(TimestampMixin, Base):
    __tablename__ = "ai_credit_reservations"
    __table_args__ = (
        CheckConstraint("source IN ('monthly', 'bonus')", name="ck_ai_reservation_source"),
        CheckConstraint(
            "state IN ('reserved', 'settled', 'released', 'expired')",
            name="ck_ai_reservation_state",
        ),
    )
    run_id: Mapped[str] = mapped_column(
        ForeignKey("assistant_runs.id", ondelete="CASCADE"), primary_key=True
    )
    workspace_id: Mapped[str] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), index=True
    )
    cycle_start: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    source: Mapped[str] = mapped_column(String(20))
    state: Mapped[str] = mapped_column(String(20), default="reserved", index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)


class AICreditEvent(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "ai_credit_events"
    __table_args__ = (
        UniqueConstraint("workspace_id", "request_key", name="uq_ai_credit_event_request"),
    )
    workspace_id: Mapped[str] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), index=True
    )
    action: Mapped[str] = mapped_column(String(40))
    actor: Mapped[str] = mapped_column(String(160))
    reason: Mapped[str] = mapped_column(Text)
    request_key: Mapped[str | None] = mapped_column(String(160), nullable=True)
    before: Mapped[dict] = mapped_column(JSON, default=dict)
    after: Mapped[dict] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC)
    )


class BillingReconciliationState(TimestampMixin, Base):
    __tablename__ = "billing_reconciliation_states"

    provider: Mapped[str] = mapped_column(String(40), primary_key=True)
    cursor_id: Mapped[str | None] = mapped_column(String(36))
    upper_bound_id: Mapped[str | None] = mapped_column(String(36))
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    next_run_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    next_request_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    lease_owner: Mapped[str | None] = mapped_column(String(36))
    lease_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    provider_failures: Mapped[int] = mapped_column(Integer, default=0)


class BillingReconciliationRetry(TimestampMixin, Base):
    __tablename__ = "billing_reconciliation_retries"

    subscription_id: Mapped[str] = mapped_column(
        ForeignKey("subscriptions.id", ondelete="CASCADE"), primary_key=True
    )
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    next_attempt_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    last_attempt_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    error_code: Mapped[str] = mapped_column(String(80))
