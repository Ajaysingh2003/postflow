import logging
import urllib.parse
from datetime import UTC, datetime, timedelta
from typing import Any

import httpx
from fastapi import HTTPException, status

from app.core.config import get_settings
from app.modules.channels.adapters.management import LinkedInManagement
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

# LinkedIn OAuth 2.0 and API URLs
LINKEDIN_AUTH_URL = "https://www.linkedin.com/oauth/v2/authorization"
LINKEDIN_TOKEN_URL = "https://www.linkedin.com/oauth/v2/accessToken"
LINKEDIN_USERINFO_URL = "https://api.linkedin.com/v2/userinfo"
LINKEDIN_V2_BASE = "https://api.linkedin.com/v2"
LINKEDIN_REST_BASE = "https://api.linkedin.com/rest"

# Supported LinkedIn REST API version
LINKEDIN_API_VERSION = get_settings().linkedin_api_version

# Standard scopes for personal profiles
LINKEDIN_DEFAULT_SCOPES = [
    "openid",
    "profile",
    "email",
    "w_member_social",
]

# Additional scopes for company organization pages (requires Community Management API product)
LINKEDIN_ORGANIZATION_SCOPES = [
    "w_organization_social",
    "r_organization_social",
    "rw_organization_admin",
]

LINKEDIN_SCOPES = LINKEDIN_DEFAULT_SCOPES + LINKEDIN_ORGANIZATION_SCOPES


class LinkedInAdapter(LinkedInManagement):
    """
    Platform adapter for LinkedIn using official OAuth 2.0 and REST Posts API.
    Supports posting to personal profiles and company organization pages.
    """

    from app.modules.channels.adapters.analytics_posts import (
        linkedin_posts as fetch_analytics_posts,
    )

    platform = "linkedin"
    required_credentials = ("client_id", "client_secret")

    def __init__(
        self,
        client_id: str | None = None,
        client_secret: str | None = None,
        scopes: list[str] | None = None,
        http_client: httpx.AsyncClient | None = None,
    ) -> None:
        settings = get_settings()
        self.client_id = (
            client_id or settings.linkedin_client_id or "linkedin_client_id_placeholder"
        )
        self.client_secret = (
            client_secret or settings.linkedin_client_secret or "linkedin_client_secret_placeholder"
        )
        if scopes:
            self.scopes = scopes
        elif settings.linkedin_scopes:
            self.scopes = [s.strip() for s in settings.linkedin_scopes.split(",") if s.strip()]
        else:
            self.scopes = list(LINKEDIN_DEFAULT_SCOPES)
        self.redirect_base_url = settings.oauth_callback_url(self.platform)
        self._http_client = http_client

        self.capabilities = Capabilities(
            platform=self.platform,
            display_name="LinkedIn",
            max_text_length=3000,
            text_length_type="characters",
            supports_media=True,
            supported_media_types=[
                "image/jpeg",
                "image/png",
                "image/gif",
                "video/mp4",
                "application/pdf",
            ],
            max_media_count=20,
            supports_video=True,
            max_video_duration_seconds=1800,
            supports_threads=False,
            supports_polls=True,
            supports_alt_text=True,
            max_alt_text_length=1000,
            supports_links=True,
            supports_tags=True,
            visibility_options=["PUBLIC", "CONNECTIONS"],
            requires_target=False,
            target_type_name="organization",
            supports_account_metrics=True,
            supports_scheduling=True,
        )

    from app.modules.channels.adapters.media import upload_linkedin as prepare_media
    from app.modules.channels.adapters.media import validate_linkedin_media as validate_media

    async def _get_client(self) -> httpx.AsyncClient:
        if self._http_client is not None:
            return self._http_client
        return AdapterHTTP(self.platform)

    def _headers(self, access_token: str) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {access_token}",
            "LinkedIn-Version": LINKEDIN_API_VERSION,
            "X-Restli-Protocol-Version": "2.0.0",
            "Content-Type": "application/json",
        }

    async def build_auth_url(self, workspace_id: str, state: str, **opts: Any) -> AuthStart:
        """
        Build LinkedIn OAuth 2.0 authorization URL.
        """
        redirect_uri = opts.get("redirect_uri") or self.redirect_base_url
        scopes = opts.get("scopes") or self.scopes
        if opts.get("manage_organizations"):
            scopes = list(dict.fromkeys([*scopes, *LINKEDIN_ORGANIZATION_SCOPES]))
        if opts.get("manage_replies"):
            scopes = list(
                dict.fromkeys(
                    [
                        *scopes,
                        "r_organization_social_feed",
                        "w_organization_social_feed",
                        "r_member_social_feed",
                        "w_member_social_feed",
                    ]
                )
            )

        params = {
            "response_type": "code",
            "client_id": self.client_id,
            "redirect_uri": redirect_uri,
            "state": state,
            "scope": " ".join(scopes),
        }
        auth_url = f"{LINKEDIN_AUTH_URL}?{urllib.parse.urlencode(params)}"
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
        Exchange authorization code for tokens and fetch personal profile info via OpenID userinfo.
        """
        code = params.get("code")
        if not code:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Missing authorization code from LinkedIn callback",
            )

        redirect_uri = opts.get("redirect_uri") or self.redirect_base_url

        data = {
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": redirect_uri,
            "client_id": self.client_id,
            "client_secret": self.client_secret,
        }

        client = await self._get_client()
        try:
            token_resp = await client.post(
                LINKEDIN_TOKEN_URL,
                data=data,
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
        finally:
            if self._http_client is None:
                await client.aclose()

        if token_resp.status_code != 200:
            logger.error(
                "LinkedIn token exchange failed: %s %s", token_resp.status_code, token_resp.text
            )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"LinkedIn token exchange failed: {token_resp.text}",
            )

        token_data = token_resp.json()
        access_token = token_data.get("access_token")
        refresh_token = token_data.get("refresh_token")
        expires_in = token_data.get("expires_in", 5184000)  # Default 60 days
        granted_scope_str = token_data.get("scope", "")
        granted_scopes = (
            granted_scope_str.split(" ")
            if granted_scope_str
            else opts.get("oauth_metadata", {}).get("requested_scopes", self.scopes)
        )

        # Fetch OpenID user profile
        user_info = await self._fetch_userinfo(access_token)
        person_id = user_info.get("sub", "")
        name = user_info.get("name", "LinkedIn Member")
        email = user_info.get("email", "")
        person_urn = f"urn:li:person:{person_id}"

        return ConnectedAccount(
            workspace_id=workspace_id,
            platform=self.platform,
            external_account_id=person_urn,
            display_name=name,
            account_type="profile",
            encrypted_access_token=encrypt_token(access_token),
            encrypted_refresh_token=encrypt_token(refresh_token),
            token_expires_at=datetime.now(UTC) + timedelta(seconds=expires_in),
            granted_scopes=granted_scopes,
            status="active",
            account_metadata={
                "person_id": person_id,
                "person_urn": person_urn,
                "email": email,
                "name": name,
                "picture": user_info.get("picture"),
                "avatar_url": user_info.get("picture"),
            },
        )

    async def _fetch_userinfo(self, access_token: str) -> dict[str, Any]:
        client = await self._get_client()
        try:
            resp = await client.get(
                LINKEDIN_USERINFO_URL,
                headers={"Authorization": f"Bearer {access_token}"},
            )
        finally:
            if self._http_client is None:
                await client.aclose()

        if resp.status_code != 200:
            logger.error("Failed to fetch LinkedIn userinfo: %s %s", resp.status_code, resp.text)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Failed to fetch LinkedIn user info: {resp.text}",
            )

        return resp.json()

    async def refresh_tokens(self, account: ConnectedAccount) -> ConnectedAccount:
        """
        Refresh LinkedIn access token if a refresh token is present.
        """
        raw_refresh = decrypt_token(account.encrypted_refresh_token)
        if not raw_refresh:
            raise ValueError(f"LinkedIn account {account.id} has no refresh token")

        data = {
            "grant_type": "refresh_token",
            "refresh_token": raw_refresh,
            "client_id": self.client_id,
            "client_secret": self.client_secret,
        }

        client = await self._get_client()
        try:
            resp = await client.post(
                LINKEDIN_TOKEN_URL,
                data=data,
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
        finally:
            if self._http_client is None:
                await client.aclose()

        if resp.status_code != 200:
            logger.error("LinkedIn token refresh failed: %s %s", resp.status_code, resp.text)
            raise RuntimeError(
                f"LinkedIn token refresh failed (HTTP {resp.status_code}): {resp.text}"
            )

        token_data = resp.json()
        new_access = token_data.get("access_token")
        new_refresh = token_data.get("refresh_token") or raw_refresh
        expires_in = token_data.get("expires_in", 5184000)

        account.encrypted_access_token = encrypt_token(new_access)
        account.encrypted_refresh_token = encrypt_token(new_refresh)
        account.token_expires_at = datetime.now(UTC) + timedelta(seconds=expires_in)
        account.status = "active"
        return account

    async def revoke(self, account: ConnectedAccount) -> None:
        """
        LinkedIn does not expose an official token revocation endpoint; disconnection removes credentials.
        """

    async def list_targets(self, account: ConnectedAccount) -> list[Target]:
        """
        List company organization pages the user has administrator or authoring access to.
        Also includes the user's personal profile as a target.
        """
        targets: list[Target] = []
        raw_access = decrypt_token(account.encrypted_access_token)
        if not raw_access:
            return targets

        # 1. Personal profile target
        person_urn = account.account_metadata.get("person_urn") or account.external_account_id
        targets.append(
            Target(
                id=person_urn,
                name=f"{account.display_name} (Personal Profile)",
                target_type="personal",
                description="Your personal LinkedIn profile",
            )
        )

        # 2. Company / Organization pages target list via organizationalEntityAcls
        client = await self._get_client()
        try:
            resp = await client.get(
                f"{LINKEDIN_REST_BASE}/organizationalEntityAcls?q=roleAssignee",
                headers=self._headers(raw_access),
            )
        except Exception as exc:  # noqa: BLE001
            logger.warning("Could not fetch LinkedIn company pages for %s: %s", account.id, exc)
            return targets
        finally:
            if self._http_client is None:
                await client.aclose()

        if resp.status_code == 200:
            acl_data = resp.json()
            elements = acl_data.get("elements", [])
            for elem in elements:
                org_urn = elem.get("organizationalTarget")
                role = elem.get("role", "ADMINISTRATOR")
                state = elem.get("state", "APPROVED")
                if org_urn and state == "APPROVED":
                    targets.append(
                        Target(
                            id=org_urn,
                            name=f"Company Page ({org_urn.split(':')[-1]})",
                            target_type="organization",
                            description=f"Role: {role}",
                            metadata={"role": role, "org_urn": org_urn},
                        )
                    )

        return targets

    async def validate(self, variant: Any) -> list[Issue]:
        """
        Validate post length and media counts against LinkedIn limits.
        """
        issues: list[Issue] = []
        payload = getattr(variant, "payload", {})
        if not isinstance(payload, dict):
            return [
                Issue(field="payload", message="Invalid variant payload format", severity="error")
            ]

        text = payload.get("text", "")
        if not text and not payload.get("media_urns") and not payload.get("poll"):
            issues.append(
                Issue(
                    field="text",
                    message="LinkedIn post must contain text or media",
                    severity="error",
                )
            )

        if len(text) > self.capabilities.max_text_length:
            issues.append(
                Issue(
                    field="text",
                    message=f"Post length ({len(text)}) exceeds maximum of {self.capabilities.max_text_length} characters",
                    severity="error",
                    code="text_too_long",
                )
            )

        media_urns = payload.get("media_urns", [])
        if len(media_urns) > self.capabilities.max_media_count:
            issues.append(
                Issue(
                    field="media_urns",
                    message=f"Maximum of {self.capabilities.max_media_count} media items allowed per LinkedIn post",
                    severity="error",
                    code="too_many_media",
                )
            )

        poll = payload.get("poll")
        if poll and (
            not 1 <= len(poll.get("question", "")) <= 140
            or not 2 <= len(poll.get("options", [])) <= 4
            or any(not o or len(o) > 30 for o in poll.get("options", []))
            or poll.get("duration", "SEVEN_DAYS")
            not in {"ONE_DAY", "THREE_DAYS", "SEVEN_DAYS", "FOURTEEN_DAYS"}
            or media_urns
        ):
            issues.append(
                Issue(
                    field="poll",
                    message="Invalid LinkedIn poll question/options/duration or conflicting media",
                )
            )
        if len(media_urns) > 1 and any(not urn.startswith("urn:li:image:") for urn in media_urns):
            issues.append(
                Issue(field="media_urns", message="Multiple attachments must be image URNs")
            )
        return issues

    async def publish(self, account: ConnectedAccount, variant: Any) -> PublishResult:
        """
        Publish post using LinkedIn Posts API (POST /rest/posts).
        Supports targeting personal profile or organization page.
        """
        raw_access = decrypt_token(account.encrypted_access_token)
        if not raw_access:
            return PublishResult(
                success=False,
                error_message="Missing decrypted LinkedIn access token",
                is_retryable=False,
            )

        payload = getattr(variant, "payload", {})
        text = payload.get("text", "")

        # Target: specified organization URN or personal profile URN
        author_urn = payload.get("target_urn") or payload.get("author_urn")
        if not author_urn:
            author_urn = account.account_metadata.get("person_urn") or account.external_account_id

        visibility = payload.get("visibility", "PUBLIC")

        body: dict[str, Any] = {
            "author": author_urn,
            "commentary": text,
            "visibility": visibility,
            "distribution": {
                "feedDistribution": "MAIN_FEED",
                "targetEntities": [],
                "thirdPartyDistributionChannels": [],
            },
            "lifecycleState": "PUBLISHED",
            "isReshareDisabledByAuthor": False,
        }

        media_urns = payload.get("media_urns")
        if media_urns:
            body["content"] = {"media": {"id": media_urns[0]}}
            if payload.get("media_alt_texts") and media_urns[0].startswith("urn:li:image:"):
                body["content"]["media"]["altText"] = payload["media_alt_texts"][0]

        if media_urns and len(media_urns) > 1:
            body["content"] = {
                "multiImage": {
                    "images": [
                        {
                            "id": urn,
                            "altText": (payload.get("media_alt_texts") or [""] * len(media_urns))[
                                i
                            ],
                        }
                        for i, urn in enumerate(media_urns)
                    ]
                }
            }
        if payload.get("poll"):
            poll = payload["poll"]
            body["content"] = {
                "poll": {
                    "question": poll["question"],
                    "options": [{"text": o} for o in poll["options"]],
                    "settings": {"duration": poll.get("duration", "SEVEN_DAYS")},
                }
            }
        client = await self._get_client()
        try:
            resp = await client.post(
                f"{LINKEDIN_REST_BASE}/posts",
                json=body,
                headers=self._headers(raw_access),
            )
        except Exception as exc:  # noqa: BLE001
            logger.error("Network error publishing to LinkedIn: %s", exc)
            return PublishResult(
                success=False,
                error_message=f"Network error: {exc}",
                is_retryable=True,
                outcome_unknown=isinstance(exc, httpx.TransportError),
            )
        finally:
            if self._http_client is None:
                await client.aclose()

        if resp.status_code in {201, 200}:
            post_urn = resp.headers.get("x-restli-id")
            if not post_urn and resp.text:
                try:
                    post_urn = resp.json().get("id")
                except (ValueError, KeyError) as exc:
                    logger.debug("Could not parse json id from LinkedIn response: %s", exc)
            if not post_urn:
                return PublishResult(
                    success=False,
                    outcome_unknown=True,
                    error_message="LinkedIn accepted the post but returned no identifier",
                )

            # URL format for LinkedIn shares
            external_url = f"https://www.linkedin.com/feed/update/{post_urn}"
            return PublishResult(
                success=True,
                external_post_id=post_urn,
                external_url=external_url,
                raw_response={"post_urn": post_urn, "status_code": resp.status_code},
            )

        is_retryable = resp.status_code == 429
        error_msg = f"LinkedIn API error (HTTP {resp.status_code}): {resp.text}"
        logger.warning("LinkedIn publish failed: %s", error_msg)

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
        Delete a post via DELETE /rest/posts/{post_urn}.
        """
        raw_access = decrypt_token(account.encrypted_access_token)
        if not raw_access:
            raise ValueError("Missing decrypted access token")

        encoded_urn = urllib.parse.quote(external_post_id, safe="")
        client = await self._get_client()
        try:
            resp = await client.delete(
                f"{LINKEDIN_REST_BASE}/posts/{encoded_urn}",
                headers=self._headers(raw_access),
            )
        finally:
            if self._http_client is None:
                await client.aclose()

        if resp.status_code not in {204, 200, 404}:
            logger.warning("Failed to delete LinkedIn post %s: %s", external_post_id, resp.text)
            raise RuntimeError(
                f"Failed to delete LinkedIn post (HTTP {resp.status_code}): {resp.text}"
            )

    async def fetch_metrics(
        self,
        account: ConnectedAccount,
        external_post_id: str,
        context: dict[str, Any] | None = None,
    ) -> Metrics:
        """Fetch LinkedIn post statistics from the correct member or organization API."""
        raw_access = decrypt_token(account.encrypted_access_token)
        if not raw_access:
            raise ValueError("Missing decrypted access token")

        payload = (context or {}).get("payload") or {}
        author_urn = (
            payload.get("target_urn")
            or payload.get("author_urn")
            or account.account_metadata.get("target_org_urn")
            or account.external_account_id
        )
        org_urn = (
            author_urn
            if isinstance(author_urn, str) and author_urn.startswith("urn:li:organization:")
            else None
        )
        client = await self._get_client()
        try:
            if org_urn:
                params = {"q": "organizationalEntity", "organizationalEntity": org_urn}
                if external_post_id.startswith("urn:li:share:"):
                    params["shares"] = f"List({external_post_id})"
                elif external_post_id.startswith("urn:li:ugcPost:"):
                    params["ugcPosts[0]"] = external_post_id
                else:
                    return self._unavailable_metrics(
                        "LinkedIn returned an unsupported post identifier for analytics."
                    )

                response = await client.get(
                    f"{LINKEDIN_REST_BASE}/organizationalEntityShareStatistics",
                    headers=self._headers(raw_access),
                    params=params,
                )
                if response.status_code == 200:
                    elements = response.json().get("elements", [])
                    row = next(
                        (
                            item
                            for item in elements
                            if item.get("share") == external_post_id
                            or item.get("ugcPost") == external_post_id
                        ),
                        {},
                    )
                    if not row:
                        published_at = (context or {}).get("published_at")
                        if isinstance(published_at, str):
                            try:
                                published_at = datetime.fromisoformat(
                                    published_at.replace("Z", "+00:00")
                                )
                            except ValueError:
                                published_at = None
                        if isinstance(published_at, datetime):
                            if published_at.tzinfo is None:
                                published_at = published_at.replace(tzinfo=UTC)
                            if published_at < datetime.now(UTC) - timedelta(days=365):
                                return self._unavailable_metrics(
                                    "LinkedIn organization post analytics are available for a rolling 12-month window; this post is older."
                                )
                            return Metrics(
                                extras={
                                    "metrics_status": "available",
                                    "available_metrics": [
                                        "impressions",
                                        "reach",
                                        "engagements",
                                        "likes",
                                        "comments",
                                        "shares",
                                        "clicks",
                                    ],
                                    "metrics_source": "organizationalEntityShareStatistics",
                                    "org_urn": org_urn,
                                }
                            )
                        return self._unavailable_metrics(
                            "LinkedIn returned no analytics record and the post date is unavailable, so its zero counts cannot be confirmed."
                        )
                    stats = row.get("totalShareStatistics", {})
                    likes = int(stats.get("likeCount", 0) or 0)
                    comments = int(stats.get("commentCount", 0) or 0)
                    shares = int(stats.get("shareCount", 0) or 0)
                    impressions = int(stats.get("impressionCount", 0) or 0)
                    clicks = int(stats.get("clickCount", 0) or 0)
                    available_metrics = [
                        field
                        for field, source_field in (
                            ("impressions", "impressionCount"),
                            ("reach", "uniqueImpressionsCount"),
                            ("likes", "likeCount"),
                            ("comments", "commentCount"),
                            ("shares", "shareCount"),
                            ("clicks", "clickCount"),
                        )
                        if source_field in stats
                    ]
                    if {"likes", "comments", "shares", "clicks"}.issubset(available_metrics):
                        available_metrics.append("engagements")
                    is_complete = {
                        "impressions",
                        "reach",
                        "likes",
                        "comments",
                        "shares",
                        "clicks",
                        "engagements",
                    }.issubset(available_metrics)
                    if not available_metrics:
                        return self._unavailable_metrics(
                            "LinkedIn returned an empty analytics record for this Page post."
                        )
                    return Metrics(
                        impressions=impressions,
                        reach=int(stats.get("uniqueImpressionsCount", 0) or 0),
                        engagements=likes + comments + shares + clicks,
                        likes=likes,
                        comments=comments,
                        shares_reposts=shares,
                        clicks=clicks,
                        extras={
                            "metrics_status": "available" if is_complete else "partial",
                            "metrics_notice": None
                            if is_complete
                            else "LinkedIn returned only part of its Page post analytics.",
                            "available_metrics": available_metrics,
                            "metrics_source": "organizationalEntityShareStatistics",
                            "org_urn": org_urn,
                            "reported_engagement_rate": stats.get("engagement"),
                        },
                    )
                if response.status_code not in {403, 404}:
                    raise RuntimeError(
                        f"LinkedIn organization analytics failed: HTTP {response.status_code}"
                    )
                logger.info(
                    "LinkedIn organization analytics unavailable: HTTP %s", response.status_code
                )

            else:
                scopes = set(account.granted_scopes or [])
                if "r_member_postAnalytics" in scopes:
                    entity_type = (
                        "share"
                        if external_post_id.startswith("urn:li:share:")
                        else "ugc"
                        if external_post_id.startswith("urn:li:ugcPost:")
                        else None
                    )
                    if entity_type:
                        entity = f"({entity_type}:{external_post_id})"
                        values: dict[str, int] = {}
                        metric_queries = {
                            "impressions": "IMPRESSION",
                            "reach": "MEMBERS_REACHED",
                            "shares": "RESHARE",
                            "likes": "REACTION",
                            "comments": "COMMENT",
                            "clicks": "LINK_CLICKS",
                        }
                        restricted = False
                        for field, query_type in metric_queries.items():
                            response = await client.get(
                                f"{LINKEDIN_REST_BASE}/memberCreatorPostAnalytics",
                                headers=self._headers(raw_access),
                                params={
                                    "q": "entity",
                                    "entity": entity,
                                    "queryType": query_type,
                                    "aggregation": "TOTAL",
                                },
                            )
                            if response.status_code == 403:
                                restricted = True
                                break
                            if response.status_code != 200:
                                raise RuntimeError(
                                    f"LinkedIn member analytics failed: HTTP {response.status_code}"
                                )
                            elements = response.json().get("elements", [])
                            if elements and "count" in elements[0]:
                                values[field] = int(elements[0]["count"] or 0)

                        if not restricted:
                            likes = values.get("likes", 0)
                            comments = values.get("comments", 0)
                            shares = values.get("shares", 0)
                            available_metrics = list(values)
                            if {"likes", "comments", "shares", "clicks"}.issubset(values):
                                available_metrics.append("engagements")
                            is_complete = {
                                "impressions",
                                "reach",
                                "likes",
                                "comments",
                                "shares",
                                "clicks",
                                "engagements",
                            }.issubset(available_metrics)
                            if not available_metrics:
                                return self._unavailable_metrics(
                                    "LinkedIn has not returned analytics for this member post yet."
                                )
                            notice = (
                                None
                                if is_complete
                                else ("LinkedIn returned only part of its member post analytics.")
                            )
                            return Metrics(
                                impressions=values.get("impressions", 0),
                                reach=values.get("reach", 0),
                                engagements=likes + comments + shares + values.get("clicks", 0),
                                likes=likes,
                                comments=comments,
                                shares_reposts=shares,
                                clicks=values.get("clicks", 0),
                                extras={
                                    "metrics_status": "available" if is_complete else "partial",
                                    "metrics_notice": notice,
                                    "available_metrics": available_metrics,
                                    "metrics_source": "memberCreatorPostAnalytics",
                                },
                            )

            # socialActions is still useful as a limited fallback: it exposes
            # reactions/comments, but never impressions or click statistics.
            encoded_urn = urllib.parse.quote(external_post_id, safe="")
            response = await client.get(
                f"{LINKEDIN_REST_BASE}/socialActions/{encoded_urn}",
                headers=self._headers(raw_access),
            )
            if response.status_code == 429:
                return self._unavailable_metrics(
                    "LinkedIn API request rate limit reached. Retrying automatically on next sync."
                )
            if response.status_code == 401 or response.status_code >= 500:
                raise RuntimeError(f"LinkedIn social actions failed: HTTP {response.status_code}")
            if response.status_code != 200:
                return self._unavailable_metrics(
                    self._analytics_permission_notice(org_urn=bool(org_urn))
                )

            data = response.json()
            likes_summary = data.get("likesSummary") or {}
            comments_summary = data.get("commentsSummary") or {}
            has_likes = "totalLikes" in likes_summary
            comments_key = (
                "totalFirstLevelComments"
                if "totalFirstLevelComments" in comments_summary
                else "totalComments"
            )
            has_comments = comments_key in comments_summary
            likes = int(likes_summary.get("totalLikes", 0) or 0)
            comments = int(comments_summary.get(comments_key, 0) or 0)
            available_metrics = [
                metric
                for metric, present in (("likes", has_likes), ("comments", has_comments))
                if present
            ]
            if not available_metrics:
                return self._unavailable_metrics(
                    self._analytics_permission_notice(org_urn=bool(org_urn))
                )
            return Metrics(
                engagements=likes + comments,
                likes=likes,
                comments=comments,
                extras={
                    "metrics_status": "partial",
                    "metrics_notice": self._analytics_permission_notice(org_urn=bool(org_urn)),
                    "available_metrics": [*available_metrics, "engagements"],
                    "metrics_source": "socialActions",
                },
            )
        finally:
            if self._http_client is None:
                await client.aclose()

    @staticmethod
    def _analytics_permission_notice(*, org_urn: bool) -> str:
        if org_urn:
            return (
                "LinkedIn returned reactions and comments only. Post impressions, reach and clicks "
                "require Community Management API access with rw_organization_admin and an "
                "administrator role on the Page."
            )
        return (
            "LinkedIn returned reactions and comments only. Member post analytics require the "
            "r_member_postAnalytics permission from an approved Community Management API app."
        )

    @staticmethod
    def _unavailable_metrics(notice: str) -> Metrics:
        return Metrics(
            extras={
                "metrics_status": "unavailable",
                "metrics_notice": notice,
                "available_metrics": [],
                "metrics_source": "linkedin",
            }
        )

    async def fetch_account_metrics(self, account: ConnectedAccount) -> AccountMetrics:
        """Read Page followers, views and share totals from official LinkedIn APIs."""
        org = account.account_metadata.get("target_org_urn")
        if not org and account.external_account_id.startswith("urn:li:organization:"):
            org = account.external_account_id
        if not org:
            return AccountMetrics(
                extras={
                    "metrics_status": "unavailable",
                    "available_metrics": [],
                    "metrics_notice": "LinkedIn personal-profile analytics is not available in this integration.",
                }
            )
        token = decrypt_token(account.encrypted_access_token)
        if not token:
            raise ValueError("Missing decrypted access token")
        client = await self._get_client()
        values, fields, notices, raw = {}, [], [], {}
        status_code = None
        try:
            follower = await client.get(
                f"{LINKEDIN_V2_BASE}/networkSizes/{urllib.parse.quote(org, safe=':')}",
                headers=self._headers(token),
                params={"edgeType": "CompanyFollowedByMember"},
            )
            if follower.status_code == 200 and "firstDegreeSize" in follower.json():
                values["followers_count"] = int(follower.json()["firstDegreeSize"] or 0)
                fields.append("followers_count")
            else:
                status_code = follower.status_code
                notices.append(
                    "LinkedIn did not allow the Page follower lookup. Check organization permissions and Page access."
                )
            for endpoint in ["organizationPageStatistics", "organizationalEntityShareStatistics"]:
                response = await client.get(
                    f"{LINKEDIN_REST_BASE}/{endpoint}",
                    headers=self._headers(token),
                    params={"q": "organizationalEntity", "organizationalEntity": org},
                )
                if response.status_code != 200:
                    notices.append(
                        f"LinkedIn did not allow {endpoint}; approved organization permissions are required."
                    )
                    continue
                elements = response.json().get("elements", [])
                raw[endpoint] = elements
                if not elements:
                    continue
                if endpoint == "organizationPageStatistics":
                    views = (
                        elements[0]
                        .get("totalPageStatistics", {})
                        .get("views", {})
                        .get("allPageViews", {})
                    )
                    if "pageViews" in views:
                        values["profile_views"] = int(views["pageViews"] or 0)
                        fields.append("profile_views")
                else:
                    stats = elements[0].get("totalShareStatistics", {})
                    for name, key in {
                        "impressions": "impressionCount",
                        "reach": "uniqueImpressionsCount",
                    }.items():
                        if key in stats:
                            values[name] = int(stats[key] or 0)
                            fields.append(name)
                    if all(
                        key in stats
                        for key in ["likeCount", "commentCount", "shareCount", "clickCount"]
                    ):
                        values["engagements"] = sum(
                            int(stats[key] or 0)
                            for key in ["likeCount", "commentCount", "shareCount", "clickCount"]
                        )
                        fields.append("engagements")
        finally:
            if self._http_client is None:
                await client.aclose()
        return AccountMetrics(
            **values,
            extras={
                "metrics_status": "partial" if fields else "unavailable",
                "metrics_notice": " ".join(notices) or None,
                "available_metrics": fields,
                "metrics_source": "LinkedIn organization APIs",
                "org_urn": org,
                "status_code": status_code,
                "page_statistics": raw,
            },
        )
