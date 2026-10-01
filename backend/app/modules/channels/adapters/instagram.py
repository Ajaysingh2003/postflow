import logging
import re
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
INSTAGRAM_OAUTH_DIALOG = f"https://www.facebook.com/{GRAPH_API_VERSION}/dialog/oauth"

# Required permissions for Instagram Professional (Business and Creator) accounts
INSTAGRAM_SCOPES = [
    "instagram_basic",
    "instagram_content_publish",
    "instagram_manage_insights",
    "pages_show_list",
    "pages_read_engagement",
]


class InstagramAdapter:
    """
    Platform adapter for Instagram Business/Creator accounts via Meta's official Graph API.
    Supports single feed images, multi-image carousels, and Reels via the two-step
    container creation and publishing pipeline.
    """

    platform = "instagram"

    def __init__(
        self,
        app_id: str | None = None,
        app_secret: str | None = None,
        http_client: httpx.AsyncClient | None = None,
    ) -> None:
        settings = get_settings()
        self.app_id = app_id or settings.instagram_app_id or settings.facebook_app_id or "ig_app_id_placeholder"
        self.app_secret = (
            app_secret or settings.instagram_app_secret or settings.facebook_app_secret or "ig_app_secret_placeholder"
        )
        self.redirect_base_url = settings.oauth_redirect_base_url
        self._http_client = http_client

        self.capabilities = Capabilities(
            platform=self.platform,
            display_name="Instagram (Business / Creator)",
            max_text_length=2200,
            text_length_type="characters",
            supports_media=True,
            supported_media_types=["image/jpeg", "image/png", "video/mp4", "video/quicktime"],
            max_media_count=10,  # Carousels allow up to 10 images/videos
            supports_video=True,
            max_video_duration_seconds=900,  # Reels up to 15 mins
            supports_threads=False,
            supports_polls=False,
            supports_alt_text=True,
            max_alt_text_length=1000,
            supports_links=False,  # Feed captions do not render clickable hyperlinks
            supports_tags=True,
            visibility_options=["public"],
            requires_target=True,  # Mandatory selection of target Instagram business account
            target_type_name="instagram_account",
            supports_account_metrics=True,
            supports_scheduling=True,
        )

    async def _get_client(self) -> httpx.AsyncClient:
        if self._http_client is not None:
            return self._http_client
        return httpx.AsyncClient(timeout=30.0)

    async def build_auth_url(self, workspace_id: str, state: str, **opts: Any) -> AuthStart:
        """
        Build OAuth authorization URL requesting Instagram professional publishing scopes.
        """
        redirect_uri = opts.get("redirect_uri") or self.redirect_base_url
        scopes = opts.get("scopes") or INSTAGRAM_SCOPES

        params = {
            "client_id": self.app_id,
            "redirect_uri": redirect_uri,
            "state": state,
            "response_type": "code",
            "scope": ",".join(scopes),
        }
        auth_url = f"{INSTAGRAM_OAUTH_DIALOG}?{urllib.parse.urlencode(params)}"
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
        Exchange code for long-lived user token and discover connected Instagram Professional accounts.
        """
        code = params.get("code")
        if not code:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Missing authorization code from Instagram callback",
            )

        redirect_uri = opts.get("redirect_uri") or self.redirect_base_url

        client = await self._get_client()
        try:
            # 1. Exchange code for short-lived token
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
                    detail=f"Instagram token exchange failed: {token_resp.text}",
                )

            short_token = token_resp.json().get("access_token")

            # 2. Upgrade to 60-day long-lived token
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
                user_access_token = long_resp.json().get("access_token", short_token)
                expires_in = long_resp.json().get("expires_in", 5184000)
            else:
                user_access_token = short_token
                expires_in = 7200

            # 3. Discover linked Instagram Professional accounts
            pages_resp = await client.get(
                f"{GRAPH_API_BASE}/me/accounts",
                params={
                    "fields": "id,name,access_token,instagram_business_account{id,username,name,profile_picture_url,followers_count}",
                    "access_token": user_access_token,
                },
            )
            pages_data = pages_resp.json().get("data", []) if pages_resp.status_code == 200 else []

            ig_accounts: list[dict[str, Any]] = []
            ig_tokens: dict[str, str] = {}

            for page in pages_data:
                page_token = page.get("access_token")
                ig_obj = page.get("instagram_business_account")
                if ig_obj and ig_obj.get("id"):
                    ig_id = str(ig_obj["id"])
                    ig_accounts.append(
                        {
                            "id": ig_id,
                            "username": ig_obj.get("username"),
                            "name": ig_obj.get("name"),
                            "page_id": page.get("id"),
                            "followers_count": ig_obj.get("followers_count", 0),
                        }
                    )
                    # The Page access token acts as the authenticated token for that Instagram account
                    if page_token:
                        ig_tokens[ig_id] = encrypt_token(page_token) or ""

        finally:
            if self._http_client is None:
                await client.aclose()

        primary_ig = ig_accounts[0] if ig_accounts else {}
        primary_username = primary_ig.get("username", "instagram_user")
        primary_id = primary_ig.get("id", "pending_ig_id")

        return ConnectedAccount(
            workspace_id=workspace_id,
            platform=self.platform,
            external_account_id=f"ig_{primary_id}",
            display_name=f"@{primary_username} (Instagram)",
            account_type="business",
            encrypted_access_token=encrypt_token(user_access_token),
            token_expires_at=datetime.now(UTC) + timedelta(seconds=expires_in),
            granted_scopes=INSTAGRAM_SCOPES,
            status="active",
            account_metadata={
                "primary_ig_id": primary_id,
                "primary_username": primary_username,
                "instagram_accounts": ig_accounts,
                "ig_tokens": ig_tokens,
            },
        )

    async def refresh_tokens(self, account: ConnectedAccount) -> ConnectedAccount:
        """
        Refresh long-lived access token and re-sync Instagram business accounts.
        """
        raw_user_token = decrypt_token(account.encrypted_access_token)
        if not raw_user_token:
            raise ValueError("Missing decrypted Instagram access token")

        client = await self._get_client()
        try:
            resp = await client.get(
                f"{GRAPH_API_BASE}/oauth/access_token",
                params={
                    "grant_type": "fb_exchange_token",
                    "client_id": self.app_id,
                    "client_secret": self.app_secret,
                    "fb_exchange_token": raw_user_token,
                },
            )
            new_token = resp.json().get("access_token", raw_user_token) if resp.status_code == 200 else raw_user_token

            # Re-fetch linked Instagram accounts
            pages_resp = await client.get(
                f"{GRAPH_API_BASE}/me/accounts",
                params={
                    "fields": "id,name,access_token,instagram_business_account{id,username,name,followers_count}",
                    "access_token": new_token,
                },
            )
            pages_data = pages_resp.json().get("data", []) if pages_resp.status_code == 200 else []

            ig_accounts: list[dict[str, Any]] = []
            ig_tokens: dict[str, str] = {}
            for page in pages_data:
                page_token = page.get("access_token")
                ig_obj = page.get("instagram_business_account")
                if ig_obj and ig_obj.get("id"):
                    ig_id = str(ig_obj["id"])
                    ig_accounts.append(
                        {
                            "id": ig_id,
                            "username": ig_obj.get("username"),
                            "name": ig_obj.get("name"),
                            "page_id": page.get("id"),
                            "followers_count": ig_obj.get("followers_count", 0),
                        }
                    )
                    if page_token:
                        ig_tokens[ig_id] = encrypt_token(page_token) or ""

            meta = dict(account.account_metadata)
            meta["instagram_accounts"] = ig_accounts
            meta["ig_tokens"] = ig_tokens

            account.encrypted_access_token = encrypt_token(new_token)
            account.token_expires_at = datetime.now(UTC) + timedelta(days=60)
            account.account_metadata = meta
            account.status = "active"
            return account

        finally:
            if self._http_client is None:
                await client.aclose()

    async def revoke(self, account: ConnectedAccount) -> None:
        """
        Revoke permissions via DELETE /me/permissions.
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
            logger.warning("Error revoking Instagram permissions for %s: %s", account.id, exc)
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
            return [Issue(field="payload", message="Invalid variant payload format", severity="error")]

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

    async def publish(self, account: ConnectedAccount, variant: Any) -> PublishResult:
        """
        Two-step container publishing pipeline:
        Step 1: POST /{ig_user_id}/media (create container for image, Reel, or carousel).
        Step 2: POST /{ig_user_id}/media_publish (publish the container).
        """
        payload = getattr(variant, "payload", {})
        ig_user_id = (
            payload.get("target_id")
            or payload.get("ig_user_id")
            or payload.get("target")
            or account.account_metadata.get("primary_ig_id")
        )
        if not ig_user_id:
            return PublishResult(
                success=False,
                error_message="Cannot publish to Instagram: missing target account ID",
                is_retryable=False,
            )

        token = self._get_ig_token(account, str(ig_user_id))
        if not token:
            return PublishResult(
                success=False,
                error_message="Missing decrypted access token for Instagram account",
                is_retryable=False,
            )

        caption = payload.get("caption") or payload.get("text", "")
        media_type = payload.get("media_type") or ("REELS" if payload.get("video_url") else "IMAGE")

        client = await self._get_client()
        try:
            # ----------------------------------------------------
            # Step 1: Create Media Container
            # ----------------------------------------------------
            container_params: dict[str, Any] = {"access_token": token}
            media_urls = payload.get("media_urls", [])

            # Path A: Carousel (multiple items)
            if len(media_urls) > 1 or payload.get("children"):
                item_ids: list[str] = []
                for item_url in media_urls:
                    item_resp = await client.post(
                        f"{GRAPH_API_BASE}/{ig_user_id}/media",
                        data={
                            "image_url": item_url,
                            "is_carousel_item": "true",
                            "access_token": token,
                        },
                    )
                    if item_resp.status_code == 200:
                        item_ids.append(item_resp.json().get("id"))
                    else:
                        return PublishResult(
                            success=False,
                            error_message=f"Failed to create carousel item container: {item_resp.text}",
                            is_retryable=False,
                        )

                container_params.update(
                    {
                        "media_type": "CAROUSEL",
                        "children": ",".join(item_ids),
                        "caption": caption,
                    }
                )

            # Path B: Reel (Video)
            elif media_type.upper() in {"REELS", "VIDEO"} or payload.get("video_url"):
                container_params.update(
                    {
                        "media_type": "REELS",
                        "video_url": payload.get("video_url") or (media_urls[0] if media_urls else ""),
                        "caption": caption,
                    }
                )

            # Path C: Single Image
            else:
                image_url = payload.get("image_url") or (media_urls[0] if media_urls else "")
                container_params.update(
                    {
                        "image_url": image_url,
                        "caption": caption,
                    }
                )

            # Request container creation
            container_resp = await client.post(
                f"{GRAPH_API_BASE}/{ig_user_id}/media",
                data=container_params,
            )

            if container_resp.status_code != 200:
                is_retryable = container_resp.status_code in {429, 500, 502, 503, 504}
                return PublishResult(
                    success=False,
                    error_message=f"Failed to create Instagram container: {container_resp.text}",
                    raw_response={"status_code": container_resp.status_code, "body": container_resp.text},
                    is_retryable=is_retryable,
                )

            creation_id = container_resp.json().get("id")

            # ----------------------------------------------------
            # Step 2: Publish the Container
            # ----------------------------------------------------
            publish_resp = await client.post(
                f"{GRAPH_API_BASE}/{ig_user_id}/media_publish",
                data={
                    "creation_id": creation_id,
                    "access_token": token,
                },
            )

            if publish_resp.status_code != 200:
                is_retryable = publish_resp.status_code in {429, 500, 502, 503, 504}
                return PublishResult(
                    success=False,
                    error_message=f"Failed to publish Instagram container: {publish_resp.text}",
                    raw_response={"status_code": publish_resp.status_code, "body": publish_resp.text},
                    is_retryable=is_retryable,
                )

            pub_json = publish_resp.json()
            ig_media_id = pub_json.get("id", "")

            # Attempt to fetch published media permalink
            permalink_resp = await client.get(
                f"{GRAPH_API_BASE}/{ig_media_id}",
                params={"fields": "permalink", "access_token": token},
            )
            permalink = (
                permalink_resp.json().get("permalink")
                if permalink_resp.status_code == 200
                else f"https://www.instagram.com/p/{ig_media_id}/"
            )

            return PublishResult(
                success=True,
                external_post_id=ig_media_id,
                external_url=permalink,
                raw_response=pub_json,
            )

        except Exception as exc:  # noqa: BLE001
            logger.error("Network error in Instagram container pipeline for %s: %s", ig_user_id, exc)
            return PublishResult(
                success=False,
                error_message=f"Network error: {exc}",
                is_retryable=True,
            )
        finally:
            if self._http_client is None:
                await client.aclose()

    async def delete_post(self, account: ConnectedAccount, external_post_id: str) -> None:
        """
        Instagram Graph API does not provide an endpoint to delete published media for third-party apps.
        Logs an informative warning and completes gracefully.
        """
        logger.warning(
            "Instagram Graph API restricts automated deletion of published media %s.",
            external_post_id,
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
                params={"fields": "like_count,comments_count,media_type,permalink", "access_token": token},
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
            logger.warning("Failed to fetch Instagram metrics for %s: %s", external_post_id, media_resp.text)
            return Metrics()

        media_data = media_resp.json()
        likes = media_data.get("like_count", 0)
        comments = media_data.get("comments_count", 0)

        impressions = 0
        reach = 0
        saved = 0
        shares = 0

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

        impressions = impressions or reach or (likes + comments)

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
            logger.warning("Failed to fetch Instagram account stats for %s: %s", ig_user_id, user_resp.text)
            return AccountMetrics()

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
                if name == "impressions":
                    impressions = int(val)
                elif name == "profile_views":
                    profile_views = int(val)
                elif name == "reach":
                    reach = int(val)

        return AccountMetrics(
            followers_count=followers,
            following_count=follows,
            posts_count=media_count,
            impressions=impressions,
            reach=reach,
            profile_views=profile_views,
            extras={"username": data.get("username"), "name": data.get("name")},
        )
