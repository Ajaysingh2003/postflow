"""Shared types for user-triggered management of a published variant."""

from typing import Any

from pydantic import BaseModel, Field


class PostActions(BaseModel):
    can_read_replies: bool = False
    can_reply: bool = False
    reply_requires_parent: bool = False
    can_edit: bool = False
    can_delete: bool = False
    edit_field: str = "text"
    max_reply_length: int = 1000
    external_url: str | None = None
    notices: list[str] = Field(default_factory=list)


class PostReply(BaseModel):
    id: str
    author: str
    text: str
    created_at: str | None = None
    parent_id: str | None = None
    target_token: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict, exclude=True)


class RepliesPage(BaseModel):
    items: list[PostReply] = Field(default_factory=list)
    next_cursor: str | None = None
    notice: str | None = None


class ManagedResult(BaseModel):
    external_id: str | None = None
    external_url: str | None = None
    message: str = "Saved"
