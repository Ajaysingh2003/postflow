from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class DraftAttachment(BaseModel):
    asset_id: str
    name: str = Field(max_length=255)
    content_type: Literal["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf", "video/mp4"]


class DraftMention(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    profile_url: str | None = Field(default=None, max_length=500)
    avatar_url: str | None = Field(default=None, max_length=1000)
    entity_type: str | None = Field(default=None, max_length=50)


class PostVariantCreate(BaseModel):
    connected_account_id: str | None = None
    platform: str
    payload: dict = Field(default_factory=dict)
    scheduled_time: datetime | None = None
    idempotency_key: str | None = None


class PostVariantResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    post_id: str
    connected_account_id: str | None = None
    platform: str
    payload: dict = Field(default_factory=dict)
    scheduled_time: datetime | None = None
    status: str
    external_post_id: str | None = None
    last_error: str | None = None
    attempt_count: int = 0
    idempotency_key: str
    created_at: datetime
    updated_at: datetime


class PostCreate(BaseModel):
    title: str = Field(default="Untitled", min_length=1, max_length=240)
    base_text: str = Field(default="", max_length=50_000)
    content: str | None = None  # alias for base_text
    status: str = "draft"
    variants: list[PostVariantCreate] = Field(default_factory=list)


class PostUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=240)
    base_text: str | None = Field(default=None, max_length=50_000)
    content: str | None = None  # alias for base_text
    status: str | None = None


class PostResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    workspace_id: str
    author_id: str
    title: str
    base_text: str
    status: str
    created_at: datetime
    updated_at: datetime
    variants: list[PostVariantResponse] = Field(default_factory=list)

    @property
    def content(self) -> str:
        return self.base_text
