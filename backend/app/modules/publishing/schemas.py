"""Publishing schemas for scheduling, validation, and attempt audit logs."""

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class ScheduleVariantRequest(BaseModel):
    scheduled_time: datetime | None = Field(
        default=None,
        description="Target publication time (UTC). If omitted, scheduled for immediate publish.",
    )


class SchedulePostRequest(BaseModel):
    scheduled_time: datetime | None = Field(
        default=None,
        description="Target publication time (UTC) for all draft variants in this post.",
    )


class ValidationIssueResponse(BaseModel):
    field: str
    message: str
    severity: str = "error"
    code: str | None = None


class ValidateVariantResponse(BaseModel):
    variant_id: str
    platform: str
    is_valid: bool
    issues: list[ValidationIssueResponse] = Field(default_factory=list)


class PublishAttemptResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    variant_id: str
    started_at: datetime
    finished_at: datetime | None = None
    result: str
    error: str | None = None
    status_code: int | None = None
    response_payload: dict[str, Any] | None = None
    created_at: datetime


class VariantPublishResultResponse(BaseModel):
    variant_id: str
    status: str
    scheduled_time: datetime | None = None
    external_post_id: str | None = None
    last_error: str | None = None
    attempt_count: int = 0
    latest_attempt: PublishAttemptResponse | None = None
