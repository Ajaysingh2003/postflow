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
LINKEDIN_REST_BASE = "https://api.linkedin.com/rest"

# Supported LinkedIn REST API version
LINKEDIN_API_VERSION = get_settings().linkedin_api_version

# Standard scopes for personal profiles and company organization pages
LINKEDIN_SCOPES = [
    "openid",
    "profile",
    "email",
    "w_member_social",
    "w_organization_social",
    "r_organization_social",
    "rw_organization_admin",
]


class LinkedInAdapter(LinkedInManagement):
    """
    Platform adapter for LinkedIn using official OAuth 2.0 and REST Posts API.
    Supports posting to personal profiles and company organization pages.
    """

    platform = "linkedin"
    required_credentials = ("client_id", "client_secret")

    def __init__(
        self,
        client_id: str | None = None,
        client_secret: str | None = None,
        http_client: httpx.AsyncClient | None = None,
    ) -> None:
        settings = get_settings()
        self.client_id = (
            client_id or settings.linkedin_client_id or "linkedin_client_id_placeholder"
        )
        self.client_secret = (
            client_secret or settings.linkedin_client_secret or "linkedin_client_secret_placeholder"
        )
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
        scopes = opts.get("scopes") or LINKEDIN_SCOPES
        if opts.get("manage_replies"):
            scopes = list(dict.fromkeys([*scopes, "r_organization_social_feed", "w_organization_social_feed", "r_member_social_feed", "w_member_social_feed"]))

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
        granted_scopes = granted_scope_str.split(" ") if granted_scope_str else opts.get("oauth_metadata", {}).get("requested_scopes", LINKEDIN_SCOPES)

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

    async def fetch_metrics(self, account: ConnectedAccount, external_post_id: str) -> Metrics:
        """
        Fetch post-level performance metrics.
        """
        raw_access = decrypt_token(account.encrypted_access_token)
        if not raw_access:
            raise ValueError("Missing decrypted access token")

        encoded_urn = urllib.parse.quote(external_post_id, safe="")
        client = await self._get_client()
        try:
            resp = await client.get(
                f"{LINKEDIN_REST_BASE}/socialActions/{encoded_urn}",
                headers=self._headers(raw_access),
            )
        finally:
            if self._http_client is None:
                await client.aclose()

        if resp.status_code != 200:
            logger.warning(
                "Failed to fetch LinkedIn metrics for %s: %s", external_post_id, resp.text
            )
            raise RuntimeError(f"Metrics API error: HTTP {resp.status_code}")

        data = resp.json()
        likes = data.get("likesSummary", {}).get("totalLikes", 0)
        comments = data.get("commentsSummary", {}).get("totalComments", 0)
        shares = data.get("sharesSummary", {}).get("totalShares", 0)
        impressions = data.get("impressionCount", 0)

        return Metrics(
            impressions=impressions,
            reach=impressions,
            engagements=likes + comments + shares,
            likes=likes,
            comments=comments,
            shares_reposts=shares,
            clicks=data.get("clickCount", 0),
            extras=data,
        )

    async def fetch_account_metrics(self, account: ConnectedAccount) -> AccountMetrics:
        """
        Fetch whole-account follower and engagement analytics from the original LinkedIn API.
        If the account is or targets an organization, queries organizationalEntityFollowerStatistics.
        """
        raw_access = decrypt_token(account.encrypted_access_token)
        if not raw_access:
            raise ValueError("Missing decrypted access token")

        org_urn = account.account_metadata.get("target_org_urn")
        if not org_urn and account.external_account_id.startswith("urn:li:organization:"):
            org_urn = account.external_account_id

        if not org_urn:
            # Personal profiles return member follower summary if accessible
            return AccountMetrics(
                followers_count=account.account_metadata.get("followers_count", 0),
                extras={"account_type": "personal_profile"},
            )

        encoded_org = urllib.parse.quote(org_urn, safe="")
        client = await self._get_client()
        try:
            resp = await client.get(
                f"{LINKEDIN_REST_BASE}/organizationalEntityFollowerStatistics?q=organizationalEntity&organizationalEntity={encoded_org}",
                headers=self._headers(raw_access),
            )
        finally:
            if self._http_client is None:
                await client.aclose()

        if resp.status_code != 200:
            logger.warning(
                "Failed to fetch LinkedIn organization stats for %s: %s", org_urn, resp.text
            )
            raise RuntimeError("Account metrics request failed or is unsupported")

        stats = resp.json().get("elements", [{}])[0]
        follower_counts = stats.get("followerCountsByAssociationType", [{}])[0]
        organic_followers = follower_counts.get("followerCounts", {}).get("organicFollowerCount", 0)
        paid_followers = follower_counts.get("followerCounts", {}).get("paidFollowerCount", 0)
        total_followers = organic_followers + paid_followers

        return AccountMetrics(
            followers_count=total_followers,
            impressions=stats.get("viewsSummary", {}).get("totalViews", 0),
            extras={
                "organic_followers": organic_followers,
                "paid_followers": paid_followers,
                "org_urn": org_urn,
            },
        )
