from functools import lru_cache

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_env: str = "development"
    app_secret: str = "development-only-secret-change-me"
    database_url: str = "sqlite:///./postflow.db"
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
    mail_from: str = "postflow <noreply@postflow.ai>"
    frontend_url: str = "http://localhost:3000"
    linkedin_api_version: str = "202609"
    graph_api_version: str = "v23.0"
    threads_app_id: str | None = None
    threads_app_secret: str | None = None
    bluesky_private_key: str | None = None
    bluesky_key_id: str = "postflow-1"
    llm_mock_enabled: bool = False
    llm_max_output_tokens: int = 4096
    llm_cost_micros_per_token: int = 5
    x_monthly_spend_limit_micros: int = 10_000_000

    # Identity
    google_client_id: str | None = None

    # Channels OAuth
    x_client_id: str | None = None
    x_client_secret: str | None = None
    linkedin_client_id: str | None = None
    linkedin_client_secret: str | None = None
    linkedin_scopes: str = "openid,profile,email,w_member_social"
    reddit_client_id: str | None = None
    reddit_client_secret: str | None = None
    reddit_user_agent: str = "postflow:v0.1.0"
    bluesky_client_id: str | None = None
    facebook_app_id: str | None = None
    facebook_app_secret: str | None = None
    instagram_app_id: str | None = None
    instagram_app_secret: str | None = None
    facebook_redirect_uri: str | None = None
    instagram_redirect_uri: str | None = None

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
    def debug(self) -> bool:
        return self.app_env in {"development", "test"}

    @property
    def cors_origin_list(self) -> list[str]:
        return [item.strip() for item in self.cors_origins.split(",") if item.strip()]

    def oauth_callback_url(self, platform: str) -> str:
        platform = platform.lower()
        explicit_uri = {
            "facebook": self.facebook_redirect_uri,
            "instagram": self.instagram_redirect_uri,
        }.get(platform)
        if explicit_uri:
            # Registered provider URIs are exact values: do not normalize or format them.
            return explicit_uri
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
