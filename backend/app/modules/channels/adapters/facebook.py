import json
import logging
import urllib.parse
from datetime import UTC, datetime, timedelta
from typing import Any

import httpx
from fastapi import HTTPException, status

from app.core.config import get_settings
from app.modules.channels.adapters.management import FacebookManagement
from app.modules.channels.adapters.media import save_state
from app.modules.channels.adapters.meta import graph_items
from app.modules.channels.adapters.meta_insights import count, coverage, fetch_insights
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
from app.modules.channels.support import AdapterHTTP

logger = logging.getLogger(__name__)

GRAPH_API_VERSION = get_settings().graph_api_version
GRAPH_API_BASE = f"https://graph.facebook.com/{GRAPH_API_VERSION}"
GRAPH_INSIGHTS_API_BASE = f"https://graph.facebook.com/{get_settings().graph_insights_api_version}"
FACEBOOK_OAUTH_DIALOG = f"https://www.facebook.com/{GRAPH_API_VERSION}/dialog/oauth"

# Official permissions needed to manage, publish, and fetch analytics for Facebook Pages
FACEBOOK_SCOPES = [
    "pages_show_list",
    "business_management",
    "pages_read_engagement",
    "pages_manage_posts",
    "pages_read_user_content",
    "read_insights",
]


class FacebookAdapter(FacebookManagement):
    """
    Platform adapter for Facebook.
    Per spec: Publishing is to Pages only, not personal profiles.
    Handles Page selection after login (via list_targets) and long-lived Page tokens.
    """

    from app.modules.channels.adapters.analytics_posts import (
        facebook_posts as fetch_analytics_posts,
    )

    platform = "facebook"
    required_credentials = ("app_id", "app_secret")

    def __init__(
        self,
        app_id: str | None = None,
        app_secret: str | None = None,
        http_client: httpx.AsyncClient | None = None,
    ) -> None:
        settings = get_settings()
        self.app_id = app_id or settings.facebook_app_id or "facebook_app_id_placeholder"
        self.app_secret = (
            app_secret or settings.facebook_app_secret or "facebook_app_secret_placeholder"
        )
        self.redirect_base_url = settings.oauth_callback_url(self.platform)
        self._http_client = http_client

        self.capabilities = Capabilities(
            platform=self.platform,
            display_name="Facebook Pages",
            max_text_length=63206,
            text_length_type="characters",
            supports_media=True,
            supported_media_types=[
                "image/jpeg",
                "image/png",
                "image/webp",
                "image/gif",
                "video/mp4",
            ],
            max_media_count=10,
            supports_video=True,
            max_video_duration_seconds=14400,
            supports_threads=False,
            supports_polls=False,
            supports_alt_text=False,
            max_alt_text_length=1000,
            supports_links=True,
            supports_tags=False,
            visibility_options=["public"],
            requires_target=True,  # Page selection is mandatory
            target_type_name="page",
            supports_account_metrics=True,
            supports_scheduling=True,
        )

    from app.modules.channels.adapters.media import remote_urls as prepare_media

    async def _get_client(self) -> httpx.AsyncClient:
        if self._http_client is not None:
            return self._http_client
        return AdapterHTTP(self.platform)

    async def build_auth_url(self, workspace_id: str, state: str, **opts: Any) -> AuthStart:
        """
        Build Facebook OAuth authorization dialog URL requesting Pages permissions.
        """
        redirect_uri = opts.get("redirect_uri") or self.redirect_base_url
        scopes = opts.get("scopes") or FACEBOOK_SCOPES
        if opts.get("manage_replies"):
            scopes = list(dict.fromkeys([*scopes, "pages_manage_engagement"]))

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
            metadata={"redirect_uri": redirect_uri, "requested_scopes": scopes},
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
            if not short_token:
                raise HTTPException(400, "Facebook token exchange returned no access token")

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
            if not fb_user_id:
                raise HTTPException(400, "Could not retrieve the Facebook user profile")
            fb_user_name = user_data.get("name", "Facebook User")
            user_picture = (
                user_data.get("picture", {}).get("data", {}).get("url")
                if isinstance(user_data.get("picture"), dict)
                else None
            )

            # Only replace the destination snapshot after every Graph page was fetched.
            page_tokens, page_summaries = await self._fetch_pages(client, user_access_token)

        finally:
            if self._http_client is None:
                await client.aclose()

        avatar_url = user_picture or (
            page_summaries[0].get("picture_url") if page_summaries else None
        )

        return ConnectedAccount(
            workspace_id=workspace_id,
            platform=self.platform,
            external_account_id=f"fb_user_{fb_user_id}",
            display_name=f"{fb_user_name} (Facebook Pages)",
            account_type="business",
            encrypted_access_token=encrypt_token(user_access_token),
            token_expires_at=datetime.now(UTC) + timedelta(seconds=expires_in),
            granted_scopes=opts.get("oauth_metadata", {}).get("requested_scopes", FACEBOOK_SCOPES),
            status="active",
            last_synced_at=datetime.now(UTC),
            account_metadata={
                "fb_user_id": fb_user_id,
                "fb_user_name": fb_user_name,
                "picture_url": user_picture,
                "avatar_url": avatar_url,
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
            resp.raise_for_status()
            data = resp.json()
            new_user_token = data["access_token"]
            expires_in = data["expires_in"]

            page_tokens, page_summaries = await self._fetch_pages(client, new_user_token)

            meta = dict(account.account_metadata)
            meta["page_tokens"] = page_tokens
            meta["pages"] = page_summaries

            account.encrypted_access_token = encrypt_token(new_user_token)
            account.token_expires_at = datetime.now(UTC) + timedelta(seconds=expires_in)
            account.account_metadata = meta
            account.last_synced_at = datetime.now(UTC)
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
            resp = await client.delete(
                f"{GRAPH_API_BASE}/me/permissions",
                params={"access_token": raw_user_token},
            )
            resp.raise_for_status()
        except Exception as exc:
            logger.warning("Error revoking Facebook permissions for %s: %s", account.id, exc)
            raise
        finally:
            if self._http_client is None:
                await client.aclose()

    async def _fetch_pages(
        self, client: httpx.AsyncClient, user_access_token: str
    ) -> tuple[dict[str, str], list[dict[str, Any]]]:
        """Fetch a complete, encrypted destination snapshot for the parent connection."""
        try:
            response = await client.get(
                f"{GRAPH_API_BASE}/me/accounts",
                params={
                    "fields": "id,name,access_token,tasks,picture",
                    "access_token": user_access_token,
                },
            )
            pages = await graph_items(client, response)
        except (httpx.HTTPError, TypeError, ValueError, RuntimeError) as exc:
            # Provider URLs/body text can contain credentials; expose only our message.
            raise HTTPException(
                502, "Could not sync Facebook Pages. Please reconnect and grant Page access."
            ) from exc

        tokens: dict[str, str] = {}
        summaries: dict[str, dict[str, Any]] = {}
        for page in pages:
            if not isinstance(page, dict):
                raise HTTPException(502, "Facebook returned an invalid Page response")
            page_id = str(page.get("id") or "")
            page_token = page.get("access_token")
            tasks = page.get("tasks", [])
            if not isinstance(tasks, list):
                raise HTTPException(502, "Facebook returned invalid Page tasks")
            # Never offer destinations for which publishing is explicitly disallowed.
            if "tasks" in page and not {"CREATE_CONTENT", "MANAGE"}.intersection(tasks):
                continue
            if not page_id or not isinstance(page_token, str) or not page_token:
                continue
            picture = page.get("picture")
            picture_url = picture.get("data", {}).get("url") if isinstance(picture, dict) else None
            tokens[page_id] = encrypt_token(page_token) or ""
            summaries[page_id] = {
                "id": page_id,
                "name": page.get("name") or f"Page {page_id}",
                "tasks": tasks,
                "picture_url": picture_url,
            }
        return tokens, list(summaries.values())

    async def list_targets(self, account: ConnectedAccount) -> list[Target]:
        """Expose persisted Pages linked to this parent OAuth connection."""
        if account.status != "active":
            raise HTTPException(409, "Reconnect Facebook to choose a Page")
        metadata = account.account_metadata or {}
        tokens = metadata.get("page_tokens", {})
        targets = [
            Target(
                id=str(page["id"]),
                name=page.get("name") or f"Page {page['id']}",
                target_type="page",
                metadata={
                    "parent_connection_id": account.id,
                    "tasks": page.get("tasks", []),
                    "picture_url": page.get("picture_url"),
                },
            )
            for page in metadata.get("pages", [])
            if page.get("id") and tokens.get(str(page["id"]))
        ]
        if not targets:
            raise HTTPException(
                409,
                "No publishable Facebook Pages are connected. Reconnect Facebook, grant Page "
                "and business access, and select the Pages you manage.",
            )
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
            return [
                Issue(field="payload", message="Invalid variant payload format", severity="error")
            ]

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
            issues.append(
                Issue(
                    field="text",
                    message="Facebook post must have a message, link, or media",
                    severity="error",
                )
            )

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
            return PublishResult(
                success=False,
                error_message="Reconnect and select an authorized Page with a Page token",
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
            urls = payload.get("media_urls", [])
            types = payload.get("media_types") or ["image/jpeg"] * len(urls)
            if any(t.startswith("video/") for t in types):
                if len(urls) != 1:
                    return PublishResult(
                        success=False, error_message="Facebook video posts require a single video"
                    )
                resp = await client.post(
                    f"{GRAPH_API_BASE}/{page_id}/videos",
                    data={"file_url": urls[0], "description": message, "access_token": page_token},
                )
            else:
                photos = list(
                    (getattr(variant, "publish_state", None) or {}).get("facebook_photos", [])
                )
                for url in urls[len(photos) :]:
                    photo = await client.post(
                        f"{GRAPH_API_BASE}/{page_id}/photos",
                        data={"url": url, "published": "false", "access_token": page_token},
                    )
                    photo.raise_for_status()
                    photos.append(photo.json()["id"])
                    await save_state(variant, facebook_photos=photos)
                for index, photo in enumerate(photos):
                    data[f"attached_media[{index}]"] = json.dumps({"media_fbid": photo})
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
                outcome_unknown=isinstance(exc, httpx.TransportError),
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

        is_retryable = resp.status_code == 429
        error_msg = f"Facebook Graph API error (HTTP {resp.status_code}): {resp.text}"
        logger.warning("Facebook publish failed for Page %s: %s", page_id, error_msg)

        return PublishResult(
            success=False,
            error_message=error_msg,
            raw_response={"status_code": resp.status_code, "body": resp.text},
            is_retryable=is_retryable,
            status_code=resp.status_code,
            auth_error=resp.status_code == 401,
            outcome_unknown=resp.status_code >= 500,
        )

    async def delete_post(self, account: ConnectedAccount, external_post_id: str) -> None:
        """
        Delete Page post via DELETE /{post_id}.
        """
        # Resolve page token or user token
        page_id = external_post_id.split("_")[0] if "_" in external_post_id else ""
        token = self._get_page_access_token(account, page_id) or decrypt_token(
            account.encrypted_access_token
        )
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
            raise RuntimeError(
                f"Failed to delete Facebook post (HTTP {resp.status_code}): {resp.text}"
            )

    def _analytics_page_id(self, account: ConnectedAccount) -> str:
        pages = account.account_metadata.get("pages", [])
        return str(
            account.account_metadata.get("primary_page_id") or (pages[0]["id"] if pages else "")
        )

    async def fetch_metrics(
        self,
        account: ConnectedAccount,
        external_post_id: str,
        context: dict[str, Any] | None = None,
    ) -> Metrics:
        payload = (context or {}).get("payload") or {}
        page_id = str(payload.get("target_page_id") or self._analytics_page_id(account))
        # Facebook IDs are page_post. Match stored IDs instead of truncating IDs
        # that contain underscores (including adapter fixtures and legacy IDs).
        for page in account.account_metadata.get("pages", []):
            if external_post_id.startswith(f"{page['id']}_"):
                page_id = str(page["id"])
                break
        token = self._get_page_access_token(account, page_id) or decrypt_token(
            account.encrypted_access_token
        )
        if not token:
            raise ValueError("Missing decrypted access token")
        client = await self._get_client()
        try:
            resp = await client.get(
                f"{GRAPH_API_BASE}/{external_post_id}",
                params={
                    "fields": "shares,comments.limit(0).summary(true),reactions.limit(0).summary(true)",
                    "access_token": token,
                },
            )
            insights, notice = await fetch_insights(
                client,
                f"{GRAPH_INSIGHTS_API_BASE}/{external_post_id}/insights",
                {"access_token": token, "period": "lifetime"},
                ["post_media_view", "post_total_media_view_unique", "post_clicks"],
                "Facebook",
            )
        finally:
            if self._http_client is None:
                await client.aclose()
        data = resp.json() if resp.status_code == 200 else {}
        values = {}
        for name, value in {
            "likes": (data.get("reactions") or {}).get("summary", {}).get("total_count"),
            "comments": (data.get("comments") or {}).get("summary", {}).get("total_count"),
            "shares": (data.get("shares") or {}).get("count"),
        }.items():
            if count(value) is not None:
                values[name] = count(value)
        for name, key in {
            "views": "post_media_view",
            "reach": "post_total_media_view_unique",
            "clicks": "post_clicks",
        }.items():
            if key in insights:
                values[name] = insights[key]
        if {"likes", "comments", "shares", "clicks"}.issubset(values):
            values["engagements"] = sum(
                values[k] for k in ("likes", "comments", "shares", "clicks")
            )
        if resp.status_code != 200 and not notice:
            notice = "Facebook reactions, comments and shares are unavailable with this account's API access."
        return Metrics(
            **{k: v for k, v in values.items() if k != "shares"},
            shares_reposts=values.get("shares", 0),
            extras=coverage(
                values,
                notice,
                page_id=page_id,
                insights=insights,
                reach_definition="Unique media viewers reported by Facebook",
            ),
        )

    async def fetch_account_metrics(self, account: ConnectedAccount) -> AccountMetrics:
        page_id = self._analytics_page_id(account)
        if not page_id:
            return AccountMetrics(extras=coverage({}, "Select a Facebook Page to view analytics."))
        token = self._get_page_access_token(account, page_id) or decrypt_token(
            account.encrypted_access_token
        )
        if not token:
            raise ValueError("Missing decrypted access token")
        until = datetime.now(UTC).replace(hour=0, minute=0, second=0, microsecond=0)
        since = until - timedelta(days=1)
        client = await self._get_client()
        try:
            response = await client.get(
                f"{GRAPH_API_BASE}/{page_id}",
                params={"fields": "followers_count,name", "access_token": token},
            )
            insights, notice = await fetch_insights(
                client,
                f"{GRAPH_INSIGHTS_API_BASE}/{page_id}/insights",
                {
                    "access_token": token,
                    "period": "day",
                    "since": int(since.timestamp()),
                    "until": int(until.timestamp()),
                },
                [
                    "page_media_view",
                    "page_total_media_view_unique",
                    "page_post_engagements",
                    "page_views_total",
                ],
                "Facebook",
            )
        finally:
            if self._http_client is None:
                await client.aclose()
        data = response.json() if response.status_code == 200 else {}
        values = {}
        if count(data.get("followers_count")) is not None:
            values["followers_count"] = count(data["followers_count"])
        for name, key in {
            "views": "page_media_view",
            "reach": "page_total_media_view_unique",
            "engagements": "page_post_engagements",
            "profile_views": "page_views_total",
        }.items():
            if key in insights:
                values[name] = insights[key]
        if response.status_code != 200 and not notice:
            notice = "Facebook follower counts are unavailable with this account's API access."
        return AccountMetrics(
            **values,
            extras=coverage(
                values,
                notice,
                page_id=page_id,
                page_name=data.get("name"),
                insights=insights,
                insights_since=since.isoformat(),
                insights_until=until.isoformat(),
                reach_definition="Unique media viewers reported by Facebook",
            ),
        )
