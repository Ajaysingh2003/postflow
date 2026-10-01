import logging
import urllib.parse
from datetime import UTC, datetime, timedelta
from typing import Any

import httpx
from fastapi import HTTPException, status

from app.core.config import get_settings
from app.modules.channels.base import (
    AccountMetrics,
    AuthStart,
    Capabilities,
    Issue,
    Metrics,
    PublishResult,
    Target,
)
from app.modules.channels.models import ConnectedAccount
from app.modules.channels.oauth import decrypt_token, encrypt_token

logger = logging.getLogger(__name__)

GRAPH_API_VERSION = "v21.0"
GRAPH_API_BASE = f"https://graph.facebook.com/{GRAPH_API_VERSION}"
FACEBOOK_OAUTH_DIALOG = f"https://www.facebook.com/{GRAPH_API_VERSION}/dialog/oauth"

# Official permissions needed to manage, publish, and fetch analytics for Facebook Pages
FACEBOOK_SCOPES = [
    "pages_show_list",
    "pages_read_engagement",
    "pages_manage_posts",
    "pages_read_user_content",
    "read_insights",
]


class FacebookAdapter:
    """
    Platform adapter for Facebook.
    Per spec: Publishing is to Pages only, not personal profiles.
    Handles Page selection after login (via list_targets) and long-lived Page tokens.
    """

    platform = "facebook"

    def __init__(
        self,
        app_id: str | None = None,
        app_secret: str | None = None,
        http_client: httpx.AsyncClient | None = None,
    ) -> None:
        settings = get_settings()
        self.app_id = app_id or settings.facebook_app_id or "facebook_app_id_placeholder"
        self.app_secret = app_secret or settings.facebook_app_secret or "facebook_app_secret_placeholder"
        self.redirect_base_url = settings.oauth_redirect_base_url
        self._http_client = http_client

        self.capabilities = Capabilities(
            platform=self.platform,
            display_name="Facebook Pages",
            max_text_length=63206,
            text_length_type="characters",
            supports_media=True,
            supported_media_types=["image/jpeg", "image/png", "image/webp", "image/gif", "video/mp4"],
            max_media_count=10,
            supports_video=True,
            max_video_duration_seconds=14400,
            supports_threads=False,
            supports_polls=False,
            supports_alt_text=True,
            max_alt_text_length=1000,
            supports_links=True,
            supports_tags=False,
            visibility_options=["public"],
            requires_target=True,  # Page selection is mandatory
            target_type_name="page",
            supports_account_metrics=True,
            supports_scheduling=True,
        )

    async def _get_client(self) -> httpx.AsyncClient:
        if self._http_client is not None:
            return self._http_client
        return httpx.AsyncClient(timeout=30.0)

    async def build_auth_url(self, workspace_id: str, state: str, **opts: Any) -> AuthStart:
        """
        Build Facebook OAuth authorization dialog URL requesting Pages permissions.
        """
        redirect_uri = opts.get("redirect_uri") or self.redirect_base_url
        scopes = opts.get("scopes") or FACEBOOK_SCOPES

        params = {
            "client_id": self.app_id,
            "redirect_uri": redirect_uri,
            "state": state,
            "response_type": "code",
            "scope": ",".join(scopes),
        }
        auth_url = f"{FACEBOOK_OAUTH_DIALOG}?{urllib.parse.urlencode(params)}"
        return AuthStart(
            auth_url=auth_url,
            state=state,
            code_verifier=None,
            metadata={"redirect_uri": redirect_uri},
        )

    async def handle_callback(
        self,
        workspace_id: str,
        params: dict[str, Any],
        state: str,
        **opts: Any,
    ) -> ConnectedAccount:
        """
        Exchange code for short-lived user token, upgrade to 60-day long-lived user token,
        and retrieve long-lived Page tokens for all managed Pages via /me/accounts.
        """
        code = params.get("code")
        if not code:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Missing authorization code from Facebook callback",
            )

        redirect_uri = opts.get("redirect_uri") or self.redirect_base_url

        client = await self._get_client()
        try:
            # Step 1: Exchange code for short-lived user token
            token_resp = await client.get(
                f"{GRAPH_API_BASE}/oauth/access_token",
                params={
                    "client_id": self.app_id,
                    "client_secret": self.app_secret,
                    "redirect_uri": redirect_uri,
                    "code": code,
                },
            )
            if token_resp.status_code != 200:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Facebook token exchange failed: {token_resp.text}",
                )

            short_token = token_resp.json().get("access_token")

            # Step 2: Exchange for long-lived user token (~60 days)
            long_resp = await client.get(
                f"{GRAPH_API_BASE}/oauth/access_token",
                params={
                    "grant_type": "fb_exchange_token",
                    "client_id": self.app_id,
                    "client_secret": self.app_secret,
                    "fb_exchange_token": short_token,
                },
            )
            if long_resp.status_code == 200:
                long_data = long_resp.json()
                user_access_token = long_data.get("access_token", short_token)
                expires_in = long_data.get("expires_in", 5184000)
            else:
                user_access_token = short_token
                expires_in = 7200

            # Step 3: Fetch user profile
            me_resp = await client.get(
                f"{GRAPH_API_BASE}/me",
                params={"fields": "id,name,picture", "access_token": user_access_token},
            )
            user_data = me_resp.json() if me_resp.status_code == 200 else {}
            fb_user_id = str(user_data.get("id", ""))
            fb_user_name = user_data.get("name", "Facebook User")

            # Step 4: Fetch managed Pages with long-lived Page tokens
            pages_resp = await client.get(
                f"{GRAPH_API_BASE}/me/accounts",
                params={
                    "fields": "id,name,access_token,category,tasks,fan_count",
                    "access_token": user_access_token,
                },
            )
            pages_data = pages_resp.json().get("data", []) if pages_resp.status_code == 200 else []

            # Store encrypted long-lived Page Access Tokens mapped by Page ID
            page_tokens: dict[str, str] = {}
            page_summaries: list[dict[str, Any]] = []
            for p in pages_data:
                pid = str(p.get("id"))
                ptok = p.get("access_token")
                if pid and ptok:
                    page_tokens[pid] = encrypt_token(ptok) or ""
                    page_summaries.append(
                        {
                            "id": pid,
                            "name": p.get("name"),
                            "category": p.get("category"),
                            "fan_count": p.get("fan_count", 0),
                        }
                    )

        finally:
            if self._http_client is None:
                await client.aclose()

        return ConnectedAccount(
            workspace_id=workspace_id,
            platform=self.platform,
            external_account_id=f"fb_user_{fb_user_id}",
            display_name=f"{fb_user_name} (Facebook Pages)",
            account_type="business",
            encrypted_access_token=encrypt_token(user_access_token),
            token_expires_at=datetime.now(UTC) + timedelta(seconds=expires_in),
            granted_scopes=FACEBOOK_SCOPES,
            status="active",
            account_metadata={
                "fb_user_id": fb_user_id,
                "fb_user_name": fb_user_name,
                "page_tokens": page_tokens,
                "pages": page_summaries,
            },
        )

    async def refresh_tokens(self, account: ConnectedAccount) -> ConnectedAccount:
        """
        Refresh user token and refresh Page tokens via /me/accounts.
        """
        raw_user_token = decrypt_token(account.encrypted_access_token)
        if not raw_user_token:
            raise ValueError("Missing decrypted Facebook access token")

        client = await self._get_client()
        try:
            # Upgrade / refresh long-lived token
            resp = await client.get(
                f"{GRAPH_API_BASE}/oauth/access_token",
                params={
                    "grant_type": "fb_exchange_token",
                    "client_id": self.app_id,
                    "client_secret": self.app_secret,
                    "fb_exchange_token": raw_user_token,
                },
            )
            if resp.status_code == 200:
                data = resp.json()
                new_user_token = data.get("access_token", raw_user_token)
                expires_in = data.get("expires_in", 5184000)
            else:
                new_user_token = raw_user_token
                expires_in = 5184000

            # Re-fetch Page tokens
            pages_resp = await client.get(
                f"{GRAPH_API_BASE}/me/accounts",
                params={
                    "fields": "id,name,access_token,category,tasks,fan_count",
                    "access_token": new_user_token,
                },
            )
            pages_data = pages_resp.json().get("data", []) if pages_resp.status_code == 200 else []

            page_tokens: dict[str, str] = {}
            page_summaries: list[dict[str, Any]] = []
            for p in pages_data:
                pid = str(p.get("id"))
                ptok = p.get("access_token")
                if pid and ptok:
                    page_tokens[pid] = encrypt_token(ptok) or ""
                    page_summaries.append(
                        {
                            "id": pid,
                            "name": p.get("name"),
                            "category": p.get("category"),
                            "fan_count": p.get("fan_count", 0),
                        }
                    )

            meta = dict(account.account_metadata)
            meta["page_tokens"] = page_tokens
            meta["pages"] = page_summaries

            account.encrypted_access_token = encrypt_token(new_user_token)
            account.token_expires_at = datetime.now(UTC) + timedelta(seconds=expires_in)
            account.account_metadata = meta
            account.status = "active"
            return account

        finally:
            if self._http_client is None:
                await client.aclose()

    async def revoke(self, account: ConnectedAccount) -> None:
        """
        Revoke permissions with Meta via DELETE /me/permissions.
        """
        raw_user_token = decrypt_token(account.encrypted_access_token)
        if not raw_user_token:
            return

        client = await self._get_client()
        try:
            await client.delete(
                f"{GRAPH_API_BASE}/me/permissions",
                params={"access_token": raw_user_token},
            )
        except Exception as exc:  # noqa: BLE001
            logger.warning("Error revoking Facebook permissions for %s: %s", account.id, exc)
        finally:
            if self._http_client is None:
                await client.aclose()

    async def list_targets(self, account: ConnectedAccount) -> list[Target]:
        """
        List all Facebook Pages managed by the user.
        Pages only; personal profiles are never returned.
        """
        targets: list[Target] = []
        raw_user_token = decrypt_token(account.encrypted_access_token)
        if not raw_user_token:
            return targets

        client = await self._get_client()
        try:
            resp = await client.get(
                f"{GRAPH_API_BASE}/me/accounts",
                params={
                    "fields": "id,name,category,fan_count,tasks",
                    "access_token": raw_user_token,
                },
            )
            if resp.status_code == 200:
                for p in resp.json().get("data", []):
                    pid = str(p.get("id"))
                    targets.append(
                        Target(
                            id=pid,
                            name=p.get("name", f"Page {pid}"),
                            target_type="page",
                            description=f"Category: {p.get('category')}, Fans: {p.get('fan_count', 0)}",
                            metadata={"category": p.get("category"), "tasks": p.get("tasks", [])},
                        )
                    )
        except Exception as exc:  # noqa: BLE001
            logger.warning("Error listing Facebook Pages for %s: %s", account.id, exc)
        finally:
            if self._http_client is None:
                await client.aclose()

        return targets

    def _get_page_access_token(self, account: ConnectedAccount, page_id: str) -> str | None:
        """Retrieve and decrypt the long-lived Page Access Token for a specific Page."""
        tokens_map = account.account_metadata.get("page_tokens", {})
        enc_token = tokens_map.get(str(page_id))
        if enc_token:
            return decrypt_token(enc_token)
        return None

    async def validate(self, variant: Any) -> list[Issue]:
        """
        Validate Facebook Page post payload: requires target Page and validates character limits.
        """
        issues: list[Issue] = []
        payload = getattr(variant, "payload", {})
        if not isinstance(payload, dict):
            return [Issue(field="payload", message="Invalid variant payload format", severity="error")]

        # Target Page is required
        page_id = payload.get("page_id") or payload.get("target") or payload.get("target_id")
        if not page_id:
            issues.append(
                Issue(
                    field="page_id",
                    message="A Facebook Page target must be selected (publishing to personal profiles is not permitted)",
                    severity="error",
                    code="missing_page_target",
                )
            )

        text = payload.get("text", "") or payload.get("message", "")
        if not text and not payload.get("link") and not payload.get("media_urls"):
            issues.append(Issue(field="text", message="Facebook post must have a message, link, or media", severity="error"))

        if len(text) > self.capabilities.max_text_length:
            issues.append(
                Issue(
                    field="text",
                    message=f"Post length ({len(text)} chars) exceeds maximum {self.capabilities.max_text_length} characters",
                    severity="error",
                    code="text_too_long",
                )
            )

        return issues

    async def publish(self, account: ConnectedAccount, variant: Any) -> PublishResult:
        """
        Publish post to a Facebook Page's feed via POST /{page_id}/feed.
        Uses the Page's dedicated long-lived Page Access Token.
        """
        payload = getattr(variant, "payload", {})
        page_id = payload.get("page_id") or payload.get("target") or payload.get("target_id")
        if not page_id:
            return PublishResult(
                success=False,
                error_message="Cannot publish to Facebook: missing target Page ID",
                is_retryable=False,
            )

        page_token = self._get_page_access_token(account, str(page_id))
        if not page_token:
            # Fallback to user access token if page token not pre-cached
            page_token = decrypt_token(account.encrypted_access_token)

        if not page_token:
            return PublishResult(
                success=False,
                error_message="Missing decrypted Page Access Token for Facebook Page",
                is_retryable=False,
            )

        message = payload.get("text") or payload.get("message", "")
        link = payload.get("link")

        data: dict[str, Any] = {
            "message": message,
            "access_token": page_token,
        }
        if link:
            data["link"] = link

        client = await self._get_client()
        try:
            resp = await client.post(
                f"{GRAPH_API_BASE}/{page_id}/feed",
                data=data,
            )
        except Exception as exc:  # noqa: BLE001
            logger.error("Network error publishing to Facebook Page %s: %s", page_id, exc)
            return PublishResult(
                success=False,
                error_message=f"Network error: {exc}",
                is_retryable=True,
            )
        finally:
            if self._http_client is None:
                await client.aclose()

        if resp.status_code == 200:
            res_json = resp.json()
            post_id = res_json.get("id", "")
            return PublishResult(
                success=True,
                external_post_id=post_id,
                external_url=f"https://www.facebook.com/{post_id}",
                raw_response=res_json,
            )

        is_retryable = resp.status_code in {429, 500, 502, 503, 504}
        error_msg = f"Facebook Graph API error (HTTP {resp.status_code}): {resp.text}"
        logger.warning("Facebook publish failed for Page %s: %s", page_id, error_msg)

        return PublishResult(
            success=False,
            error_message=error_msg,
            raw_response={"status_code": resp.status_code, "body": resp.text},
            is_retryable=is_retryable,
        )

    async def delete_post(self, account: ConnectedAccount, external_post_id: str) -> None:
        """
        Delete Page post via DELETE /{post_id}.
        """
        # Resolve page token or user token
        page_id = external_post_id.split("_")[0] if "_" in external_post_id else ""
        token = self._get_page_access_token(account, page_id) or decrypt_token(account.encrypted_access_token)
        if not token:
            raise ValueError("Missing decrypted access token")

        client = await self._get_client()
        try:
            resp = await client.delete(
                f"{GRAPH_API_BASE}/{external_post_id}",
                params={"access_token": token},
            )
        finally:
            if self._http_client is None:
                await client.aclose()

        if resp.status_code not in {200, 204}:
            logger.warning("Failed to delete Facebook post %s: %s", external_post_id, resp.text)
            raise RuntimeError(f"Failed to delete Facebook post (HTTP {resp.status_code}): {resp.text}")

    async def fetch_metrics(self, account: ConnectedAccount, external_post_id: str) -> Metrics:
        """
        Fetch post reactions, comments, shares, and post insights.
        """
        page_id = external_post_id.split("_")[0] if "_" in external_post_id else ""
        token = self._get_page_access_token(account, page_id) or decrypt_token(account.encrypted_access_token)
        if not token:
            raise ValueError("Missing decrypted access token")

        client = await self._get_client()
        try:
            # 1. Fetch public reactions, comments, and shares
            resp = await client.get(
                f"{GRAPH_API_BASE}/{external_post_id}",
                params={
                    "fields": "shares,comments.summary(true),reactions.summary(true)",
                    "access_token": token,
                },
            )
            # 2. Fetch post impressions and clicks from insights
            insights_resp = await client.get(
                f"{GRAPH_API_BASE}/{external_post_id}/insights",
                params={
                    "metric": "post_impressions,post_engaged_users,post_clicks",
                    "access_token": token,
                },
            )
        finally:
            if self._http_client is None:
                await client.aclose()

        if resp.status_code != 200:
            logger.warning("Failed to fetch Facebook metrics for %s: %s", external_post_id, resp.text)
            return Metrics()

        data = resp.json()
        likes = data.get("reactions", {}).get("summary", {}).get("total_count", 0)
        comments = data.get("comments", {}).get("summary", {}).get("total_count", 0)
        shares = data.get("shares", {}).get("count", 0)

        impressions = 0
        clicks = 0
        if insights_resp.status_code == 200:
            for item in insights_resp.json().get("data", []):
                m_name = item.get("name")
                val = item.get("values", [{}])[0].get("value", 0)
                if m_name == "post_impressions":
                    impressions = int(val)
                elif m_name == "post_clicks":
                    clicks = int(val)

        impressions = impressions or (likes + comments + shares)

        return Metrics(
            impressions=impressions,
            reach=impressions,
            engagements=likes + comments + shares + clicks,
            likes=likes,
            comments=comments,
            shares_reposts=shares,
            clicks=clicks,
        )

    async def fetch_account_metrics(self, account: ConnectedAccount) -> AccountMetrics:
        """
        Fetch whole-account (Page) followers and engagement metrics from original Facebook Graph API source.
        """
        raw_user_token = decrypt_token(account.encrypted_access_token)
        if not raw_user_token:
            raise ValueError("Missing decrypted access token")

        # Resolve primary Page ID from metadata
        pages = account.account_metadata.get("pages", [])
        page_id = str(pages[0].get("id")) if pages else ""
        if not page_id:
            return AccountMetrics()

        page_token = self._get_page_access_token(account, page_id) or raw_user_token

        client = await self._get_client()
        try:
            # 1. Fetch followers count and fan count
            page_resp = await client.get(
                f"{GRAPH_API_BASE}/{page_id}",
                params={
                    "fields": "followers_count,fan_count,name",
                    "access_token": page_token,
                },
            )
            # 2. Fetch page impressions from insights
            insights_resp = await client.get(
                f"{GRAPH_API_BASE}/{page_id}/insights",
                params={
                    "metric": "page_impressions,page_engaged_users,page_views_total",
                    "period": "day",
                    "access_token": page_token,
                },
            )
        finally:
            if self._http_client is None:
                await client.aclose()

        if page_resp.status_code != 200:
            logger.warning("Failed to fetch Facebook Page stats for %s: %s", page_id, page_resp.text)
            return AccountMetrics()

        page_data = page_resp.json()
        followers = page_data.get("followers_count") or page_data.get("fan_count", 0)

        impressions = 0
        engagements = 0
        views = 0
        if insights_resp.status_code == 200:
            for item in insights_resp.json().get("data", []):
                m_name = item.get("name")
                val = item.get("values", [{}])[0].get("value", 0)
                if m_name == "page_impressions":
                    impressions = int(val)
                elif m_name == "page_engaged_users":
                    engagements = int(val)
                elif m_name == "page_views_total":
                    views = int(val)

        return AccountMetrics(
            followers_count=followers,
            impressions=impressions,
            engagements=engagements,
            profile_views=views,
            extras={"page_id": page_id, "page_name": page_data.get("name")},
        )
