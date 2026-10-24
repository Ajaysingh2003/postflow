from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, model_validator

from app.modules.analytics.schemas import PlanLimitsResponse


class CheckoutRequest(BaseModel):
    plan_code: str
    price_id: str | None = None
    billing_cycle: Literal["monthly", "quarterly", "annually"] = "monthly"
    seats: int = Field(default=1, ge=1, le=100)

    @model_validator(mode="after")
    def matching_price_selection(self):
        if self.price_id:
            choices = {
                f"{self.plan_code}_{cycle}": cycle for cycle in ("monthly", "quarterly", "annually")
            }
            selected = choices.get(self.price_id)
            if selected is None:
                raise ValueError("Price selection does not match this plan")
            if "billing_cycle" in self.model_fields_set and selected != self.billing_cycle:
                raise ValueError("Price selection does not match this billing cycle")
            self.billing_cycle = selected
        return self


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


class BillingUsageResponse(BaseModel):
    usage: PlanLimitsResponse
    subscription: SubscriptionResponse | None
    can_manage_billing: bool
