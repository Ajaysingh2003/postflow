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

# Official Twitter / X OAuth 2.0 and API v2 URLs
X_AUTH_URL = "https://twitter.com/i/oauth2/authorize"
X_TOKEN_URL = "https://api.twitter.com/2/oauth2/token"
X_REVOKE_URL = "https://api.twitter.com/2/oauth2/revoke"
X_API_BASE = "https://api.twitter.com/2"

# Required OAuth 2.0 scopes for posting, metrics, and offline token refresh
X_SCOPES = ["tweet.read", "tweet.write", "users.read", "offline.access"]


class XAdapter:
    """
    Platform adapter for X (formerly Twitter) using official OAuth 2.0 with PKCE and API v2.
    """

    platform = "x"

    def __init__(
        self,
        client_id: str | None = None,
        client_secret: str | None = None,
        http_client: httpx.AsyncClient | None = None,
    ) -> None:
        settings = get_settings()
        self.client_id = client_id or settings.x_client_id or "x_client_id_placeholder"
        self.client_secret = client_secret or settings.x_client_secret
        self.redirect_base_url = settings.oauth_redirect_base_url
        self._http_client = http_client

        self.capabilities = Capabilities(
            platform=self.platform,
            display_name="X (Twitter)",
            max_text_length=280,
            text_length_type="characters",
            supports_media=True,
            supported_media_types=[
                "image/jpeg",
                "image/png",
                "image/webp",
                "image/gif",
                "video/mp4",
            ],
            max_media_count=4,
            supports_video=True,
            max_video_duration_seconds=140,
            supports_threads=True,
            supports_polls=True,
            supports_alt_text=True,
            max_alt_text_length=1000,
            supports_links=True,
            supports_tags=True,
            visibility_options=["public"],
            requires_target=False,
            supports_account_metrics=True,
            supports_scheduling=True,
        )

    async def _get_client(self) -> httpx.AsyncClient:
        if self._http_client is not None:
            return self._http_client
        return httpx.AsyncClient(timeout=30.0)

    async def build_auth_url(self, workspace_id: str, state: str, **opts: Any) -> AuthStart:
        """
        Build official X OAuth 2.0 authorization URL with PKCE (S256).
        """
        redirect_uri = opts.get("redirect_uri") or self.redirect_base_url
        code_challenge = opts.get("code_challenge")
        if not code_challenge:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="PKCE code_challenge is required for X OAuth 2.0",
            )

        params = {
            "response_type": "code",
            "client_id": self.client_id,
            "redirect_uri": redirect_uri,
            "scope": " ".join(X_SCOPES),
            "state": state,
            "code_challenge": code_challenge,
            "code_challenge_method": "S256",
        }
        auth_url = f"{X_AUTH_URL}?{urllib.parse.urlencode(params)}"
        return AuthStart(
            auth_url=auth_url,
            state=state,
            code_verifier=opts.get("code_verifier"),
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
        Exchange authorization code for access and refresh tokens, and fetch the user profile.
        """
        code = params.get("code")
        if not code:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Missing authorization code from X callback",
            )

        code_verifier = opts.get("code_verifier")
        if not code_verifier:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Missing PKCE code_verifier for X token exchange",
            )

        redirect_uri = opts.get("redirect_uri") or self.redirect_base_url

        data = {
            "code": code,
            "grant_type": "authorization_code",
            "client_id": self.client_id,
            "redirect_uri": redirect_uri,
            "code_verifier": code_verifier,
        }

        auth: tuple[str, str] | None = None
        if self.client_secret:
            auth = (self.client_id, self.client_secret)

        client = await self._get_client()
        try:
            token_resp = await client.post(
                X_TOKEN_URL,
                data=data,
                auth=auth,
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
        finally:
            if self._http_client is None:
                await client.aclose()

        if token_resp.status_code != 200:
            logger.error("X token exchange failed: %s %s", token_resp.status_code, token_resp.text)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"X token exchange failed: {token_resp.text}",
            )

        token_data = token_resp.json()
        access_token = token_data.get("access_token")
        refresh_token = token_data.get("refresh_token")
        expires_in = token_data.get("expires_in", 7200)
        granted_scope_str = token_data.get("scope", "")
        granted_scopes = granted_scope_str.split(" ") if granted_scope_str else X_SCOPES

        # Fetch authenticated user profile
        user_info = await self._fetch_user_me(access_token)

        external_id = user_info.get("id")
        name = user_info.get("name", "X User")
        username = user_info.get("username", "")

        return ConnectedAccount(
            workspace_id=workspace_id,
            platform=self.platform,
            external_account_id=str(external_id),
            display_name=f"{name} (@{username})" if username else name,
            account_type="profile",
            encrypted_access_token=encrypt_token(access_token),
            encrypted_refresh_token=encrypt_token(refresh_token),
            token_expires_at=datetime.now(UTC) + timedelta(seconds=expires_in),
            granted_scopes=granted_scopes,
            status="active",
            account_metadata={
                "username": username,
                "name": name,
                "profile_image_url": user_info.get("profile_image_url"),
                "public_metrics": user_info.get("public_metrics", {}),
            },
        )

    async def _fetch_user_me(self, access_token: str) -> dict[str, Any]:
        client = await self._get_client()
        try:
            resp = await client.get(
                f"{X_API_BASE}/users/me",
                headers={"Authorization": f"Bearer {access_token}"},
                params={"user.fields": "id,name,username,profile_image_url,public_metrics,description"},
            )
        finally:
            if self._http_client is None:
                await client.aclose()

        if resp.status_code != 200:
            logger.error("Failed to fetch X user profile: %s %s", resp.status_code, resp.text)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Failed to fetch X profile: {resp.text}",
            )

        return resp.json().get("data", {})

    async def refresh_tokens(self, account: ConnectedAccount) -> ConnectedAccount:
        """
        Refresh an expired X access token using the stored refresh token.
        """
        raw_refresh = decrypt_token(account.encrypted_refresh_token)
        if not raw_refresh:
            raise ValueError(f"Account {account.id} has no refresh token to refresh")

        data = {
            "grant_type": "refresh_token",
            "refresh_token": raw_refresh,
            "client_id": self.client_id,
        }

        auth: tuple[str, str] | None = None
        if self.client_secret:
            auth = (self.client_id, self.client_secret)

        client = await self._get_client()
        try:
            resp = await client.post(
                X_TOKEN_URL,
                data=data,
                auth=auth,
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
        finally:
            if self._http_client is None:
                await client.aclose()

        if resp.status_code != 200:
            logger.error("X token refresh failed: %s %s", resp.status_code, resp.text)
            raise RuntimeError(f"X token refresh failed with HTTP {resp.status_code}: {resp.text}")

        token_data = resp.json()
        new_access = token_data.get("access_token")
        new_refresh = token_data.get("refresh_token") or raw_refresh
        expires_in = token_data.get("expires_in", 7200)

        account.encrypted_access_token = encrypt_token(new_access)
        account.encrypted_refresh_token = encrypt_token(new_refresh)
        account.token_expires_at = datetime.now(UTC) + timedelta(seconds=expires_in)
        account.status = "active"
        return account

    async def revoke(self, account: ConnectedAccount) -> None:
        """
        Revoke active token with X.
        """
        raw_access = decrypt_token(account.encrypted_access_token)
        if not raw_access:
            return

        data = {
            "token": raw_access,
            "token_type_hint": "access_token",
            "client_id": self.client_id,
        }

        auth: tuple[str, str] | None = None
        if self.client_secret:
            auth = (self.client_id, self.client_secret)

        client = await self._get_client()
        try:
            await client.post(
                X_REVOKE_URL,
                data=data,
                auth=auth,
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
        except Exception as exc:  # noqa: BLE001
            logger.warning("Error revoking token with X for %s: %s", account.id, exc)
        finally:
            if self._http_client is None:
                await client.aclose()

    async def list_targets(self, account: ConnectedAccount) -> list[Target]:
        """X does not use sub-targets (posts go directly to the authenticated handle)."""
        return []

    async def validate(self, variant: Any) -> list[Issue]:
        """
        Validate post text and media constraints against X limits.
        """
        issues: list[Issue] = []
        payload = getattr(variant, "payload", {})
        if not isinstance(payload, dict):
            return [Issue(field="payload", message="Invalid variant payload format", severity="error")]

        text = payload.get("text", "")
        if not text and not payload.get("media_ids"):
            issues.append(Issue(field="text", message="Tweet must contain text or media", severity="error"))

        # Check character limit (280 characters standard)
        if len(text) > self.capabilities.max_text_length:
            issues.append(
                Issue(
                    field="text",
                    message=f"Tweet length ({len(text)}) exceeds maximum of {self.capabilities.max_text_length} characters",
                    severity="error",
                    code="text_too_long",
                )
            )

        media_ids = payload.get("media_ids", [])
        if len(media_ids) > self.capabilities.max_media_count:
            issues.append(
                Issue(
                    field="media_ids",
                    message=f"A maximum of {self.capabilities.max_media_count} media items can be attached to a tweet",
                    severity="error",
                    code="too_many_media",
                )
            )

        return issues

    async def publish(self, account: ConnectedAccount, variant: Any) -> PublishResult:
        """
        Publish a post or thread item to X using POST /2/tweets.
        """
        raw_access = decrypt_token(account.encrypted_access_token)
        if not raw_access:
            return PublishResult(
                success=False,
                error_message="Missing decrypted access token",
                is_retryable=False,
            )

        payload = getattr(variant, "payload", {})
        body: dict[str, Any] = {"text": payload.get("text", "")}

        media_ids = payload.get("media_ids")
        if media_ids:
            body["media"] = {"media_ids": [str(m) for m in media_ids]}

        reply_to = payload.get("in_reply_to_tweet_id")
        if reply_to:
            body["reply"] = {"in_reply_to_tweet_id": str(reply_to)}

        client = await self._get_client()
        try:
            resp = await client.post(
                f"{X_API_BASE}/tweets",
                json=body,
                headers={
                    "Authorization": f"Bearer {raw_access}",
                    "Content-Type": "application/json",
                },
            )
        except Exception as exc:  # noqa: BLE001
            logger.error("Network error publishing to X: %s", exc)
            return PublishResult(
                success=False,
                error_message=f"Network error: {exc}",
                is_retryable=True,
            )
        finally:
            if self._http_client is None:
                await client.aclose()

        if resp.status_code == 201:
            data = resp.json().get("data", {})
            tweet_id = str(data.get("id"))
            return PublishResult(
                success=True,
                external_post_id=tweet_id,
                external_url=f"https://x.com/i/web/status/{tweet_id}",
                raw_response=resp.json(),
            )

        # Handle rate limits and transient errors
        is_retryable = resp.status_code in {429, 500, 502, 503, 504}
        error_msg = f"X API error (HTTP {resp.status_code}): {resp.text}"
        logger.warning("X tweet publish failed: %s", error_msg)

        return PublishResult(
            success=False,
            error_message=error_msg,
            raw_response={"status_code": resp.status_code, "body": resp.text},
            is_retryable=is_retryable,
        )

    async def delete_post(self, account: ConnectedAccount, external_post_id: str) -> None:
        """
        Delete a tweet using DELETE /2/tweets/:id.
        """
        raw_access = decrypt_token(account.encrypted_access_token)
        if not raw_access:
            raise ValueError("Missing decrypted access token")

        client = await self._get_client()
        try:
            resp = await client.delete(
                f"{X_API_BASE}/tweets/{external_post_id}",
                headers={"Authorization": f"Bearer {raw_access}"},
            )
        finally:
            if self._http_client is None:
                await client.aclose()

        if resp.status_code not in {200, 404}:
            logger.warning("Failed to delete X tweet %s: %s", external_post_id, resp.text)
            raise RuntimeError(f"Failed to delete tweet (HTTP {resp.status_code}): {resp.text}")

    async def fetch_metrics(self, account: ConnectedAccount, external_post_id: str) -> Metrics:
        """
        Fetch post-level metrics for a tweet using GET /2/tweets/:id.
        """
        raw_access = decrypt_token(account.encrypted_access_token)
        if not raw_access:
            raise ValueError("Missing decrypted access token")

        client = await self._get_client()
        try:
            resp = await client.get(
                f"{X_API_BASE}/tweets/{external_post_id}",
                headers={"Authorization": f"Bearer {raw_access}"},
                params={"tweet.fields": "public_metrics,non_public_metrics,organic_metrics"},
            )
        finally:
            if self._http_client is None:
                await client.aclose()

        if resp.status_code != 200:
            logger.warning("Failed to fetch X tweet metrics for %s: %s", external_post_id, resp.text)
            return Metrics()

        data = resp.json().get("data", {})
        pub = data.get("public_metrics", {})
        org = data.get("organic_metrics", {})

        impressions = org.get("impression_count") or pub.get("impression_count", 0)
        likes = pub.get("like_count", 0)
        retweets = pub.get("retweet_count", 0)
        quotes = pub.get("quote_count", 0)
        replies = pub.get("reply_count", 0)
        clicks = org.get("url_link_clicks", 0)

        total_engagements = likes + retweets + quotes + replies + clicks

        return Metrics(
            impressions=impressions,
            reach=impressions,
            engagements=total_engagements,
            likes=likes,
            comments=replies,
            shares_reposts=retweets + quotes,
            clicks=clicks,
            extras={
                "bookmark_count": pub.get("bookmark_count", 0),
                "quote_count": quotes,
                "user_profile_clicks": org.get("user_profile_clicks", 0),
            },
        )

    async def fetch_account_metrics(self, account: ConnectedAccount) -> AccountMetrics:
        """
        Fetch whole-account metrics from the original X API (GET /2/users/me).
        """
        raw_access = decrypt_token(account.encrypted_access_token)
        if not raw_access:
            raise ValueError("Missing decrypted access token")

        client = await self._get_client()
        try:
            resp = await client.get(
                f"{X_API_BASE}/users/me",
                headers={"Authorization": f"Bearer {raw_access}"},
                params={"user.fields": "public_metrics"},
            )
        finally:
            if self._http_client is None:
                await client.aclose()

        if resp.status_code != 200:
            logger.warning("Failed to fetch X account metrics for %s: %s", account.id, resp.text)
            return AccountMetrics()

        data = resp.json().get("data", {})
        pub = data.get("public_metrics", {})

        return AccountMetrics(
            followers_count=pub.get("followers_count", 0),
            following_count=pub.get("following_count", 0),
            posts_count=pub.get("tweet_count", 0),
            extras={"listed_count": pub.get("listed_count", 0)},
        )
