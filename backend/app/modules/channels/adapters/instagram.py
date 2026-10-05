import logging
import re
import urllib.parse
from datetime import UTC, datetime, timedelta
from typing import Any

import httpx
from fastapi import HTTPException

from app.core.config import get_settings
from app.modules.channels.adapters.management import InstagramManagement
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
from app.modules.channels.support import AdapterHTTP, require_credentials

logger = logging.getLogger(__name__)

GRAPH_API_VERSION = get_settings().graph_api_version
GRAPH_API_BASE = f"https://graph.instagram.com/{GRAPH_API_VERSION}"
INSTAGRAM_OAUTH_DIALOG = "https://www.instagram.com/oauth/authorize"
INSTAGRAM_TOKEN_URL = "https://api.instagram.com/oauth/access_token"
INSTAGRAM_GRAPH_BASE = "https://graph.instagram.com"

# Required permissions for Instagram Professional (Business and Creator) accounts
INSTAGRAM_SCOPES = [
    "instagram_business_basic",
    "instagram_business_content_publish",
    "instagram_business_manage_insights",
]


class InstagramAdapter(InstagramManagement):
    """
    Platform adapter for Instagram Business/Creator accounts via Meta's official Graph API.
    Supports single feed images, multi-image carousels, and Reels via the two-step
    container creation and publishing pipeline.
    """

    platform = "instagram"
    required_credentials = ("app_id", "app_secret")

    def __init__(
        self,
        app_id: str | None = None,
        app_secret: str | None = None,
        http_client: httpx.AsyncClient | None = None,
    ) -> None:
        settings = get_settings()
        self.app_id = app_id or settings.instagram_app_id or "ig_app_id_placeholder"
        self.app_secret = app_secret or settings.instagram_app_secret or "ig_app_secret_placeholder"
        self.redirect_base_url = settings.oauth_callback_url(self.platform)
        self._http_client = http_client

        self.capabilities = Capabilities(
            platform=self.platform,
            display_name="Instagram (Business / Creator)",
            max_text_length=2200,
            text_length_type="characters",
            supports_media=True,
            supported_media_types=["image/jpeg", "image/png", "image/webp", "video/mp4"],
            max_media_count=10,  # Carousels allow up to 10 images/videos
            supports_video=True,
            max_video_duration_seconds=900,  # Reels up to 15 mins
            supports_threads=False,
            supports_polls=False,
            supports_alt_text=False,
            max_alt_text_length=1000,
            supports_links=False,  # Feed captions do not render clickable hyperlinks
            supports_tags=True,
            visibility_options=["public"],
            requires_target=True,  # Mandatory selection of target Instagram business account
            target_type_name="instagram_account",
            supports_account_metrics=True,
            supports_scheduling=True,
        )

    from app.modules.channels.adapters.media import instagram_urls as prepare_media

    async def _get_client(self) -> httpx.AsyncClient:
        if self._http_client is not None:
            return self._http_client
        return AdapterHTTP(self.platform)

    async def build_auth_url(self, workspace_id: str, state: str, **opts: Any) -> AuthStart:
        """
        Build OAuth authorization URL requesting Instagram professional publishing scopes.
        """
        require_credentials(self, *self.required_credentials)
        redirect_uri = opts.get("redirect_uri") or self.redirect_base_url
        scopes = opts.get("scopes") or INSTAGRAM_SCOPES
        if isinstance(scopes, str):
            scopes = [scope.strip() for scope in scopes.split(",") if scope.strip()]
        allowed_scopes = {*INSTAGRAM_SCOPES, "instagram_business_manage_comments"}
        if not isinstance(scopes, (list, tuple)) or any(
            not isinstance(scope, str) or scope not in allowed_scopes for scope in scopes
        ):
            raise HTTPException(
                422, "Use supported instagram_business_* permissions for Instagram Login"
            )
        scopes = list(dict.fromkeys(["instagram_business_basic", *scopes]))
        if opts.get("manage_replies"):
            scopes = list(dict.fromkeys([*scopes, "instagram_business_manage_comments"]))

        params = {
            "client_id": self.app_id,
            "redirect_uri": redirect_uri,
            "state": state,
            "response_type": "code",
            "enable_fb_login": "0",
            "force_authentication": "1",
            "scope": ",".join(scopes),
        }
        auth_url = f"{INSTAGRAM_OAUTH_DIALOG}?{urllib.parse.urlencode(params)}"
        return AuthStart(
            auth_url=auth_url,
            state=state,
            code_verifier=None,
            metadata={"redirect_uri": redirect_uri, "requested_scopes": scopes},
        )

    @staticmethod
    def _token_response(response: httpx.Response, operation: str) -> dict[str, Any]:
        # Never send provider response bodies to the browser: they may contain credentials.
        if response.status_code != 200:
            error_status = (
                429
                if response.status_code == 429
                else (503 if response.status_code >= 500 else 400)
            )
            raise HTTPException(
                error_status, f"Instagram {operation} failed. Please restart authorization."
            )
        try:
            data = response.json()
            if isinstance(data, dict) and "data" in data:
                entries = data["data"]
                if "access_token" in data or not isinstance(entries, list) or len(entries) != 1:
                    raise ValueError("Ambiguous token response")
                data = entries[0]
            if not isinstance(data, dict) or not isinstance(data.get("access_token"), str):
                raise TypeError("Missing access token")
            if not data["access_token"]:
                raise ValueError("Empty access token")
            return data
        except (ValueError, TypeError, KeyError) as exc:
            raise HTTPException(
                400, f"Instagram {operation} returned an invalid token response"
            ) from exc

    @staticmethod
    def _token_lifetime(data: dict[str, Any]) -> int:
        try:
            lifetime = int(data["expires_in"])
            if lifetime <= 0:
                raise ValueError("Invalid token lifetime")
            return lifetime
        except (KeyError, TypeError, ValueError) as exc:
            raise HTTPException(400, "Instagram returned an invalid token expiry") from exc

    async def handle_callback(
        self,
        workspace_id: str,
        params: dict[str, Any],
        state: str,
        **opts: Any,
    ) -> ConnectedAccount:
        """Exchange an Instagram Login code and load the authorized professional account."""
        require_credentials(self, *self.required_credentials)
        if params.get("error"):
            raise HTTPException(
                400, "Instagram authorization was denied. Please restart authorization."
            )
        code = params.get("code")
        if not isinstance(code, str) or not code:
            raise HTTPException(400, "Missing authorization code from Instagram callback")
        # Browser callbacks do not send fragments; tolerate clients copying Instagram's #_ suffix.
        code = code.removesuffix("#_")
        redirect_uri = opts.get("redirect_uri") or self.redirect_base_url
        client = await self._get_client()
        try:
            token_resp = await client.post(
                INSTAGRAM_TOKEN_URL,
                data={
                    "client_id": self.app_id,
                    "client_secret": self.app_secret,
                    "grant_type": "authorization_code",
                    "redirect_uri": redirect_uri,
                    "code": code,
                },
            )
            short_data = self._token_response(token_resp, "token exchange")
            long_resp = await client.get(
                f"{INSTAGRAM_GRAPH_BASE}/access_token",
                params={
                    "grant_type": "ig_exchange_token",
                    "client_secret": self.app_secret,
                    "access_token": short_data["access_token"],
                },
            )
            long_data = self._token_response(long_resp, "long-lived token exchange")
            user_access_token = long_data["access_token"]
            expires_in = self._token_lifetime(long_data)
            profile_resp = await client.get(
                f"{GRAPH_API_BASE}/me",
                params={
                    "fields": "user_id,username,name,account_type,profile_picture_url,followers_count",
                    "access_token": user_access_token,
                },
            )
            if profile_resp.status_code != 200:
                raise HTTPException(
                    400, "Unable to load the authorized Instagram professional account"
                )
            try:
                profile = profile_resp.json()
                if not isinstance(profile, dict):
                    raise TypeError("Invalid profile")
                ig_id = profile.get("user_id") or short_data.get("user_id") or profile.get("id")
                username = profile.get("username")
                if not ig_id or not isinstance(username, str) or not username:
                    raise ValueError("Missing Instagram account identity")
            except (ValueError, TypeError) as exc:
                raise HTTPException(400, "Instagram returned an invalid account profile") from exc
            account_type = str(profile.get("account_type", "BUSINESS")).upper()
            if account_type not in {"BUSINESS", "CREATOR", "MEDIA_CREATOR"}:
                raise HTTPException(400, "An Instagram Business or Creator account is required")
        finally:
            if self._http_client is None:
                await client.aclose()

        ig_id = str(ig_id)
        picture = profile.get("profile_picture_url")
        ig_account = {
            "id": ig_id,
            "username": username,
            "name": profile.get("name"),
            "followers_count": profile.get("followers_count", 0),
            "profile_picture_url": picture,
        }
        requested_scopes = opts.get("oauth_metadata", {}).get("requested_scopes", INSTAGRAM_SCOPES)
        # Newer exchanges return the scopes actually approved by the user.
        granted_scopes = short_data.get("permissions", requested_scopes)
        if isinstance(granted_scopes, str):
            granted_scopes = [scope.strip() for scope in granted_scopes.split(",") if scope.strip()]
        if not isinstance(granted_scopes, list) or "instagram_business_basic" not in granted_scopes:
            raise HTTPException(400, "Instagram basic access was not granted. Please reconnect.")
        return ConnectedAccount(
            workspace_id=workspace_id,
            platform=self.platform,
            external_account_id=f"ig_{ig_id}",
            display_name=f"@{username} (Instagram)",
            account_type="business" if account_type == "BUSINESS" else "creator",
            encrypted_access_token=encrypt_token(user_access_token),
            token_expires_at=datetime.now(UTC) + timedelta(seconds=expires_in),
            granted_scopes=granted_scopes,
            status="active",
            account_metadata={
                "oauth_flow": "instagram_login",
                "primary_ig_id": ig_id,
                "primary_username": username,
                "profile_picture_url": picture,
                "avatar_url": picture,
                "instagram_accounts": [ig_account],
            },
        )

    async def refresh_tokens(self, account: ConnectedAccount) -> ConnectedAccount:
        """Refresh a long-lived Instagram User token before it expires."""
        if (account.account_metadata or {}).get("oauth_flow") != "instagram_login":
            raise HTTPException(400, "Reconnect Instagram using Instagram Business Login")
        raw_user_token = decrypt_token(account.encrypted_access_token)
        if not raw_user_token:
            raise ValueError("Missing decrypted Instagram access token")
        client = await self._get_client()
        try:
            resp = await client.get(
                f"{INSTAGRAM_GRAPH_BASE}/refresh_access_token",
                params={"grant_type": "ig_refresh_token", "access_token": raw_user_token},
            )
            data = self._token_response(resp, "token refresh")
            expires_in = self._token_lifetime(data)
            account.encrypted_access_token = encrypt_token(data["access_token"])
            account.token_expires_at = datetime.now(UTC) + timedelta(seconds=expires_in)
            # Legacy Page-token caches must never override a refreshed Instagram User token.
            metadata = dict(account.account_metadata or {})
            metadata.pop("ig_tokens", None)
            account.account_metadata = metadata
            account.status = "active"
            return account
        finally:
            if self._http_client is None:
                await client.aclose()

    async def revoke(self, account: ConnectedAccount) -> None:
        """
        Revoke permissions via DELETE /me/permissions if supported.
        Instagram User tokens (graph.instagram.com) do not support programmatic revocation
        and return 400 Bad Request; treat 400/404 as already revoked or unsupported.
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
            if resp.status_code not in (200, 400, 404):
                resp.raise_for_status()
        except httpx.HTTPStatusError as exc:
            if exc.response.status_code not in (400, 404):
                logger.warning("Error revoking Instagram permissions for %s: %s", account.id, exc)
                raise
        except Exception as exc:
            logger.warning("Error revoking Instagram permissions for %s: %s", account.id, exc)
            raise
        finally:
            if self._http_client is None:
                await client.aclose()

    async def list_targets(self, account: ConnectedAccount) -> list[Target]:
        """
        List all connected Instagram Business / Creator accounts.
        """
        targets: list[Target] = []
        ig_accounts = account.account_metadata.get("instagram_accounts", [])
        for item in ig_accounts:
            ig_id = str(item.get("id"))
            username = item.get("username", ig_id)
            targets.append(
                Target(
                    id=ig_id,
                    name=f"@{username}",
                    target_type="instagram_account",
                    description=f"Followers: {item.get('followers_count', 0)}",
                    metadata=item,
                )
            )
        return targets

    def _get_ig_token(self, account: ConnectedAccount, ig_user_id: str) -> str | None:
        """Retrieve and decrypt the access token for a specific Instagram account."""
        if account.account_metadata.get("oauth_flow") == "instagram_login":
            return decrypt_token(account.encrypted_access_token)
        tokens_map = account.account_metadata.get("ig_tokens", {})
        enc_tok = tokens_map.get(str(ig_user_id))
        if enc_tok:
            return decrypt_token(enc_tok)
        return decrypt_token(account.encrypted_access_token)

    async def validate(self, variant: Any) -> list[Issue]:
        """
        Validate Instagram requirements:
        1. Target Instagram account must be selected.
        2. Media is mandatory for all Instagram post types.
        3. Caption maximum 2,200 characters.
        4. Maximum 30 hashtags.
        """
        issues: list[Issue] = []
        payload = getattr(variant, "payload", {})
        if not isinstance(payload, dict):
            return [
                Issue(field="payload", message="Invalid variant payload format", severity="error")
            ]

        # Target Instagram account is required
        target_id = payload.get("target_id") or payload.get("ig_user_id") or payload.get("target")
        if not target_id:
            issues.append(
                Issue(
                    field="target_id",
                    message="Target Instagram Business/Creator account must be selected",
                    severity="error",
                    code="missing_instagram_target",
                )
            )

        # Media is strictly required for Instagram
        has_media = bool(
            payload.get("image_url")
            or payload.get("video_url")
            or payload.get("media_urls")
            or payload.get("children")
        )
        if not has_media:
            issues.append(
                Issue(
                    field="media",
                    message="Instagram requires at least one image or video attachment for all post types",
                    severity="error",
                    code="media_required",
                )
            )

        # Caption length (max 2,200 characters)
        caption = payload.get("caption") or payload.get("text", "")
        if len(caption) > self.capabilities.max_text_length:
            issues.append(
                Issue(
                    field="caption",
                    message=f"Caption ({len(caption)} chars) exceeds maximum {self.capabilities.max_text_length} characters",
                    severity="error",
                    code="caption_too_long",
                )
            )

        # Maximum 30 hashtags
        hashtags = re.findall(r"#\w+", caption)
        if len(hashtags) > 30:
            issues.append(
                Issue(
                    field="caption",
                    message=f"Caption contains {len(hashtags)} hashtags; Instagram allows a maximum of 30",
                    severity="error",
                    code="too_many_hashtags",
                )
            )

        # Carousels limit (max 10 items)
        media_urls = payload.get("media_urls", [])
        if len(media_urls) > self.capabilities.max_media_count:
            issues.append(
                Issue(
                    field="media_urls",
                    message=f"Maximum {self.capabilities.max_media_count} items allowed in an Instagram carousel",
                    severity="error",
                    code="too_many_media",
                )
            )

        return issues

    async def publish(self, account, variant):
        from app.modules.channels.adapters.media import save_state

        payload = variant.payload
        target = (
            payload.get("target_id")
            or payload.get("ig_user_id")
            or payload.get("target")
            or account.account_metadata.get("primary_ig_id")
        )
        token = self._get_ig_token(account, str(target))
        if not target or not token:
            return PublishResult(
                success=False,
                error_message="A connected professional Instagram account is required",
            )
        known = {str(a["id"]) for a in account.account_metadata.get("instagram_accounts", [])}
        if known and str(target) not in known:
            return PublishResult(
                success=False, error_message="Instagram target is not connected to this account"
            )
        client = await self._get_client()
        state = getattr(variant, "publish_state", None) or {}
        sending = False
        try:
            creation = state.get("instagram_container")
            if not creation:
                urls = payload.get("media_urls") or [
                    payload.get("video_url") or payload.get("image_url")
                ]
                types = payload.get("media_types") or [
                    "video/mp4" if payload.get("video_url") else "image/jpeg"
                ] * len(urls)
                caption = payload.get("caption") or payload.get("text", "")
                data = {"access_token": token, "caption": caption}
                if len(urls) > 1 or payload.get("children"):
                    children = list(
                        state.get("instagram_children") or payload.get("children") or []
                    )
                    for index, url in enumerate(urls[len(children) :], start=len(children)):
                        if not url:
                            continue
                        video = types[index].startswith("video/")
                        child = {
                            "access_token": token,
                            "is_carousel_item": "true",
                            "video_url" if video else "image_url": url,
                        }
                        if video:
                            child["media_type"] = "VIDEO"
                        response = await client.post(f"{GRAPH_API_BASE}/{target}/media", data=child)
                        response.raise_for_status()
                        children.append(response.json()["id"])
                        await save_state(variant, instagram_children=children)
                    for child in children:
                        response = await client.get(
                            f"{GRAPH_API_BASE}/{child}",
                            params={"fields": "status_code,status", "access_token": token},
                        )
                        response.raise_for_status()
                        if response.json().get("status_code") != "FINISHED":
                            return PublishResult(
                                success=False,
                                is_retryable=response.json().get("status_code") == "IN_PROGRESS",
                                waiting_for_media=True,
                                retry_after=60,
                                error_message="Instagram carousel media is still processing",
                            )
                    data.update(media_type="CAROUSEL", children=",".join(children))
                elif types[0].startswith("video/") or payload.get("media_type", "").upper() in {
                    "REELS",
                    "VIDEO",
                }:
                    data.update(media_type="REELS", video_url=urls[0])
                else:
                    data["image_url"] = urls[0]
                response = await client.post(f"{GRAPH_API_BASE}/{target}/media", data=data)
                response.raise_for_status()
                creation = response.json()["id"]
                await save_state(variant, instagram_container=creation)
            response = await client.get(
                f"{GRAPH_API_BASE}/{creation}",
                params={"fields": "status_code,status", "access_token": token},
            )
            response.raise_for_status()
            container_status = response.json().get("status_code")
            if container_status != "FINISHED":
                return PublishResult(
                    success=False,
                    is_retryable=container_status == "IN_PROGRESS",
                    waiting_for_media=container_status == "IN_PROGRESS",
                    retry_after=60,
                    outcome_unknown=container_status == "PUBLISHED",
                    error_message="Instagram container status: " + str(container_status),
                )
            sending = True
            response = await client.post(
                f"{GRAPH_API_BASE}/{target}/media_publish",
                data={"creation_id": creation, "access_token": token},
            )
            response.raise_for_status()
            return PublishResult(
                success=True,
                external_post_id=str(response.json()["id"]),
                raw_response=response.json(),
            )
        except httpx.HTTPStatusError as exc:
            code = exc.response.status_code
            return PublishResult(
                success=False,
                status_code=code,
                auth_error=code == 401 or exc.response.json().get("error", {}).get("code") == 190,
                is_retryable=code == 429 or (code >= 500 and not sending),
                outcome_unknown=sending and code >= 500,
                error_message="Instagram API request failed",
            )
        except httpx.TransportError:
            return PublishResult(
                success=False,
                is_retryable=not sending,
                outcome_unknown=sending,
                error_message="Instagram API connection interrupted",
            )
        finally:
            if self._http_client is None:
                await client.aclose()

    async def delete_post(self, account, external_post_id):
        raise HTTPException(
            422,
            "Instagram does not support deleting published media through this API; delete it in Instagram",
        )

    async def fetch_metrics(self, account: ConnectedAccount, external_post_id: str) -> Metrics:
        """
        Fetch Instagram media likes, comments, shares, saves, impressions, and reach.
        """
        ig_user_id = account.account_metadata.get("primary_ig_id", "")
        token = self._get_ig_token(account, ig_user_id)
        if not token:
            raise ValueError("Missing decrypted access token")

        client = await self._get_client()
        try:
            # 1. Fetch public like and comment counts
            media_resp = await client.get(
                f"{GRAPH_API_BASE}/{external_post_id}",
                params={
                    "fields": "like_count,comments_count,media_type,permalink",
                    "access_token": token,
                },
            )
            # 2. Fetch insights (impressions, reach, saved, shares)
            insights_resp = await client.get(
                f"{GRAPH_API_BASE}/{external_post_id}/insights",
                params={"metric": "impressions,reach,saved,shares", "access_token": token},
            )
        finally:
            if self._http_client is None:
                await client.aclose()

        if media_resp.status_code != 200:
            logger.warning(
                "Failed to fetch Instagram metrics for %s: %s", external_post_id, media_resp.text
            )
            raise RuntimeError("Metrics request failed or is unsupported")

        media_data = media_resp.json()
        likes = media_data.get("like_count", 0)
        comments = media_data.get("comments_count", 0)

        impressions = 0
        reach = 0
        saved = 0
        shares = 0

        if insights_resp.status_code != 200:
            raise RuntimeError("Insights are unavailable; no zero snapshot was recorded")
        if insights_resp.status_code == 200:
            for item in insights_resp.json().get("data", []):
                name = item.get("name")
                val = item.get("values", [{}])[0].get("value", 0)
                if name == "impressions":
                    impressions = int(val)
                elif name == "reach":
                    reach = int(val)
                elif name == "saved":
                    saved = int(val)
                elif name == "shares":
                    shares = int(val)

        return Metrics(
            impressions=impressions,
            reach=reach or impressions,
            engagements=likes + comments + shares + saved,
            likes=likes,
            comments=comments,
            shares_reposts=shares,
            extras={"saved": saved, "permalink": media_data.get("permalink")},
        )

    async def fetch_account_metrics(self, account: ConnectedAccount) -> AccountMetrics:
        """
        Fetch whole-account follower and profile metrics directly from the original Instagram API source.
        """
        ig_user_id = account.account_metadata.get("primary_ig_id", "")
        token = self._get_ig_token(account, ig_user_id)
        if not token:
            raise ValueError("Missing decrypted access token")

        client = await self._get_client()
        try:
            # 1. Profile counts
            user_resp = await client.get(
                f"{GRAPH_API_BASE}/{ig_user_id}",
                params={
                    "fields": "followers_count,follows_count,media_count,name,username",
                    "access_token": token,
                },
            )
            # 2. Account insights
            insights_resp = await client.get(
                f"{GRAPH_API_BASE}/{ig_user_id}/insights",
                params={
                    "metric": "impressions,reach,profile_views",
                    "period": "day",
                    "access_token": token,
                },
            )
        finally:
            if self._http_client is None:
                await client.aclose()

        if user_resp.status_code != 200:
            logger.warning(
                "Failed to fetch Instagram account stats for %s: %s", ig_user_id, user_resp.text
            )
            raise RuntimeError("Account metrics request failed or is unsupported")

        data = user_resp.json()
        followers = data.get("followers_count", 0)
        follows = data.get("follows_count", 0)
        media_count = data.get("media_count", 0)

        impressions = 0
        profile_views = 0
        reach = 0

        if insights_resp.status_code == 200:
            for item in insights_resp.json().get("data", []):
                name = item.get("name")
                val = item.get("values", [{}])[0].get("value", 0)
                if name in ("impressions", "views"):
                    impressions = int(val)
                elif name == "profile_views":
                    profile_views = int(val)
                elif name == "reach":
                    reach = int(val)
        else:
            logger.info(
                "Instagram account insights unavailable for %s (status %s); saving profile counts",
                ig_user_id,
                insights_resp.status_code,
            )

        return AccountMetrics(
            followers_count=followers,
            following_count=follows,
            posts_count=media_count,
            impressions=impressions,
            reach=reach,
            profile_views=profile_views,
            extras={"username": data.get("username"), "name": data.get("name")},
        )
