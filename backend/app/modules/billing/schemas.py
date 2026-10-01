from datetime import datetime

from pydantic import BaseModel, Field


class CheckoutRequest(BaseModel):
    plan_code: str
    price_id: str | None = None
    seats: int = Field(default=1, ge=1, le=100)


class CheckoutResponse(BaseModel):
    checkout_url: str
    session_id: str


class PortalResponse(BaseModel):
    link: str


class SubscriptionResponse(BaseModel):
    plan_code: str
    status: str
    current_period_end: datetime | None
    cancel_at_period_end: bool
    quantity: int
    grace_until: datetime | None

    model_config = {"from_attributes": True}
