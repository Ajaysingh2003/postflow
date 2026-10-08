import hashlib
import logging
import re
from datetime import UTC, datetime
from typing import Any

import httpx
import regex

from app.core.config import get_settings
from app.modules.channels.adapters.management import BlueskyManagement
from app.modules.channels.base import (
    AccountMetrics,
    Capabilities,
    Issue,
    Metrics,
    PublishResult,
    Target,
)
from app.modules.channels.models import ConnectedAccount
from app.modules.channels.oauth import decrypt_token

logger = logging.getLogger(__name__)

BSKY_PUBLIC_API = "https://bsky.social/xrpc"
BSKY_APP_URL = "https://bsky.app"

# URL and Hashtag regex patterns
URL_REGEX = re.compile(r"https?://[^\s<>\"']+", re.IGNORECASE)
TAG_REGEX = regex.compile(r"(?<!\w)#([\p{L}\p{N}\p{M}_\-]+)")
MENTION_REGEX = re.compile(r"@([a-zA-Z0-9\.\-]+)", re.UNICODE)


def count_graphemes(text: str) -> int:
    from app.modules.channels.adapters.text import graphemes

    return graphemes(text)


def extract_facets(
    text: str, resolved_mentions: dict[str, str] | None = None
) -> list[dict[str, Any]]:
    """
    Extract rich-text facets (links, mentions, tags) with exact UTF-8 byte ranges.
    Required by AT Protocol app.bsky.feed.post lexicon.
    """
    resolved_mentions = resolved_mentions or {}
    facets: list[dict[str, Any]] = []
    if not text:
        return facets

    occupied = []
    for pattern, kind in ((URL_REGEX, "link"), (MENTION_REGEX, "mention"), (TAG_REGEX, "tag")):
        for match in pattern.finditer(text):
            start, end = match.span()
            value = match.group(0) if kind == "link" else match.group(1)
            if kind in {"link", "mention"}:
                value = value.rstrip(".,!?;:")
                end = start + len(value) + (kind == "mention")
            if any(start < old_end and end > old_start for old_start, old_end in occupied):
                continue
            if kind == "mention" and value not in resolved_mentions:
                continue
            if kind == "tag" and count_graphemes(value) > 64:
                continue
            field = {"link": "uri", "mention": "did", "tag": "tag"}[kind]
            feature = {
                "$type": "app.bsky.feed.post#" + kind,
                field: resolved_mentions[value] if kind == "mention" else value,
            }
            facets.append(
                {
                    "index": {
                        "byteStart": len(text[:start].encode("utf-8")),
                        "byteEnd": len(text[:end].encode("utf-8")),
                    },
                    "features": [feature],
                }
            )
            occupied.append((start, end))
    return sorted(facets, key=lambda f: f["index"]["byteStart"])


from app.modules.channels.adapters.bluesky_oauth import BlueskyOAuth


class BlueskyAdapter(BlueskyOAuth, BlueskyManagement):
    """
    Platform adapter for Bluesky and the AT Protocol.
    Supports official AT Protocol OAuth with PKCE, PAR and DPoP,
    grapheme cluster validation (300 grapheme limit), and rich-text facet generation.
    """

    from app.modules.channels.adapters.analytics_posts import bluesky_posts as fetch_analytics_posts

    platform = "bluesky"

    def __init__(
        self,
        client_id: str | None = None,
        pds_url: str | None = None,
        http_client: httpx.AsyncClient | None = None,
    ) -> None:
        settings = get_settings()
        self.client_id = (
            client_id
            or settings.bluesky_client_id
            or "https://postflow.ai/api/v1/channels/bluesky/client-metadata"
        )
        self.pds_url = (pds_url or BSKY_PUBLIC_API).rstrip("/xrpc").rstrip("/")
        self.xrpc_url = f"{self.pds_url}/xrpc"
        self.redirect_base_url = settings.oauth_callback_url(self.platform)
        self._http_client = http_client

        self.capabilities = Capabilities(
            platform=self.platform,
            display_name="Bluesky",
            max_text_length=300,
            text_length_type="graphemes",
            supports_media=True,
            supported_media_types=["image/jpeg", "image/png", "image/webp"],
            max_media_count=4,
            supports_video=False,
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

    from app.modules.channels.adapters.media import upload_bluesky as prepare_media

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
            return [
                Issue(field="payload", message="Invalid variant payload format", severity="error")
            ]

        if "thread" in payload:
            from app.modules.channels.adapters.threading import validate_thread

            return await validate_thread(self, variant)
        text = payload.get("text", "")
        if not text and not payload.get("media_blobs"):
            issues.append(
                Issue(field="text", message="Bluesky post cannot be empty", severity="error")
            )

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

        if len(text.encode("utf-8")) > 3000:
            issues.append(
                Issue(
                    field="text",
                    message="Bluesky text exceeds 3000 UTF-8 bytes",
                    code="byte_limit_exceeded",
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
        if "thread" in variant.payload:
            from app.modules.channels.adapters.threading import publish_thread

            return await publish_thread(
                self,
                account,
                variant,
                lambda rows: (
                    {
                        "reply": {
                            "root": {"uri": rows[0]["id"], "cid": rows[0]["response"]["cid"]},
                            "parent": {"uri": rows[-1]["id"], "cid": rows[-1]["response"]["cid"]},
                        }
                    }
                    if rows
                    else {}
                ),
            )
        raw_access = decrypt_token(account.encrypted_access_token)
        if not raw_access:
            return PublishResult(
                success=False,
                error_message="Missing decrypted Bluesky access token",
                is_retryable=False,
            )

        payload = getattr(variant, "payload", {})
        text = payload.get("text", "")
        facets = payload.get("facets") or await self.resolve_facets(account, text)
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
            "rkey": hashlib.sha256(variant.idempotency_key.encode()).hexdigest()[:48]
            if getattr(variant, "idempotency_key", None)
            else None,
            "repo": did,
            "collection": "app.bsky.feed.post",
            "record": record,
        }

        client = await self._get_client()
        try:
            resp = await self._oauth_request(
                client,
                "POST",
                f"{account.account_metadata.get('pds_url', self.pds_url)}/xrpc/com.atproto.repo.createRecord",
                json=body,
                account=account,
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
                outcome_unknown=isinstance(exc, httpx.TransportError),
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

        is_retryable = resp.status_code == 429
        error_msg = f"Bluesky API error (HTTP {resp.status_code}): {resp.text}"
        logger.warning("Bluesky publish failed: %s", error_msg)

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
            resp = await self._oauth_request(
                client,
                "POST",
                f"{account.account_metadata.get('pds_url', self.pds_url)}/xrpc/com.atproto.repo.deleteRecord",
                json={
                    "repo": did,
                    "collection": "app.bsky.feed.post",
                    "rkey": rkey,
                },
                account=account,
                headers={"Authorization": f"Bearer {raw_access}"},
            )
        finally:
            if self._http_client is None:
                await client.aclose()

        if resp.status_code not in {200, 404}:
            logger.warning("Failed to delete Bluesky post %s: %s", external_post_id, resp.text)
            raise RuntimeError(
                f"Failed to delete Bluesky post (HTTP {resp.status_code}): {resp.text}"
            )

    async def fetch_metrics(
        self,
        account: ConnectedAccount,
        external_post_id: str,
        context: dict[str, Any] | None = None,
    ) -> Metrics:
        """
        Fetch post thread view for like, repost, reply, and quote counts.
        """
        raw_access = decrypt_token(account.encrypted_access_token)
        if not raw_access:
            raise ValueError("Missing decrypted access token")

        client = await self._get_client()
        try:
            resp = await self._oauth_request(
                client,
                "GET",
                f"{account.account_metadata.get('pds_url', self.pds_url)}/xrpc/app.bsky.feed.getPostThread",
                params={"uri": external_post_id, "depth": 0},
                account=account,
                headers={"Authorization": f"Bearer {raw_access}"},
            )
        finally:
            if self._http_client is None:
                await client.aclose()

        if resp.status_code != 200:
            logger.warning(
                "Failed to fetch Bluesky metrics for %s: %s", external_post_id, resp.text
            )
            raise RuntimeError("Metrics request failed or is unsupported")

        thread_data = resp.json().get("thread", {})
        post_view = thread_data.get("post", {})

        likes = post_view.get("likeCount", 0)
        reposts = post_view.get("repostCount", 0)
        replies = post_view.get("replyCount", 0)
        quotes = post_view.get("quoteCount", 0)

        total_engagements = likes + reposts + replies + quotes

        return Metrics(
            impressions=0,
            reach=0,
            engagements=total_engagements,
            likes=likes,
            comments=replies,
            shares_reposts=reposts + quotes,
            extras={
                "quoteCount": quotes,
                "cid": post_view.get("cid"),
                "unavailable_metrics": ["impressions", "reach", "clicks"],
                "metrics_status": "partial",
                "available_metrics": ["likes", "comments", "shares", "engagements"],
                "metrics_notice": "This platform provides interactions, but does not expose views, reach or clicks.",
            },
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
            resp = await self._oauth_request(
                client,
                "GET",
                f"{account.account_metadata.get('pds_url', self.pds_url)}/xrpc/app.bsky.actor.getProfile",
                params={"actor": did},
                account=account,
                headers={"Authorization": f"Bearer {raw_access}"},
            )
        finally:
            if self._http_client is None:
                await client.aclose()

        if resp.status_code != 200:
            logger.warning("Failed to fetch Bluesky account metrics for %s: %s", did, resp.text)
            raise RuntimeError("Account metrics request failed or is unsupported")

        profile = resp.json()
        followers = profile.get("followersCount", 0)
        follows = profile.get("followsCount", 0)
        posts_count = profile.get("postsCount", 0)

        return AccountMetrics(
            followers_count=followers,
            following_count=follows,
            posts_count=posts_count,
            extras={
                "metrics_status": "partial",
                "available_metrics": [
                    name
                    for name, key in {
                        "followers_count": "followersCount",
                        "following_count": "followsCount",
                        "posts_count": "postsCount",
                    }.items()
                    if key in profile
                ],
                "handle": profile.get("handle"),
                "indexedAt": profile.get("indexedAt"),
            },
        )

    async def resolve_facets(self, account, text):
        client = await self._get_client()
        resolved = {}
        try:
            for handle in set(re.findall(r"@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})", text)):
                response = await self._oauth_request(
                    client,
                    "GET",
                    account.account_metadata.get("pds_url", self.pds_url)
                    + "/xrpc/com.atproto.identity.resolveHandle",
                    account=account,
                    params={"handle": handle},
                )
                response.raise_for_status()
                resolved[handle] = response.json()["did"]
            return extract_facets(text, resolved)
        finally:
            if self._http_client is None:
                await client.aclose()
