from functools import lru_cache
from urllib.parse import urlsplit, urlunsplit

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_env: str = "development"
    app_secret: str = "development-only-secret-change-me"
    database_url: str = "sqlite:///./draftva.db"
    cors_origins: str = "http://localhost:3000"
    session_ttl_days: int = 30
    redis_url: str = "redis://localhost:6379/0"
    worker_poll_seconds: int = 5
    scheduler_poll_seconds: int = 10
    oauth_redirect_base_url: str = "http://localhost:18000/api/v1/channels/{platform}/callback"
    token_encryption_key: str | None = None
    token_encryption_previous_keys: str = ""
    smtp_host: str | None = None
    smtp_port: int = 587
    smtp_username: str | None = None
    smtp_password: str | None = None
    mail_from: str = "draftva <noreply@draftva.ai>"
    frontend_url: str = "http://localhost:3000"
    public_backend_url: str | None = None

    linkedin_api_version: str = "202609"
    graph_api_version: str = "v23.0"
    graph_insights_api_version: str = "v26.0"
    threads_app_id: str | None = None
    threads_app_secret: str | None = None
    threads_redirect_uri: str | None = None
    bluesky_private_key: str | None = None
    bluesky_key_id: str = "draftva-1"
    llm_mock_enabled: bool = False
    llm_max_output_tokens: int = 4096
    llm_cost_micros_per_token: int = 5
    x_monthly_spend_limit_micros: int = 10_000_000

    # Identity
    google_client_id: str | None = None
    # Login uses its own read-only OAuth app, separate from connected publishing accounts.
    x_login_client_id: str | None = None
    x_login_client_secret: str | None = None
    x_login_redirect_uri: str | None = None
    email_verification_required: bool = True
    auth_proxy_secret: str | None = None
    otp_ttl_seconds: int = Field(default=600, ge=60, le=1800)
    otp_resend_seconds: int = Field(default=60, ge=30, le=600)
    otp_max_attempts: int = Field(default=5, ge=1, le=10)
    resend_api_key: str | None = None
    resend_from_email: str | None = None

    # Channels OAuth
    x_client_id: str | None = None
    x_client_secret: str | None = None
    linkedin_client_id: str | None = None
    linkedin_client_secret: str | None = None
    linkedin_scopes: str = "openid,profile,email,w_member_social"
    reddit_client_id: str | None = None
    reddit_client_secret: str | None = None
    reddit_user_agent: str = "draftva:v0.1.0"
    bluesky_client_id: str | None = None
    facebook_app_id: str | None = None
    facebook_app_secret: str | None = None
    instagram_app_id: str | None = None
    instagram_app_secret: str | None = None
    facebook_redirect_uri: str | None = None
    instagram_redirect_uri: str | None = None
    bluesky_redirect_uri: str | None = None

    # Billing
    dodo_api_key: str | None = None
    dodo_webhook_secret: str | None = None
    dodo_api_base: str = "https://test.dodopayments.com"
    dodo_return_url: str = "http://localhost:3000/settings/billing"
    dodo_product_starter: str | None = None
    dodo_product_pro: str | None = None
    dodo_product_business: str | None = None
    dodo_product_creator: str | None = None
    dodo_product_agency: str | None = None
    billing_reconcile_interval_seconds: int = Field(default=3600, ge=60)
    billing_reconcile_batch_size: int = Field(default=200, ge=1, le=1000)
    billing_reconcile_max_requests: int = Field(default=20, ge=1, le=1000)
    billing_reconcile_time_budget_seconds: int = Field(default=30, ge=1, le=60)
    billing_reconcile_request_interval_seconds: float = Field(default=1, ge=0, le=60)
    billing_reconcile_http_timeout_seconds: int = Field(default=10, ge=1, le=30)
    billing_reconcile_retry_base_seconds: int = Field(default=60, ge=1)
    billing_reconcile_retry_max_seconds: int = Field(default=3600, ge=60)

    # AI Assistant
    llm_provider_url: str | None = None
    llm_provider_api_key: str | None = None
    llm_model: str = ""

    # Media & Storage
    r2_account_id: str | None = None
    r2_access_key_id: str | None = None
    r2_secret_access_key: str | None = None
    r2_bucket_name: str | None = None
    r2_endpoint: str | None = None
    r2_public_url: str | None = None
    media_max_bytes: int = 20 * 1024 * 1024
    video_max_bytes: int = 100 * 1024 * 1024
    media_url_ttl_seconds: int = 900
    clamav_host: str | None = "clamav"
    clamav_port: int = 3310
    rate_limit_enabled: bool = True
    billing_grace_days: int = 3

    @property
    def mcp_url(self) -> str:
        # Reuse the public backend origin already configured for social OAuth unless overridden.
        parts = urlsplit(self.public_backend_url or self.oauth_redirect_base_url)
        return urlunsplit((parts.scheme, parts.netloc, "/mcp", "", ""))

    @model_validator(mode="after")
    def agent_backend_url(self):
        parts = urlsplit(self.public_backend_url or self.oauth_redirect_base_url)
        if (
            parts.scheme not in {"http", "https"}
            or not parts.hostname
            or parts.username
            or parts.password
            or parts.query
            or parts.fragment
        ):
            raise ValueError(
                "PUBLIC_BACKEND_URL must be an HTTP(S) backend URL without credentials or query parameters"
            )
        return self

    @property
    def debug(self) -> bool:
        return self.app_env in {"development", "test"}

    @property
    def x_login_callback_url(self) -> str:
        return self.x_login_redirect_uri or self.frontend_url.rstrip("/") + "/api/auth/x/callback"

    @model_validator(mode="after")
    def login_callback_configuration(self):
        parts = urlsplit(self.x_login_callback_url)
        if (
            parts.scheme not in {"http", "https"}
            or not parts.hostname
            or parts.username
            or parts.password
            or parts.query
            or parts.fragment
            or (parts.scheme == "http" and parts.hostname not in {"localhost", "127.0.0.1", "::1"})
            or (self.app_env == "production" and parts.scheme != "https")
        ):
            raise ValueError(
                "X login callback must use HTTPS (HTTP localhost is allowed in development)"
            )
        return self

    @property
    def cors_origin_list(self) -> list[str]:
        return [item.strip() for item in self.cors_origins.split(",") if item.strip()]

    def oauth_callback_url(self, platform: str) -> str:
        platform = platform.lower()
        explicit_uri = {
            "facebook": self.facebook_redirect_uri,
            "instagram": self.instagram_redirect_uri,
            "threads": self.threads_redirect_uri,
            "bluesky": self.bluesky_redirect_uri,
        }.get(platform)
        if explicit_uri:
            # Registered provider URIs are exact values: do not normalize or format them.
            return explicit_uri
        if (
            platform == "bluesky"
            and self.bluesky_client_id
            and self.bluesky_client_id.startswith("http")
        ):
            parts = urlsplit(self.bluesky_client_id)
            return f"{parts.scheme}://{parts.netloc}/api/v1/channels/bluesky/callback"
        return self.oauth_redirect_base_url.replace(
            "/oauth/callback", "/{platform}/callback"
        ).format(platform=platform)

    @model_validator(mode="after")
    def production_configuration(self):
        if self.app_env == "production":
            if len(self.app_secret) < 32 or self.app_secret.startswith(
                ("development-", "replace-")
            ):
                raise ValueError("Production APP_SECRET must contain at least 32 random characters")
            if self.llm_mock_enabled:
                raise ValueError("Mock AI output cannot be enabled in production")
            if not self.email_verification_required:
                raise ValueError("Email verification cannot be disabled in production")
            if not self.rate_limit_enabled:
                raise ValueError("Rate limiting cannot be disabled in production")
            if urlsplit(self.frontend_url).scheme != "https":
                raise ValueError("Production FRONTEND_URL must use HTTPS for authentication links")
        return self

    def dodo_product_id(self, plan_code: str) -> str | None:
        mapping = {
            "starter": self.dodo_product_starter or self.dodo_product_creator,
            "creator": self.dodo_product_creator or self.dodo_product_starter,
            "pro": self.dodo_product_pro,
            "business": self.dodo_product_business or self.dodo_product_agency,
            "agency": self.dodo_product_agency or self.dodo_product_business,
        }
        val = mapping.get(plan_code)
        if not val and not self.dodo_api_key and self.debug:
            return f"pdt_mock_{plan_code}"
        return val


@lru_cache
def get_settings() -> Settings:
    return Settings()
