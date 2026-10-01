import logging
import re
import unicodedata
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

BSKY_PUBLIC_API = "https://bsky.social/xrpc"
BSKY_APP_URL = "https://bsky.app"

# URL and Hashtag regex patterns
URL_REGEX = re.compile(r"https?://[^\s<>\"']+", re.IGNORECASE)
TAG_REGEX = re.compile(r"#([a-zA-Z0-9_\-]+)", re.UNICODE)
MENTION_REGEX = re.compile(r"@([a-zA-Z0-9\.\-]+)", re.UNICODE)


def count_graphemes(text: str) -> int:
    """
    Count Unicode Grapheme Clusters for Bluesky text validation (max 300 graphemes).
    """
    normalized = unicodedata.normalize("NFD", text)
    count = 0
    for char in normalized:
        # Combining marks modify the preceding character rather than starting a new grapheme cluster
        if not unicodedata.category(char).startswith("M"):
            count += 1
    return count


def extract_facets(text: str) -> list[dict[str, Any]]:
    """
    Extract rich-text facets (links, mentions, tags) with exact UTF-8 byte ranges.
    Required by AT Protocol app.bsky.feed.post lexicon.
    """
    facets: list[dict[str, Any]] = []
    if not text:
        return facets

    # 1. Links
    for match in URL_REGEX.finditer(text):
        url = match.group(0)
        start_char, end_char = match.span()
        byte_start = len(text[:start_char].encode("utf-8"))
        byte_end = len(text[:end_char].encode("utf-8"))
        facets.append(
            {
                "index": {"byteStart": byte_start, "byteEnd": byte_end},
                "features": [{"$type": "app.bsky.feed.post#link", "uri": url}],
            }
        )

    # 2. Hashtags
    for match in TAG_REGEX.finditer(text):
        tag_text = match.group(1)
        start_char, end_char = match.span()
        byte_start = len(text[:start_char].encode("utf-8"))
        byte_end = len(text[:end_char].encode("utf-8"))
        facets.append(
            {
                "index": {"byteStart": byte_start, "byteEnd": byte_end},
                "features": [{"$type": "app.bsky.feed.post#tag", "tag": tag_text}],
            }
        )

    # 3. Mentions
    for match in MENTION_REGEX.finditer(text):
        handle = match.group(1)
        start_char, end_char = match.span()
        byte_start = len(text[:start_char].encode("utf-8"))
        byte_end = len(text[:end_char].encode("utf-8"))
        # In ATProto, mention features can reference the handle or resolved DID
        facets.append(
            {
                "index": {"byteStart": byte_start, "byteEnd": byte_end},
                "features": [{"$type": "app.bsky.feed.post#mention", "did": f"did:web:{handle}"}],
            }
        )

    return facets


class BlueskyAdapter:
    """
    Platform adapter for Bluesky and the AT Protocol.
    Supports official AT Protocol OAuth flow and App Password sessions,
    grapheme cluster validation (300 grapheme limit), and rich-text facet generation.
    """

    platform = "bluesky"

    def __init__(
        self,
        client_id: str | None = None,
        pds_url: str | None = None,
        http_client: httpx.AsyncClient | None = None,
    ) -> None:
        settings = get_settings()
        self.client_id = client_id or settings.bluesky_client_id or "https://postflow.ai/oauth/client-metadata.json"
        self.pds_url = (pds_url or BSKY_PUBLIC_API).rstrip("/xrpc").rstrip("/")
        self.xrpc_url = f"{self.pds_url}/xrpc"
        self.redirect_base_url = settings.oauth_redirect_base_url
        self._http_client = http_client

        self.capabilities = Capabilities(
            platform=self.platform,
            display_name="Bluesky",
            max_text_length=300,
            text_length_type="graphemes",
            supports_media=True,
            supported_media_types=["image/jpeg", "image/png", "image/webp"],
            max_media_count=4,
            supports_video=True,
            max_video_duration_seconds=60,
            supports_threads=True,
            supports_polls=False,
            supports_alt_text=True,
            max_alt_text_length=2000,
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
        Build authorization URL for Bluesky.
        Supports official AT Protocol OAuth authorization server endpoints.
        """
        redirect_uri = opts.get("redirect_uri") or self.redirect_base_url
        code_challenge = opts.get("code_challenge")

        params = {
            "client_id": self.client_id,
            "response_type": "code",
            "redirect_uri": redirect_uri,
            "state": state,
            "scope": "atproto transition:generic",
        }
        if code_challenge:
            params["code_challenge"] = code_challenge
            params["code_challenge_method"] = "S256"

        auth_url = f"https://bsky.social/oauth/authorize?{urllib.parse.urlencode(params)}"
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
        Process authentication.
        Supports both:
        1. AT Protocol OAuth code exchange.
        2. Direct App Password session creation via com.atproto.server.createSession.
        """
        code = params.get("code")
        identifier = params.get("identifier") or params.get("username")
        password = params.get("password") or params.get("app_password")

        client = await self._get_client()
        try:
            # Path A: Direct App Password session creation
            if identifier and password:
                resp = await client.post(
                    f"{self.xrpc_url}/com.atproto.server.createSession",
                    json={"identifier": identifier, "password": password},
                )
                if resp.status_code != 200:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Bluesky authentication failed: {resp.text}",
                    )
                session_data = resp.json()
                access_token = session_data.get("accessJwt")
                refresh_token = session_data.get("refreshJwt")
                did = session_data.get("did")
                handle = session_data.get("handle", identifier)

            # Path B: OAuth Token Exchange
            elif code:
                redirect_uri = opts.get("redirect_uri") or self.redirect_base_url
                token_data = {
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": redirect_uri,
                    "client_id": self.client_id,
                }
                if opts.get("code_verifier"):
                    token_data["code_verifier"] = opts["code_verifier"]

                resp = await client.post(
                    f"{self.pds_url}/oauth/token",
                    data=token_data,
                    headers={"Content-Type": "application/x-www-form-urlencoded"},
                )
                if resp.status_code != 200:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Bluesky OAuth token exchange failed: {resp.text}",
                    )
                payload = resp.json()
                access_token = payload.get("access_token")
                refresh_token = payload.get("refresh_token")
                did = payload.get("sub", "")
                handle = payload.get("sub", did)
            else:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Missing authorization code or credentials for Bluesky connection",
                )

            # Fetch actor profile for display name and avatar
            profile_resp = await client.get(
                f"{self.xrpc_url}/app.bsky.actor.getProfile",
                params={"actor": did},
                headers={"Authorization": f"Bearer {access_token}"},
            )
            profile_data = profile_resp.json() if profile_resp.status_code == 200 else {}
            display_name = profile_data.get("displayName") or handle
            avatar = profile_data.get("avatar")

        finally:
            if self._http_client is None:
                await client.aclose()

        return ConnectedAccount(
            workspace_id=workspace_id,
            platform=self.platform,
            external_account_id=did,
            display_name=f"{display_name} (@{handle})",
            account_type="profile",
            encrypted_access_token=encrypt_token(access_token),
            encrypted_refresh_token=encrypt_token(refresh_token),
            token_expires_at=datetime.now(UTC) + timedelta(hours=2),
            granted_scopes=["atproto"],
            status="active",
            account_metadata={
                "did": did,
                "handle": handle,
                "display_name": display_name,
                "avatar": avatar,
            },
        )

    async def refresh_tokens(self, account: ConnectedAccount) -> ConnectedAccount:
        """
        Refresh session using com.atproto.server.refreshSession.
        """
        raw_refresh = decrypt_token(account.encrypted_refresh_token)
        if not raw_refresh:
            raise ValueError(f"Bluesky account {account.id} has no refresh token")

        client = await self._get_client()
        try:
            resp = await client.post(
                f"{self.xrpc_url}/com.atproto.server.refreshSession",
                headers={"Authorization": f"Bearer {raw_refresh}"},
            )
        finally:
            if self._http_client is None:
                await client.aclose()

        if resp.status_code != 200:
            logger.error("Bluesky session refresh failed: %s %s", resp.status_code, resp.text)
            raise RuntimeError(f"Bluesky session refresh failed (HTTP {resp.status_code}): {resp.text}")

        session_data = resp.json()
        new_access = session_data.get("accessJwt")
        new_refresh = session_data.get("refreshJwt") or raw_refresh

        account.encrypted_access_token = encrypt_token(new_access)
        account.encrypted_refresh_token = encrypt_token(new_refresh)
        account.token_expires_at = datetime.now(UTC) + timedelta(hours=2)
        account.status = "active"
        return account

    async def revoke(self, account: ConnectedAccount) -> None:
        """
        Delete session via com.atproto.server.deleteSession.
        """
        raw_refresh = decrypt_token(account.encrypted_refresh_token)
        if not raw_refresh:
            return

        client = await self._get_client()
        try:
            await client.post(
                f"{self.xrpc_url}/com.atproto.server.deleteSession",
                headers={"Authorization": f"Bearer {raw_refresh}"},
            )
        except Exception as exc:  # noqa: BLE001
            logger.warning("Error deleting Bluesky session for %s: %s", account.id, exc)
        finally:
            if self._http_client is None:
                await client.aclose()

    async def list_targets(self, account: ConnectedAccount) -> list[Target]:
        """Bluesky posts directly to the user repository; no sub-targets."""
        return []

    async def validate(self, variant: Any) -> list[Issue]:
        """
        Validate post length in Unicode graphemes (maximum 300 graphemes) and media count.
        """
        issues: list[Issue] = []
        payload = getattr(variant, "payload", {})
        if not isinstance(payload, dict):
            return [Issue(field="payload", message="Invalid variant payload format", severity="error")]

        text = payload.get("text", "")
        if not text and not payload.get("media_blobs"):
            issues.append(Issue(field="text", message="Bluesky post cannot be empty", severity="error"))

        grapheme_count = count_graphemes(text)
        if grapheme_count > self.capabilities.max_text_length:
            issues.append(
                Issue(
                    field="text",
                    message=f"Post text ({grapheme_count} graphemes) exceeds maximum 300 grapheme limit",
                    severity="error",
                    code="grapheme_limit_exceeded",
                )
            )

        media_blobs = payload.get("media_blobs", [])
        if len(media_blobs) > self.capabilities.max_media_count:
            issues.append(
                Issue(
                    field="media_blobs",
                    message=f"Maximum {self.capabilities.max_media_count} images allowed per Bluesky post",
                    severity="error",
                    code="too_many_media",
                )
            )

        return issues

    async def publish(self, account: ConnectedAccount, variant: Any) -> PublishResult:
        """
        Publish post using com.atproto.repo.createRecord with app.bsky.feed.post lexicon.
        Automatically attaches rich text facets and language tags.
        """
        raw_access = decrypt_token(account.encrypted_access_token)
        if not raw_access:
            return PublishResult(
                success=False,
                error_message="Missing decrypted Bluesky access token",
                is_retryable=False,
            )

        payload = getattr(variant, "payload", {})
        text = payload.get("text", "")
        facets = payload.get("facets") or extract_facets(text)
        langs = payload.get("langs", ["en"])
        created_at = datetime.now(UTC).isoformat().replace("+00:00", "Z")

        record: dict[str, Any] = {
            "$type": "app.bsky.feed.post",
            "text": text,
            "createdAt": created_at,
            "langs": langs,
        }
        if facets:
            record["facets"] = facets

        # In-reply-to thread support
        reply = payload.get("reply")
        if reply:
            record["reply"] = reply

        # Media embed support
        media_blobs = payload.get("media_blobs")
        if media_blobs:
            record["embed"] = {
                "$type": "app.bsky.embed.images",
                "images": [
                    {
                        "image": b.get("blob"),
                        "alt": b.get("alt", ""),
                    }
                    for b in media_blobs
                ],
            }

        did = account.account_metadata.get("did") or account.external_account_id
        body = {
            "repo": did,
            "collection": "app.bsky.feed.post",
            "record": record,
        }

        client = await self._get_client()
        try:
            resp = await client.post(
                f"{self.xrpc_url}/com.atproto.repo.createRecord",
                json=body,
                headers={
                    "Authorization": f"Bearer {raw_access}",
                    "Content-Type": "application/json",
                },
            )
        except Exception as exc:  # noqa: BLE001
            logger.error("Network error publishing to Bluesky: %s", exc)
            return PublishResult(
                success=False,
                error_message=f"Network error: {exc}",
                is_retryable=True,
            )
        finally:
            if self._http_client is None:
                await client.aclose()

        if resp.status_code == 200:
            data = resp.json()
            uri = data.get("uri", "")  # at://did:plc:.../app.bsky.feed.post/{rkey}
            rkey = uri.split("/")[-1] if uri else ""
            handle = account.account_metadata.get("handle") or did
            external_url = f"{BSKY_APP_URL}/profile/{handle}/post/{rkey}"

            return PublishResult(
                success=True,
                external_post_id=uri,
                external_url=external_url,
                raw_response=data,
            )

        is_retryable = resp.status_code in {429, 500, 502, 503, 504}
        error_msg = f"Bluesky API error (HTTP {resp.status_code}): {resp.text}"
        logger.warning("Bluesky publish failed: %s", error_msg)

        return PublishResult(
            success=False,
            error_message=error_msg,
            raw_response={"status_code": resp.status_code, "body": resp.text},
            is_retryable=is_retryable,
        )

    async def delete_post(self, account: ConnectedAccount, external_post_id: str) -> None:
        """
        Delete post via com.atproto.repo.deleteRecord.
        """
        raw_access = decrypt_token(account.encrypted_access_token)
        if not raw_access:
            raise ValueError("Missing decrypted access token")

        # external_post_id is the at:// URI or rkey
        rkey = external_post_id.split("/")[-1]
        did = account.account_metadata.get("did") or account.external_account_id

        client = await self._get_client()
        try:
            resp = await client.post(
                f"{self.xrpc_url}/com.atproto.repo.deleteRecord",
                json={
                    "repo": did,
                    "collection": "app.bsky.feed.post",
                    "rkey": rkey,
                },
                headers={"Authorization": f"Bearer {raw_access}"},
            )
        finally:
            if self._http_client is None:
                await client.aclose()

        if resp.status_code not in {200, 404}:
            logger.warning("Failed to delete Bluesky post %s: %s", external_post_id, resp.text)
            raise RuntimeError(f"Failed to delete Bluesky post (HTTP {resp.status_code}): {resp.text}")

    async def fetch_metrics(self, account: ConnectedAccount, external_post_id: str) -> Metrics:
        """
        Fetch post thread view for like, repost, reply, and quote counts.
        """
        raw_access = decrypt_token(account.encrypted_access_token)
        if not raw_access:
            raise ValueError("Missing decrypted access token")

        client = await self._get_client()
        try:
            resp = await client.get(
                f"{self.xrpc_url}/app.bsky.feed.getPostThread",
                params={"uri": external_post_id, "depth": 0},
                headers={"Authorization": f"Bearer {raw_access}"},
            )
        finally:
            if self._http_client is None:
                await client.aclose()

        if resp.status_code != 200:
            logger.warning("Failed to fetch Bluesky metrics for %s: %s", external_post_id, resp.text)
            return Metrics()

        thread_data = resp.json().get("thread", {})
        post_view = thread_data.get("post", {})

        likes = post_view.get("likeCount", 0)
        reposts = post_view.get("repostCount", 0)
        replies = post_view.get("replyCount", 0)
        quotes = post_view.get("quoteCount", 0)

        total_engagements = likes + reposts + replies + quotes

        return Metrics(
            impressions=total_engagements,
            reach=total_engagements,
            engagements=total_engagements,
            likes=likes,
            comments=replies,
            shares_reposts=reposts + quotes,
            extras={"quoteCount": quotes, "cid": post_view.get("cid")},
        )

    async def fetch_account_metrics(self, account: ConnectedAccount) -> AccountMetrics:
        """
        Fetch whole-account follower and post statistics from original Bluesky source.
        """
        raw_access = decrypt_token(account.encrypted_access_token)
        if not raw_access:
            raise ValueError("Missing decrypted access token")

        did = account.account_metadata.get("did") or account.external_account_id

        client = await self._get_client()
        try:
            resp = await client.get(
                f"{self.xrpc_url}/app.bsky.actor.getProfile",
                params={"actor": did},
                headers={"Authorization": f"Bearer {raw_access}"},
            )
        finally:
            if self._http_client is None:
                await client.aclose()

        if resp.status_code != 200:
            logger.warning("Failed to fetch Bluesky account metrics for %s: %s", did, resp.text)
            return AccountMetrics()

        profile = resp.json()
        followers = profile.get("followersCount", 0)
        follows = profile.get("followsCount", 0)
        posts_count = profile.get("postsCount", 0)

        return AccountMetrics(
            followers_count=followers,
            following_count=follows,
            posts_count=posts_count,
            extras={
                "handle": profile.get("handle"),
                "indexedAt": profile.get("indexedAt"),
            },
        )
