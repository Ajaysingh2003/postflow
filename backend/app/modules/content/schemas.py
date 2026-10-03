from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class PostVariantCreate(BaseModel):
    connected_account_id: str | None = None
    platform: str
    payload: dict = Field(default_factory=dict)
    scheduled_time: datetime | None = None
    idempotency_key: str | None = None
    media_asset_ids: list[str] = Field(default_factory=list, max_length=20)


class PostVariantUpdate(BaseModel):
    connected_account_id: str | None = None
    payload: dict | None = None
    media_asset_ids: list[str] | None = Field(default=None, max_length=20)


class PostVariantResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    post_id: str
    connected_account_id: str | None = None
    platform: str
    payload: dict = Field(default_factory=dict)
    scheduled_time: datetime | None = None
    status: str
    published_at: datetime | None = None
    publish_state: dict[str, Any] = Field(default_factory=dict)
    media_asset_ids: list[str] = Field(default_factory=list)
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
    status: Literal["draft"] = "draft"
    variants: list[PostVariantCreate] = Field(default_factory=list)


class PostUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=240)
    base_text: str | None = Field(default=None, max_length=50_000)
    content: str | None = None  # alias for base_text
    status: Literal["draft"] | None = None


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


class TemplateCreate(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    base_text: str = Field(default="", max_length=50_000)
    variants: list[dict] = Field(default_factory=list)


class TemplateResponse(TemplateCreate):
    model_config = ConfigDict(from_attributes=True)
    id: str
    workspace_id: str
