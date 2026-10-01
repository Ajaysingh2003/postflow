import logging
import urllib.parse
from datetime import UTC, datetime, timedelta
from typing import Any

import httpx
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.session import SessionLocal
from app.modules.channels.base import (
    AccountMetrics,
    AuthStart,
    Capabilities,
    Issue,
    Metrics,
    PublishResult,
    Target,
)
from app.modules.channels.models import ConnectedAccount, MastodonApp
from app.modules.channels.oauth import decrypt_token, encrypt_token

logger = logging.getLogger(__name__)

MASTODON_DEFAULT_SCOPES = "read write push"
DEFAULT_INSTANCE_CHAR_LIMIT = 500
DEFAULT_INSTANCE_MEDIA_LIMIT = 4


def normalize_domain(domain: str) -> str:
    """Normalize user input instance domain (e.g. 'https://mastodon.social/' -> 'mastodon.social')."""
    clean = domain.strip().lower()
    if clean.startswith("https://"):
        clean = clean[8:]
    elif clean.startswith("http://"):
        clean = clean[7:]
    return clean.rstrip("/").split("/")[0]


class MastodonAdapter:
    """
    Platform adapter for Mastodon.
    Registers an OAuth app dynamically on the user's specific instance,
    reads dynamic character limits and media limits from that instance's API,
    and supports content warnings (spoiler_text) and visibility levels.
    """

    platform = "mastodon"

    def __init__(
        self,
        client_name: str = "postflow",
        website: str = "https://postflow.ai",
        http_client: httpx.AsyncClient | None = None,
    ) -> None:
        settings = get_settings()
        self.client_name = client_name
        self.website = website
        self.redirect_base_url = settings.oauth_redirect_base_url
        self._http_client = http_client

        self.capabilities = Capabilities(
            platform=self.platform,
            display_name="Mastodon",
            max_text_length=500,  # Vanilla default, dynamically verified per instance
            text_length_type="characters",
            supports_media=True,
            supported_media_types=["image/jpeg", "image/png", "image/webp", "image/gif", "video/mp4"],
            max_media_count=4,  # Vanilla default, dynamically verified per instance
            supports_video=True,
            max_video_duration_seconds=300,
            supports_threads=True,
            supports_polls=True,
            supports_alt_text=True,
            max_alt_text_length=1500,
            supports_links=True,
            supports_tags=True,
            visibility_options=["public", "unlisted", "private"],
            requires_target=False,
            supports_account_metrics=True,
            supports_scheduling=True,
        )

    async def _get_client(self) -> httpx.AsyncClient:
        if self._http_client is not None:
            return self._http_client
        return httpx.AsyncClient(timeout=30.0)

    async def get_or_register_app(
        self,
        db: Session,
        instance_domain: str,
        redirect_uri: str,
    ) -> MastodonApp:
        """
        Retrieve stored credentials for an instance or dynamically register a new app on it.
        """
        clean_domain = normalize_domain(instance_domain)
        stmt = select(MastodonApp).where(MastodonApp.instance_domain == clean_domain)
        app_record = db.scalar(stmt)
        if app_record is not None:
            return app_record

        # Dynamically register application on the Mastodon instance
        client = await self._get_client()
        try:
            resp = await client.post(
                f"https://{clean_domain}/api/v1/apps",
                data={
                    "client_name": self.client_name,
                    "redirect_uris": redirect_uri,
                    "scopes": MASTODON_DEFAULT_SCOPES,
                    "website": self.website,
                },
            )
        finally:
            if self._http_client is None:
                await client.aclose()

        if resp.status_code not in {200, 201}:
            logger.error("Failed to register app on Mastodon instance '%s': %s", clean_domain, resp.text)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Could not register application on Mastodon instance '{clean_domain}': {resp.text}",
            )

        app_data = resp.json()
        client_id = app_data.get("client_id")
        client_secret = app_data.get("client_secret")

        new_app = MastodonApp(
            instance_domain=clean_domain,
            client_id=client_id,
            encrypted_client_secret=encrypt_token(client_secret),
            redirect_uri=redirect_uri,
            scopes=MASTODON_DEFAULT_SCOPES,
        )
        db.add(new_app)
        db.commit()
        db.refresh(new_app)
        return new_app

    async def fetch_instance_config(self, instance_domain: str) -> dict[str, Any]:
        """
        Read character limit and media limits from the instance's own API.
        Checks /api/v2/instance with fallback to /api/v1/instance.
        """
        clean_domain = normalize_domain(instance_domain)
        client = await self._get_client()
        max_chars = DEFAULT_INSTANCE_CHAR_LIMIT
        max_media = DEFAULT_INSTANCE_MEDIA_LIMIT

        try:
            # Try v2 first
            resp = await client.get(f"https://{clean_domain}/api/v2/instance")
            if resp.status_code == 200:
                data = resp.json()
                statuses_cfg = data.get("configuration", {}).get("statuses", {})
                max_chars = statuses_cfg.get("max_characters", DEFAULT_INSTANCE_CHAR_LIMIT)
                max_media = statuses_cfg.get("max_media_attachments", DEFAULT_INSTANCE_MEDIA_LIMIT)
                return {
                    "max_characters": max_chars,
                    "max_media_attachments": max_media,
                    "title": data.get("title", clean_domain),
                    "version": data.get("version"),
                }

            # Fallback to v1
            resp_v1 = await client.get(f"https://{clean_domain}/api/v1/instance")
            if resp_v1.status_code == 200:
                data_v1 = resp_v1.json()
                max_chars = data_v1.get("max_toot_chars", DEFAULT_INSTANCE_CHAR_LIMIT)
                return {
                    "max_characters": max_chars,
                    "max_media_attachments": max_media,
                    "title": data_v1.get("title", clean_domain),
                    "version": data_v1.get("version"),
                }
        except Exception as exc:  # noqa: BLE001
            logger.warning("Could not fetch instance config for '%s': %s", clean_domain, exc)
        finally:
            if self._http_client is None:
                await client.aclose()

        return {
            "max_characters": max_chars,
            "max_media_attachments": max_media,
            "title": clean_domain,
        }

    async def build_auth_url(self, workspace_id: str, state: str, **opts: Any) -> AuthStart:
        """
        Build OAuth authorization URL for the user's specific Mastodon instance.
        User supplies instance_domain in opts or payload.
        """
        raw_domain = opts.get("instance_domain")
        if not raw_domain:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Mastodon connection requires 'instance_domain' (e.g. mastodon.social)",
            )

        clean_domain = normalize_domain(raw_domain)
        redirect_uri = opts.get("redirect_uri") or self.redirect_base_url

        # Obtain DB session to look up or register the app on that instance
        db: Session = opts.get("db") or SessionLocal()
        own_session = opts.get("db") is None
        try:
            app = await self.get_or_register_app(db, clean_domain, redirect_uri)
        finally:
            if own_session:
                db.close()

        params = {
            "client_id": app.client_id,
            "response_type": "code",
            "redirect_uri": redirect_uri,
            "scope": app.scopes,
            "state": state,
        }
        auth_url = f"https://{clean_domain}/oauth/authorize?{urllib.parse.urlencode(params)}"
        return AuthStart(
            auth_url=auth_url,
            state=state,
            code_verifier=None,
            metadata={"instance_domain": clean_domain, "redirect_uri": redirect_uri},
        )

    async def handle_callback(
        self,
        workspace_id: str,
        params: dict[str, Any],
        state: str,
        **opts: Any,
    ) -> ConnectedAccount:
        """
        Exchange code for access token on the user's Mastodon instance and verify credentials.
        """
        code = params.get("code")
        if not code:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Missing authorization code from Mastodon callback",
            )

        clean_domain = normalize_domain(
            opts.get("instance_domain") or params.get("instance_domain", "")
        )
        if not clean_domain:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Missing instance_domain for Mastodon token exchange",
            )

        redirect_uri = opts.get("redirect_uri") or self.redirect_base_url

        db: Session = opts.get("db") or SessionLocal()
        own_session = opts.get("db") is None
        try:
            app = db.scalar(select(MastodonApp).where(MastodonApp.instance_domain == clean_domain))
            if not app:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"No registered app found for Mastodon instance '{clean_domain}'",
                )
            client_secret = decrypt_token(app.encrypted_client_secret)
            client_id = app.client_id
            scopes = app.scopes
        finally:
            if own_session:
                db.close()

        client = await self._get_client()
        try:
            token_resp = await client.post(
                f"https://{clean_domain}/oauth/token",
                data={
                    "client_id": client_id,
                    "client_secret": client_secret,
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": redirect_uri,
                    "scope": scopes,
                },
            )
        finally:
            if self._http_client is None:
                await client.aclose()

        if token_resp.status_code != 200:
            logger.error("Mastodon token exchange failed on '%s': %s", clean_domain, token_resp.text)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Mastodon token exchange failed: {token_resp.text}",
            )

        token_data = token_resp.json()
        access_token = token_data.get("access_token")

        # Fetch authenticated user profile & instance limits
        user_info = await self._verify_credentials(clean_domain, access_token)
        instance_cfg = await self.fetch_instance_config(clean_domain)

        username = user_info.get("username", "")
        display_name = user_info.get("display_name") or username
        acct = user_info.get("acct") or f"{username}@{clean_domain}"
        user_id = str(user_info.get("id"))

        return ConnectedAccount(
            workspace_id=workspace_id,
            platform=self.platform,
            external_account_id=f"{user_id}@{clean_domain}",
            display_name=f"{display_name} (@{acct})",
            account_type="profile",
            encrypted_access_token=encrypt_token(access_token),
            encrypted_refresh_token=None,  # Mastodon standard bearer tokens are long-lived
            token_expires_at=datetime.now(UTC) + timedelta(days=365),
            granted_scopes=scopes.split(" "),
            status="active",
            account_metadata={
                "instance_domain": clean_domain,
                "username": username,
                "user_id": user_id,
                "acct": acct,
                "avatar": user_info.get("avatar"),
                "instance_config": instance_cfg,
            },
        )

    async def _verify_credentials(self, clean_domain: str, access_token: str) -> dict[str, Any]:
        client = await self._get_client()
        try:
            resp = await client.get(
                f"https://{clean_domain}/api/v1/accounts/verify_credentials",
                headers={"Authorization": f"Bearer {access_token}"},
            )
        finally:
            if self._http_client is None:
                await client.aclose()

        if resp.status_code != 200:
            logger.error("Failed to verify credentials on '%s': %s", clean_domain, resp.text)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Failed to verify Mastodon credentials: {resp.text}",
            )
        return resp.json()

    async def refresh_tokens(self, account: ConnectedAccount) -> ConnectedAccount:
        """
        Refresh instance configuration limits and verify credentials.
        """
        domain = account.account_metadata.get("instance_domain")
        if not domain:
            return account

        raw_access = decrypt_token(account.encrypted_access_token)
        if raw_access:
            await self._verify_credentials(domain, raw_access)

        # Refresh instance config (character limit, media limit)
        cfg = await self.fetch_instance_config(domain)
        metadata = dict(account.account_metadata)
        metadata["instance_config"] = cfg
        account.account_metadata = metadata
        account.status = "active"
        return account

    async def revoke(self, account: ConnectedAccount) -> None:
        """
        Revoke token with the Mastodon instance via /oauth/revoke.
        """
        domain = account.account_metadata.get("instance_domain")
        raw_access = decrypt_token(account.encrypted_access_token)
        if not domain or not raw_access:
            return

        db = SessionLocal()
        try:
            app = db.scalar(select(MastodonApp).where(MastodonApp.instance_domain == domain))
            if not app:
                return
            client_id = app.client_id
            client_secret = decrypt_token(app.encrypted_client_secret)
        finally:
            db.close()

        client = await self._get_client()
        try:
            await client.post(
                f"https://{domain}/oauth/revoke",
                data={
                    "client_id": client_id,
                    "client_secret": client_secret,
                    "token": raw_access,
                },
            )
        except Exception as exc:  # noqa: BLE001
            logger.warning("Error revoking Mastodon token on '%s': %s", domain, exc)
        finally:
            if self._http_client is None:
                await client.aclose()

    async def list_targets(self, account: ConnectedAccount) -> list[Target]:
        """Mastodon publishes to the authenticated user's home timeline."""
        return []

    async def validate(self, variant: Any) -> list[Issue]:
        """
        Validate post text and media against the instance's dynamic limits.
        """
        issues: list[Issue] = []
        payload = getattr(variant, "payload", {})
        if not isinstance(payload, dict):
            return [Issue(field="payload", message="Invalid variant payload format", severity="error")]

        text = payload.get("text", "")
        if not text and not payload.get("media_ids"):
            issues.append(Issue(field="text", message="Mastodon post cannot be empty", severity="error"))

        # Read dynamic limit from instance_config if stored on variant/payload
        instance_cfg = payload.get("instance_config", {})
        max_chars = instance_cfg.get("max_characters", self.capabilities.max_text_length)
        max_media = instance_cfg.get("max_media_attachments", self.capabilities.max_media_count)

        if len(text) > max_chars:
            issues.append(
                Issue(
                    field="text",
                    message=f"Post length ({len(text)} chars) exceeds instance maximum of {max_chars} characters",
                    severity="error",
                    code="instance_char_limit_exceeded",
                )
            )

        media_ids = payload.get("media_ids", [])
        if len(media_ids) > max_media:
            issues.append(
                Issue(
                    field="media_ids",
                    message=f"Maximum {max_media} media attachments allowed on this instance",
                    severity="error",
                    code="too_many_media",
                )
            )

        return issues

    async def publish(self, account: ConnectedAccount, variant: Any) -> PublishResult:
        """
        Publish status toot via POST https://{instance}/api/v1/statuses.
        Supports spoiler_text (content warning) and visibility.
        """
        raw_access = decrypt_token(account.encrypted_access_token)
        domain = account.account_metadata.get("instance_domain")
        if not raw_access or not domain:
            return PublishResult(
                success=False,
                error_message="Missing credentials or instance domain for Mastodon",
                is_retryable=False,
            )

        payload = getattr(variant, "payload", {})
        text = payload.get("text", "")
        visibility = payload.get("visibility", "public")
        spoiler_text = payload.get("spoiler_text")
        media_ids = payload.get("media_ids")
        in_reply_to_id = payload.get("in_reply_to_id")
        idempotency_key = getattr(variant, "idempotency_key", None)

        data: dict[str, Any] = {
            "status": text,
            "visibility": visibility,
        }
        if spoiler_text:
            data["spoiler_text"] = spoiler_text
        if media_ids:
            data["media_ids[]"] = [str(m) for m in media_ids]
        if in_reply_to_id:
            data["in_reply_to_id"] = str(in_reply_to_id)

        headers = {
            "Authorization": f"Bearer {raw_access}",
        }
        if idempotency_key:
            headers["Idempotency-Key"] = str(idempotency_key)

        client = await self._get_client()
        try:
            resp = await client.post(
                f"https://{domain}/api/v1/statuses",
                data=data,
                headers=headers,
            )
        except Exception as exc:  # noqa: BLE001
            logger.error("Network error publishing to Mastodon '%s': %s", domain, exc)
            return PublishResult(
                success=False,
                error_message=f"Network error: {exc}",
                is_retryable=True,
            )
        finally:
            if self._http_client is None:
                await client.aclose()

        if resp.status_code in {200, 201}:
            res_json = resp.json()
            status_id = str(res_json.get("id"))
            status_url = res_json.get("url") or f"https://{domain}/@{account.account_metadata.get('username')}/{status_id}"
            return PublishResult(
                success=True,
                external_post_id=status_id,
                external_url=status_url,
                raw_response=res_json,
            )

        is_retryable = resp.status_code in {429, 500, 502, 503, 504}
        error_msg = f"Mastodon API error (HTTP {resp.status_code}): {resp.text}"
        logger.warning("Mastodon publish failed on '%s': %s", domain, error_msg)

        return PublishResult(
            success=False,
            error_message=error_msg,
            raw_response={"status_code": resp.status_code, "body": resp.text},
            is_retryable=is_retryable,
        )

    async def delete_post(self, account: ConnectedAccount, external_post_id: str) -> None:
        """
        Delete status toot via DELETE https://{instance}/api/v1/statuses/{id}.
        """
        domain = account.account_metadata.get("instance_domain")
        raw_access = decrypt_token(account.encrypted_access_token)
        if not domain or not raw_access:
            raise ValueError("Missing domain or access token")

        client = await self._get_client()
        try:
            resp = await client.delete(
                f"https://{domain}/api/v1/statuses/{external_post_id}",
                headers={"Authorization": f"Bearer {raw_access}"},
            )
        finally:
            if self._http_client is None:
                await client.aclose()

        if resp.status_code not in {200, 204, 404}:
            logger.warning("Failed to delete Mastodon status %s on %s: %s", external_post_id, domain, resp.text)
            raise RuntimeError(f"Failed to delete Mastodon status (HTTP {resp.status_code}): {resp.text}")

    async def fetch_metrics(self, account: ConnectedAccount, external_post_id: str) -> Metrics:
        """
        Fetch status metrics (favourites, reblogs, replies).
        """
        domain = account.account_metadata.get("instance_domain")
        raw_access = decrypt_token(account.encrypted_access_token)
        if not domain or not raw_access:
            raise ValueError("Missing domain or access token")

        client = await self._get_client()
        try:
            resp = await client.get(
                f"https://{domain}/api/v1/statuses/{external_post_id}",
                headers={"Authorization": f"Bearer {raw_access}"},
            )
        finally:
            if self._http_client is None:
                await client.aclose()

        if resp.status_code != 200:
            logger.warning("Failed to fetch Mastodon metrics for %s on %s: %s", external_post_id, domain, resp.text)
            return Metrics()

        data = resp.json()
        favs = data.get("favourites_count", 0)
        reblogs = data.get("reblogs_count", 0)
        replies = data.get("replies_count", 0)

        total_engagements = favs + reblogs + replies

        return Metrics(
            impressions=total_engagements,
            reach=total_engagements,
            engagements=total_engagements,
            likes=favs,
            comments=replies,
            shares_reposts=reblogs,
            extras={"visibility": data.get("visibility"), "replies_count": replies},
        )

    async def fetch_account_metrics(self, account: ConnectedAccount) -> AccountMetrics:
        """
        Fetch whole-account follower and status counts from original Mastodon instance.
        """
        domain = account.account_metadata.get("instance_domain")
        raw_access = decrypt_token(account.encrypted_access_token)
        if not domain or not raw_access:
            raise ValueError("Missing domain or access token")

        client = await self._get_client()
        try:
            resp = await client.get(
                f"https://{domain}/api/v1/accounts/verify_credentials",
                headers={"Authorization": f"Bearer {raw_access}"},
            )
        finally:
            if self._http_client is None:
                await client.aclose()

        if resp.status_code != 200:
            logger.warning("Failed to fetch Mastodon account metrics on %s: %s", domain, resp.text)
            return AccountMetrics()

        data = resp.json()
        followers = data.get("followers_count", 0)
        following = data.get("following_count", 0)
        statuses = data.get("statuses_count", 0)

        return AccountMetrics(
            followers_count=followers,
            following_count=following,
            posts_count=statuses,
            extras={"instance_domain": domain, "acct": data.get("acct")},
        )
