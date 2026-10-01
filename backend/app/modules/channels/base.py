from typing import Any, Protocol, runtime_checkable

from pydantic import BaseModel, Field

from app.modules.channels.models import ConnectedAccount


class Capabilities(BaseModel):
    """Platform capabilities describing constraints and features."""

    platform: str
    display_name: str
    max_text_length: int
    text_length_type: str = "characters"  # characters, graphemes, words
    supports_media: bool = True
    supported_media_types: list[str] = Field(
        default_factory=lambda: ["image/jpeg", "image/png", "image/webp"]
    )
    max_media_count: int = 4
    supports_video: bool = False
    max_video_duration_seconds: int | None = None
    supports_threads: bool = False
    supports_polls: bool = False
    supports_alt_text: bool = True
    max_alt_text_length: int | None = 1000
    supports_links: bool = True
    supports_tags: bool = True
    visibility_options: list[str] = Field(default_factory=lambda: ["public"])
    requires_target: bool = False
    target_type_name: str | None = None
    supports_account_metrics: bool = True
    supports_scheduling: bool = True


class AuthStart(BaseModel):
    """Result of building an authorization URL for OAuth flows."""

    auth_url: str
    state: str
    code_verifier: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class Target(BaseModel):
    """A publishing target under a connected account (e.g. Page, Subreddit)."""

    id: str
    name: str
    target_type: str
    description: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class Issue(BaseModel):
    """Validation issue for a post variant before scheduling/publishing."""

    field: str
    message: str
    severity: str = "error"  # error | warning
    code: str | None = None


class PublishResult(BaseModel):
    """Result of publishing a variant to a platform."""

    success: bool
    external_post_id: str | None = None
    external_url: str | None = None
    raw_response: dict[str, Any] = Field(default_factory=dict)
    error_message: str | None = None
    is_retryable: bool = False


class Metrics(BaseModel):
    """Post-variant metrics fetched from the original platform API."""

    impressions: int = 0
    reach: int = 0
    engagements: int = 0
    likes: int = 0
    comments: int = 0
    shares_reposts: int = 0
    clicks: int = 0
    extras: dict[str, Any] = Field(default_factory=dict)


class AccountMetrics(BaseModel):
    """Whole-account analytics snapshot fetched directly from the original source platform."""

    followers_count: int = 0
    following_count: int = 0
    profile_views: int = 0
    impressions: int = 0
    reach: int = 0
    engagements: int = 0
    posts_count: int = 0
    extras: dict[str, Any] = Field(default_factory=dict)


@runtime_checkable
class PlatformAdapter(Protocol):
    """Core protocol implemented by each platform adapter."""

    platform: str
    capabilities: Capabilities

    async def build_auth_url(self, workspace_id: str, state: str, **opts: Any) -> AuthStart:
        """Construct the official OAuth authorization URL for this platform."""
        ...

    async def handle_callback(
        self,
        workspace_id: str,
        params: dict[str, Any],
        state: str,
        **opts: Any,
    ) -> ConnectedAccount:
        """Process callback params, exchange codes for tokens, and build ConnectedAccount."""
        ...

    async def refresh_tokens(self, account: ConnectedAccount) -> ConnectedAccount:
        """Refresh expired access tokens using the refresh token."""
        ...

    async def revoke(self, account: ConnectedAccount) -> None:
        """Revoke active tokens with the platform when disconnecting."""
        ...

    async def list_targets(self, account: ConnectedAccount) -> list[Target]:
        """List sub-targets the user can post to (e.g. Facebook Pages, subreddits)."""
        ...

    async def validate(self, variant: Any, **opts: Any) -> list[Issue]:
        """Validate variant text, media, targets, and rules against platform constraints."""
        ...

    async def publish(self, account: ConnectedAccount, variant: Any) -> PublishResult:
        """Publish variant to the platform."""
        ...

    async def delete_post(self, account: ConnectedAccount, external_post_id: str) -> None:
        """Delete an existing post on the platform."""
        ...

    async def fetch_metrics(self, account: ConnectedAccount, external_post_id: str) -> Metrics:
        """Fetch post-level performance metrics from the official platform API."""
        ...

    async def fetch_account_metrics(self, account: ConnectedAccount) -> AccountMetrics:
        """Fetch whole-account performance metrics from the official platform API."""
        ...
