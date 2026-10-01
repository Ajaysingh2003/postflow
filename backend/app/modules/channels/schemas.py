from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

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
    created_at: datetime
    updated_at: datetime


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
