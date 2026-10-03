from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.modules.channels.base import Capabilities, Target


class ConnectedAccountResponse(BaseModel):
    """Safe public representation of a connected social account."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    workspace_id: str
    platform: str
    external_account_id: str
    display_name: str
    account_type: str
    granted_scopes: list[str] = Field(default_factory=list)
    status: str
    token_expires_at: datetime | None = None
    account_metadata: dict[str, Any] = Field(default_factory=dict)
    avatar_url: str | None = None
    created_at: datetime
    updated_at: datetime

    @field_validator("account_metadata")
    @classmethod
    def public_metadata(cls, value):
        def clean(item):
            if isinstance(item, dict):
                return {
                    k: clean(v)
                    for k, v in item.items()
                    if k != "oauth"
                    and not any(word in k.lower() for word in ("token", "secret", "private_key"))
                }
            if isinstance(item, list):
                return [clean(v) for v in item]
            return item

        return clean(value)

    @model_validator(mode="after")
    def populate_avatar_url(self) -> "ConnectedAccountResponse":
        if not self.avatar_url and self.account_metadata:
            meta = self.account_metadata
            candidates = [
                meta.get("avatar_url"),
                meta.get("profile_image_url"),
                meta.get("picture_url"),
                meta.get("avatar"),
                meta.get("icon_img"),
                meta.get("threads_profile_picture_url"),
            ]
            for url in candidates:
                if url and isinstance(url, str):
                    self.avatar_url = url.replace("&amp;", "&")
                    return self

            pic = meta.get("picture")
            if isinstance(pic, str):
                self.avatar_url = pic.replace("&amp;", "&")
                return self
            if isinstance(pic, dict):
                url = pic.get("data", {}).get("url")
                if url and isinstance(url, str):
                    self.avatar_url = url.replace("&amp;", "&")
                    return self

            ig_accounts = meta.get("instagram_accounts")
            if isinstance(ig_accounts, list) and ig_accounts:
                first_ig = ig_accounts[0]
                if isinstance(first_ig, dict):
                    url = first_ig.get("profile_picture_url")
                    if url and isinstance(url, str):
                        self.avatar_url = url.replace("&amp;", "&")
                        return self
        return self


class ConnectRequest(BaseModel):
    """Request to initiate OAuth connection."""

    redirect_uri: str | None = None
    options: dict[str, Any] = Field(default_factory=dict)


class AuthStartResponse(BaseModel):
    """Response containing provider authorization URL and CSRF state token."""

    auth_url: str
    state: str


class CallbackRequest(BaseModel):
    """Callback parameters when exchanging authorization code for tokens."""

    code: str | None = None
    state: str
    error: str | None = None
    error_description: str | None = None
    params: dict[str, Any] = Field(default_factory=dict)


class DisconnectResponse(BaseModel):
    """Response confirming account disconnect."""

    status: str
    account_id: str
    message: str


class CapabilitiesListResponse(BaseModel):
    """All registered platform capabilities."""

    platforms: dict[str, Capabilities]


class TargetListResponse(BaseModel):
    """Available posting targets for a connected account."""

    account_id: str
    platform: str
    targets: list[Target]
