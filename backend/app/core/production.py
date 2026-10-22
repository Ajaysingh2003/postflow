"""Offline production preflight; reports names and problems, never secret values."""

import argparse
import base64
import ipaddress
import os
from collections.abc import Mapping
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import urlsplit

from cryptography.fernet import Fernet
from dotenv import dotenv_values
from pydantic import ValidationError
from sqlalchemy.engine import make_url
from sqlalchemy.exc import ArgumentError

from app.core.config import Settings


class PreflightSettings(Settings):
    @classmethod
    def settings_customise_sources(
        cls, settings_cls, init_settings, env_settings, dotenv_settings, file_secret_settings
    ):
        return (init_settings,)


@dataclass(frozen=True)
class Finding:
    code: str
    message: str
    warning: bool = False


def _configured(value: str | None) -> bool:
    return bool(
        value and not value.lower().startswith(("replace", "change-me", "your-", "example"))
    )


def _https(value: str | None) -> bool:
    try:
        parsed = urlsplit(value or "")
        return (
            parsed.scheme == "https"
            and bool(parsed.hostname)
            and not (parsed.username or parsed.password)
        )
    except ValueError:
        return False


def audit(settings: Settings, deployment: Mapping[str, str | None]) -> list[Finding]:
    findings = []

    def require(condition, code, message):
        if not condition:
            findings.append(Finding(code, message))

    def configured(field):
        require(_configured(getattr(settings, field)), field.upper(), f"Configure {field.upper()}")

    require(settings.app_env == "production", "APP_ENV", "APP_ENV must be production")
    require(not settings.debug, "DEBUG", "Development mode must be disabled")
    require(
        settings.email_verification_required,
        "EMAIL_VERIFICATION_REQUIRED",
        "Require email verification",
    )
    require(settings.rate_limit_enabled, "RATE_LIMIT_ENABLED", "Enable shared request limits")
    require(not settings.llm_mock_enabled, "LLM_MOCK_ENABLED", "Disable mock AI output")
    require(
        _configured(settings.app_secret) and len(settings.app_secret) >= 32,
        "APP_SECRET",
        "Use a random APP_SECRET of at least 32 characters",
    )
    require(
        _configured(settings.auth_proxy_secret) and len(settings.auth_proxy_secret or "") >= 32,
        "AUTH_PROXY_SECRET",
        "Use the same random AUTH_PROXY_SECRET (32+ characters) on backend and frontend",
    )
    try:
        Fernet((settings.token_encryption_key or "").encode())
    except (ValueError, TypeError):
        findings.append(
            Finding(
                "TOKEN_ENCRYPTION_KEY",
                "Set a dedicated valid Fernet TOKEN_ENCRYPTION_KEY; retain it across deployments",
            )
        )

    try:
        database = make_url(settings.database_url)
    except ArgumentError:
        findings.append(Finding("DATABASE_URL", "Use a valid PostgreSQL DATABASE_URL"))
        database = None
    require(
        database is not None
        and database.get_backend_name() == "postgresql"
        and database.database == "draftva",
        "DATABASE_URL",
        "Use PostgreSQL with database name draftva",
    )
    password = deployment.get("POSTGRES_PASSWORD") or ""
    require(
        _configured(password)
        and len(password) >= 32
        and all(c.isalnum() or c in "_-." for c in password),
        "POSTGRES_PASSWORD",
        "Use a random URL-safe POSTGRES_PASSWORD of at least 32 characters",
    )
    require(
        database is not None and database.password == password,
        "DATABASE_PASSWORD",
        "DATABASE_URL must match POSTGRES_PASSWORD",
    )
    require(
        settings.redis_url == "redis://redis:6379/0",
        "REDIS_URL",
        "This VM stack uses REDIS_URL=redis://redis:6379/0",
    )
    require(
        settings.frontend_url.rstrip("/") == "https://draftva.com",
        "FRONTEND_URL",
        "Set FRONTEND_URL=https://draftva.com",
    )
    require(
        (settings.public_backend_url or "").rstrip("/") == "https://api.draftva.com",
        "PUBLIC_BACKEND_URL",
        "Set PUBLIC_BACKEND_URL=https://api.draftva.com",
    )
    require(
        deployment.get("NGINX_CONFIG", "https") == "https",
        "NGINX_CONFIG",
        "Use NGINX_CONFIG=https after certificate bootstrap",
    )
    origins = settings.cors_origin_list
    require(
        bool(origins)
        and "https://draftva.com" in origins
        and set(origins) <= {"https://draftva.com", "https://www.draftva.com"},
        "CORS_ORIGINS",
        "Use exact HTTPS Draftva frontend origins in CORS_ORIGINS",
    )
    require(
        settings.dodo_return_url.startswith("https://draftva.com/")
        and not urlsplit(settings.dodo_return_url).fragment,
        "DODO_RETURN_URL",
        "Set a working HTTPS Draftva billing return URL",
    )
    require(
        settings.dodo_api_base.rstrip("/") == "https://live.dodopayments.com",
        "DODO_API_BASE",
        "Production billing must use https://live.dodopayments.com",
    )
    configured("dodo_api_key")
    for plan in ("starter", "pro", "business"):
        value = settings.dodo_product_id(plan)
        require(
            _configured(value) and not (value or "").startswith("pdt_mock"),
            f"DODO_PRODUCT_{plan.upper()}",
            f"Configure the live Dodo product ID for {plan}",
        )
    try:
        secret = settings.dodo_webhook_secret or ""
        valid_secret = (
            secret.startswith("whsec_") and len(base64.b64decode(secret[6:], validate=True)) >= 16
        )
    except ValueError:
        valid_secret = False
    require(valid_secret, "DODO_WEBHOOK_SECRET", "Configure the live Dodo webhook signing secret")

    if settings.resend_api_key:
        configured("resend_api_key")
    else:
        configured("smtp_host")
        configured("smtp_username")
        configured("smtp_password")
    sender = settings.resend_from_email if settings.resend_api_key else settings.mail_from
    require(
        bool(sender and "@draftva.com" in sender),
        "MAIL_FROM",
        "Configure a verified Draftva sender address for transactional email",
    )
    for field in (
        "llm_provider_url",
        "llm_provider_api_key",
        "llm_model",
        "r2_access_key_id",
        "r2_secret_access_key",
        "r2_bucket_name",
        "r2_public_url",
        "clamav_host",
    ):
        configured(field)
    for field in ("llm_provider_url", "r2_public_url"):
        require(
            _https(getattr(settings, field)),
            field.upper(),
            f"{field.upper()} must use HTTPS",
        )
    require(
        bool(settings.r2_account_id or settings.r2_endpoint),
        "R2_ENDPOINT",
        "Configure R2_ACCOUNT_ID or an HTTPS R2_ENDPOINT",
    )
    if settings.r2_endpoint:
        require(
            _https(settings.r2_endpoint),
            "R2_ENDPOINT",
            "R2_ENDPOINT must use HTTPS",
        )

    try:
        network = ipaddress.ip_network(deployment.get("PROXY_NETWORK_SUBNET") or "172.29.250.0/28")
        proxy = ipaddress.ip_address(deployment.get("NGINX_PROXY_IP") or "172.29.250.2")
        dynamic_range = ipaddress.ip_network(
            deployment.get("PROXY_NETWORK_DYNAMIC_RANGE") or "172.29.250.8/29"
        )
        require(
            dynamic_range.version == 4
            and network.version == 4
            and dynamic_range.subnet_of(network)
            and proxy not in dynamic_range,
            "PROXY_NETWORK_DYNAMIC_RANGE",
            "Keep the dynamic proxy-network address range inside the subnet and away from NGINX_PROXY_IP",
        )
        require(
            network.is_private
            and network.version == 4
            and proxy in network
            and proxy
            not in {
                network.network_address,
                network.broadcast_address,
                network.network_address + 1,
            },
            "NGINX_PROXY_IP",
            "Reserve a private IPv4 proxy address in PROXY_NETWORK_SUBNET, excluding gateway/network/broadcast",
        )
        require(
            deployment.get("FORWARDED_ALLOW_IPS", str(proxy)) == str(proxy),
            "FORWARDED_ALLOW_IPS",
            "Trust only NGINX_PROXY_IP for forwarded client headers",
        )
    except ValueError:
        findings.append(
            Finding("PROXY_NETWORK_SUBNET", "Configure a valid private proxy subnet and proxy IP")
        )

    pairs = (
        ("x", "x_client_id", "x_client_secret"),
        ("linkedin", "linkedin_client_id", "linkedin_client_secret"),
        ("reddit", "reddit_client_id", "reddit_client_secret"),
        ("facebook", "facebook_app_id", "facebook_app_secret"),
        ("instagram", "instagram_app_id", "instagram_app_secret"),
        ("threads", "threads_app_id", "threads_app_secret"),
    )
    for platform, id_field, secret_field in pairs:
        client_id, client_secret = getattr(settings, id_field), getattr(settings, secret_field)
        if not client_id and not client_secret:
            findings.append(
                Finding(
                    f"CHANNEL_{platform.upper()}",
                    f"{platform} credentials are absent; do not advertise this connection as ready",
                    warning=True,
                )
            )
            continue
        require(
            _configured(client_id) and _configured(client_secret),
            f"CHANNEL_{platform.upper()}",
            f"Complete both {platform} OAuth credentials",
        )
        try:
            callback = settings.oauth_callback_url(platform)
            require(
                callback == f"https://api.draftva.com/api/v1/channels/{platform}/callback",
                f"CALLBACK_{platform.upper()}",
                f"Register the api.draftva.com HTTPS publishing callback for {platform}",
            )
        except (KeyError, ValueError):
            findings.append(
                Finding("OAUTH_REDIRECT_BASE_URL", "Configure a valid platform callback template")
            )
    if settings.x_login_client_id or settings.x_login_client_secret:
        require(
            bool(settings.x_login_client_id and settings.x_login_client_secret),
            "X_LOGIN",
            "Complete the X login credential pair",
        )
        require(
            settings.x_login_callback_url == "https://draftva.com/api/auth/x/callback",
            "X_LOGIN_REDIRECT_URI",
            "X login must return to the frontend HTTPS callback",
        )
        if settings.x_login_client_id == settings.x_client_id:
            require(
                settings.x_login_client_secret == settings.x_client_secret,
                "X_CLIENT_SECRET",
                "The same X client ID must use the same client secret for login and publishing",
            )
    if settings.bluesky_client_id:
        require(
            settings.bluesky_client_id
            == "https://api.draftva.com/api/v1/channels/bluesky/client-metadata"
            and bool(settings.bluesky_private_key),
            "BLUESKY_CLIENT_ID",
            "Configure the public Bluesky metadata URL and durable signing key",
        )
    if not settings.google_client_id:
        findings.append(
            Finding("GOOGLE_CLIENT_ID", "Google sign-in is not configured", warning=True)
        )
    findings.append(
        Finding(
            "LIVE_CHECKS",
            "Offline checks cannot verify DNS/TLS, provider approval, inbox delivery, R2 CORS, backups or a real checkout; complete the launch runbook",
            warning=True,
        )
    )
    return findings


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--env-file", type=Path)
    args = parser.parse_args()
    if args.env_file and not args.env_file.is_file():
        print("FAIL ENV_FILE: environment file does not exist")
        return 1
    deployment = dict(dotenv_values(args.env_file)) if args.env_file else dict(os.environ)
    try:
        # Explicit files are checked in isolation; container mode uses only injected env.
        settings = PreflightSettings(
            _env_file=None,
            **{key.lower(): value for key, value in deployment.items() if value is not None},
        )
    except (ValidationError, ValueError):
        # Pydantic error strings can contain complete input dictionaries with secrets.
        print(
            "FAIL SETTINGS: invalid production settings; check secret strength, HTTPS URLs and disabled development options"
        )
        return 1
    findings = audit(settings, deployment)
    for item in findings:
        print(f"{'WARN' if item.warning else 'FAIL'} {item.code}: {item.message}")
    if any(not item.warning for item in findings):
        return 1
    print("PASS: offline production configuration checks")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
