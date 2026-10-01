import logging
import urllib.parse
from datetime import UTC, datetime, timedelta
from typing import Any

import httpx
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

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
from app.modules.channels.models import ConnectedAccount, SubredditProfile
from app.modules.channels.oauth import decrypt_token, encrypt_token

logger = logging.getLogger(__name__)

# Reddit Official API Endpoints
REDDIT_AUTH_URL = "https://www.reddit.com/api/v1/authorize"
REDDIT_TOKEN_URL = "https://www.reddit.com/api/v1/access_token"
REDDIT_REVOKE_URL = "https://www.reddit.com/api/v1/revoke_token"
REDDIT_OAUTH_API_BASE = "https://oauth.reddit.com"

# Scopes needed for postflow: identity, submit, reading subreddits, flairs
REDDIT_SCOPES = ["identity", "submit", "read", "mysubreddits", "flair"]


class RedditAdapter:
    """
    Official platform adapter for Reddit.
    Requires descriptive User-Agent, OAuth 2.0 with permanent refresh tokens,
    subreddit targeting, and adherence to subreddit rules and flair requirements.
    """

    platform = "reddit"

    def __init__(
        self,
        client_id: str | None = None,
        client_secret: str | None = None,
        user_agent: str | None = None,
        http_client: httpx.AsyncClient | None = None,
    ) -> None:
        settings = get_settings()
        self.client_id = client_id or settings.reddit_client_id or "reddit_client_id_placeholder"
        self.client_secret = client_secret or settings.reddit_client_secret or "reddit_client_secret_placeholder"
        self.user_agent = user_agent or settings.reddit_user_agent or "web:postflow:v0.1.0 (by /u/postflowapp)"
        self.redirect_base_url = settings.oauth_redirect_base_url
        self._http_client = http_client

        self.capabilities = Capabilities(
            platform=self.platform,
            display_name="Reddit",
            max_text_length=40000,
            text_length_type="characters",
            supports_media=True,
            supported_media_types=["image/jpeg", "image/png", "image/webp", "image/gif", "video/mp4"],
            max_media_count=1,
            supports_video=True,
            supports_threads=False,
            supports_polls=False,
            supports_alt_text=False,
            supports_links=True,
            supports_tags=False,
            visibility_options=["public"],
            requires_target=True,
            target_type_name="subreddit",
            supports_account_metrics=True,
            supports_scheduling=True,
        )

    async def _get_client(self) -> httpx.AsyncClient:
        if self._http_client is not None:
            return self._http_client
        return httpx.AsyncClient(timeout=30.0)

    def _headers(self, access_token: str | None = None) -> dict[str, str]:
        headers = {"User-Agent": self.user_agent}
        if access_token:
            headers["Authorization"] = f"Bearer {access_token}"
        return headers

    async def build_auth_url(self, workspace_id: str, state: str, **opts: Any) -> AuthStart:
        """
        Build official Reddit OAuth 2.0 authorization URL.
        Crucial: duration=permanent is required by Reddit to receive a refresh token.
        """
        redirect_uri = opts.get("redirect_uri") or self.redirect_base_url
        scopes = opts.get("scopes") or REDDIT_SCOPES

        params = {
            "client_id": self.client_id,
            "response_type": "code",
            "state": state,
            "redirect_uri": redirect_uri,
            "duration": "permanent",  # Guarantees refresh token issuance
            "scope": " ".join(scopes),
        }
        auth_url = f"{REDDIT_AUTH_URL}?{urllib.parse.urlencode(params)}"
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
        Exchange authorization code for tokens and fetch user profile via /api/v1/me.
        """
        code = params.get("code")
        if not code:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Missing authorization code from Reddit callback",
            )

        redirect_uri = opts.get("redirect_uri") or self.redirect_base_url

        data = {
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": redirect_uri,
        }

        auth = (self.client_id, self.client_secret)
        client = await self._get_client()
        try:
            token_resp = await client.post(
                REDDIT_TOKEN_URL,
                data=data,
                auth=auth,
                headers=self._headers(),
            )
        finally:
            if self._http_client is None:
                await client.aclose()

        if token_resp.status_code != 200:
            logger.error("Reddit token exchange failed: %s %s", token_resp.status_code, token_resp.text)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Reddit token exchange failed: {token_resp.text}",
            )

        token_data = token_resp.json()
        access_token = token_data.get("access_token")
        refresh_token = token_data.get("refresh_token")
        expires_in = token_data.get("expires_in", 3600)
        granted_scope_str = token_data.get("scope", "")
        granted_scopes = granted_scope_str.split(" ") if granted_scope_str else REDDIT_SCOPES

        # Fetch authenticated Reddit user identity
        user_info = await self._fetch_me(access_token)
        username = user_info.get("name", "Reddit User")
        reddit_id = user_info.get("id", username)

        return ConnectedAccount(
            workspace_id=workspace_id,
            platform=self.platform,
            external_account_id=f"t2_{reddit_id}",
            display_name=f"u/{username}",
            account_type="profile",
            encrypted_access_token=encrypt_token(access_token),
            encrypted_refresh_token=encrypt_token(refresh_token),
            token_expires_at=datetime.now(UTC) + timedelta(seconds=expires_in),
            granted_scopes=granted_scopes,
            status="active",
            account_metadata={
                "username": username,
                "reddit_id": reddit_id,
                "total_karma": user_info.get("total_karma", 0),
                "link_karma": user_info.get("link_karma", 0),
                "comment_karma": user_info.get("comment_karma", 0),
                "icon_img": user_info.get("icon_img"),
            },
        )

    async def _fetch_me(self, access_token: str) -> dict[str, Any]:
        client = await self._get_client()
        try:
            resp = await client.get(
                f"{REDDIT_OAUTH_API_BASE}/api/v1/me",
                headers=self._headers(access_token),
            )
        finally:
            if self._http_client is None:
                await client.aclose()

        if resp.status_code != 200:
            logger.error("Failed to fetch Reddit /me profile: %s %s", resp.status_code, resp.text)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Failed to fetch Reddit user profile: {resp.text}",
            )

        return resp.json()

    async def refresh_tokens(self, account: ConnectedAccount) -> ConnectedAccount:
        """
        Refresh Reddit access token using stored refresh token.
        """
        raw_refresh = decrypt_token(account.encrypted_refresh_token)
        if not raw_refresh:
            raise ValueError(f"Reddit account {account.id} has no refresh token")

        data = {
            "grant_type": "refresh_token",
            "refresh_token": raw_refresh,
        }

        auth = (self.client_id, self.client_secret)
        client = await self._get_client()
        try:
            resp = await client.post(
                REDDIT_TOKEN_URL,
                data=data,
                auth=auth,
                headers=self._headers(),
            )
        finally:
            if self._http_client is None:
                await client.aclose()

        if resp.status_code != 200:
            logger.error("Reddit token refresh failed: %s %s", resp.status_code, resp.text)
            raise RuntimeError(f"Reddit token refresh failed (HTTP {resp.status_code}): {resp.text}")

        token_data = resp.json()
        new_access = token_data.get("access_token")
        new_refresh = token_data.get("refresh_token") or raw_refresh
        expires_in = token_data.get("expires_in", 3600)

        account.encrypted_access_token = encrypt_token(new_access)
        account.encrypted_refresh_token = encrypt_token(new_refresh)
        account.token_expires_at = datetime.now(UTC) + timedelta(seconds=expires_in)
        account.status = "active"
        return account

    async def revoke(self, account: ConnectedAccount) -> None:
        """
        Revoke tokens with Reddit via /api/v1/revoke_token.
        """
        raw_access = decrypt_token(account.encrypted_access_token)
        if not raw_access:
            return

        data = {"token": raw_access, "token_type_hint": "access_token"}
        auth = (self.client_id, self.client_secret)

        client = await self._get_client()
        try:
            await client.post(
                REDDIT_REVOKE_URL,
                data=data,
                auth=auth,
                headers=self._headers(),
            )
        except Exception as exc:  # noqa: BLE001
            logger.warning("Error revoking Reddit token for %s: %s", account.id, exc)
        finally:
            if self._http_client is None:
                await client.aclose()

    async def list_targets(self, account: ConnectedAccount) -> list[Target]:
        """
        List subreddits the user can post to (subscribed subreddits & moderated subreddits).
        """
        targets: list[Target] = []
        raw_access = decrypt_token(account.encrypted_access_token)
        if not raw_access:
            return targets

        client = await self._get_client()
        try:
            # Query subscribed subreddits
            resp = await client.get(
                f"{REDDIT_OAUTH_API_BASE}/subreddits/mine/subscriber?limit=100",
                headers=self._headers(raw_access),
            )
            if resp.status_code == 200:
                data = resp.json().get("data", {})
                children = data.get("children", [])
                for item in children:
                    sub_data = item.get("data", {})
                    sub_name = sub_data.get("display_name")
                    if sub_name:
                        targets.append(
                            Target(
                                id=sub_name,
                                name=f"r/{sub_name}",
                                target_type="subreddit",
                                description=sub_data.get("public_description"),
                                metadata={
                                    "subscribers": sub_data.get("subscribers", 0),
                                    "submission_type": sub_data.get("submission_type", "any"),
                                },
                            )
                        )
        except Exception as exc:  # noqa: BLE001
            logger.warning("Error listing Reddit targets for %s: %s", account.id, exc)
        finally:
            if self._http_client is None:
                await client.aclose()

        return targets

    async def refresh_subreddit_profile(
        self,
        db: Session,
        account: ConnectedAccount,
        subreddit_name: str,
    ) -> SubredditProfile:
        """
        Fetch and cache rules, flairs, and allowed post types in subreddit_profiles table.
        """
        clean_name = subreddit_name.strip().lstrip("r/").lower()
        raw_access = decrypt_token(account.encrypted_access_token)
        if not raw_access:
            raise ValueError("Missing decrypted access token")

        client = await self._get_client()
        rules: list[dict[str, Any]] = []
        flairs: list[dict[str, Any]] = []
        allowed_types: list[str] = ["text", "link"]
        flair_required = False

        try:
            # 1. Fetch rules
            rules_resp = await client.get(
                f"{REDDIT_OAUTH_API_BASE}/r/{clean_name}/about/rules",
                headers=self._headers(raw_access),
            )
            if rules_resp.status_code == 200:
                rules_data = rules_resp.json()
                for r in rules_data.get("rules", []):
                    rules.append(
                        {
                            "short_name": r.get("short_name", ""),
                            "description": r.get("description", ""),
                            "violation_reason": r.get("violation_reason", ""),
                        }
                    )

            # 2. Fetch flair requirements
            flair_resp = await client.get(
                f"{REDDIT_OAUTH_API_BASE}/r/{clean_name}/api/link_flair_v2",
                headers=self._headers(raw_access),
            )
            if flair_resp.status_code == 200:
                for f in flair_resp.json():
                    flairs.append({"id": f.get("id"), "text": f.get("text")})

            # 3. Fetch about info
            about_resp = await client.get(
                f"{REDDIT_OAUTH_API_BASE}/r/{clean_name}/about",
                headers=self._headers(raw_access),
            )
            if about_resp.status_code == 200:
                about_data = about_resp.json().get("data", {})
                stype = about_data.get("submission_type", "any")
                if stype == "self":
                    allowed_types = ["text"]
                elif stype == "link":
                    allowed_types = ["link"]
                flair_required = bool(about_data.get("link_flair_enabled") and about_data.get("link_flair_required"))
        finally:
            if self._http_client is None:
                await client.aclose()

        profile = db.scalar(select(SubredditProfile).where(SubredditProfile.name == clean_name))
        now = datetime.now(UTC)
        if profile:
            profile.rules = rules
            profile.allowed_post_types = allowed_types
            profile.flair_required = flair_required
            profile.available_flairs = flairs
            profile.fetched_at = now
        else:
            profile = SubredditProfile(
                name=clean_name,
                display_name=f"r/{clean_name}",
                rules=rules,
                allowed_post_types=allowed_types,
                flair_required=flair_required,
                available_flairs=flairs,
                title_requirements={"max_length": 300},
                fetched_at=now,
            )
            db.add(profile)

        db.commit()
        db.refresh(profile)
        return profile

    async def validate(self, variant: Any, **opts: Any) -> list[Issue]:
        """
        Validate Reddit post payload: target subreddit, title, body length, and cached subreddit rules.
        Payload example: {"subreddit": "...", "title": "...", "body": "...", "url": null, "flair_id": "...", "post_type": "text"}
        """
        issues: list[Issue] = []
        payload = getattr(variant, "payload", {})
        if not isinstance(payload, dict):
            return [Issue(field="payload", message="Invalid variant payload format", severity="error")]

        # Subreddit target is required for Reddit
        subreddit = payload.get("subreddit") or payload.get("target")
        if not subreddit:
            issues.append(
                Issue(
                    field="subreddit",
                    message="Target subreddit is required for Reddit posts",
                    severity="error",
                    code="missing_target",
                )
            )

        title = payload.get("title", "").strip()
        if not title:
            issues.append(
                Issue(
                    field="title",
                    message="Reddit posts require a non-empty title",
                    severity="error",
                    code="missing_title",
                )
            )
        elif len(title) > 300:
            issues.append(
                Issue(
                    field="title",
                    message=f"Reddit post title ({len(title)} chars) exceeds maximum 300 characters",
                    severity="error",
                    code="title_too_long",
                )
            )

        body = payload.get("body") or payload.get("text", "")
        if len(body) > self.capabilities.max_text_length:
            issues.append(
                Issue(
                    field="body",
                    message=f"Post body ({len(body)} chars) exceeds maximum {self.capabilities.max_text_length} characters",
                    severity="error",
                    code="text_too_long",
                )
            )

        post_type = payload.get("post_type", "text")
        if post_type == "link" and not payload.get("url"):
            issues.append(
                Issue(
                    field="url",
                    message="Link posts require a valid target URL",
                    severity="error",
                    code="missing_url",
                )
            )
        elif post_type in ["image", "video"] and not (
            payload.get("url")
            or payload.get("media_url")
            or payload.get("image_url")
            or payload.get("video_url")
        ):
            issues.append(
                Issue(
                    field="media_url",
                    message=f"{post_type.capitalize()} posts require a media URL",
                    severity="error",
                    code="missing_media_url",
                )
            )

        # Check cached subreddit profile if provided
        sub_profile = opts.get("subreddit_profile") or getattr(variant, "subreddit_profile", None)
        if sub_profile and subreddit:
            flair_req = (
                getattr(sub_profile, "flair_required", False)
                if hasattr(sub_profile, "flair_required")
                else (sub_profile.get("flair_required", False) if isinstance(sub_profile, dict) else False)
            )
            flair_id = payload.get("flair_id")
            if flair_req and not flair_id:
                issues.append(
                    Issue(
                        field="flair_id",
                        message=f"Subreddit r/{subreddit} requires a post flair",
                        severity="error",
                        code="flair_required",
                    )
                )

            allowed_types = (
                getattr(sub_profile, "allowed_post_types", [])
                if hasattr(sub_profile, "allowed_post_types")
                else (sub_profile.get("allowed_post_types", []) if isinstance(sub_profile, dict) else [])
            )
            if allowed_types and post_type not in allowed_types:
                issues.append(
                    Issue(
                        field="post_type",
                        message=f"Subreddit r/{subreddit} does not allow '{post_type}' posts (allowed: {', '.join(allowed_types)})",
                        severity="error",
                        code="disallowed_post_type",
                    )
                )

            title_reqs = (
                getattr(sub_profile, "title_requirements", {})
                if hasattr(sub_profile, "title_requirements")
                else (sub_profile.get("title_requirements", {}) if isinstance(sub_profile, dict) else {})
            )
            if title_reqs and isinstance(title_reqs, dict):
                max_len = title_reqs.get("max_length")
                if max_len and len(title) > max_len:
                    issues.append(
                        Issue(
                            field="title",
                            message=f"Subreddit r/{subreddit} title ({len(title)} chars) exceeds maximum {max_len} characters",
                            severity="error",
                            code="title_too_long",
                        )
                    )

        return issues

    async def publish(self, account: ConnectedAccount, variant: Any) -> PublishResult:
        """
        Submit post via POST https://oauth.reddit.com/api/submit.
        Strict anti-spam policy: explicitly per-variant, no automated cross-posting.
        """
        raw_access = decrypt_token(account.encrypted_access_token)
        if not raw_access:
            return PublishResult(
                success=False,
                error_message="Missing decrypted Reddit access token",
                is_retryable=False,
            )

        payload = getattr(variant, "payload", {})
        subreddit = payload.get("subreddit") or payload.get("target")
        if not subreddit:
            return PublishResult(
                success=False,
                error_message="Cannot publish to Reddit: missing target subreddit",
                is_retryable=False,
            )

        clean_sub = subreddit.lstrip("r/").strip()
        title = payload.get("title", "")
        post_type = payload.get("post_type", "text")
        body = payload.get("body") or payload.get("text", "")
        url = (
            payload.get("url")
            or payload.get("media_url")
            or payload.get("image_url")
            or payload.get("video_url")
        )
        flair_id = payload.get("flair_id")

        kind = "link" if (post_type in ["link", "image", "video"] and url) else "self"

        form_data: dict[str, Any] = {
            "api_type": "json",
            "sr": clean_sub,
            "kind": kind,
            "title": title,
            "resubmit": "true",
            "sendreplies": "true",
        }

        if kind == "self":
            form_data["text"] = body
        else:
            form_data["url"] = url

        if flair_id:
            form_data["flair_id"] = flair_id

        client = await self._get_client()
        try:
            resp = await client.post(
                f"{REDDIT_OAUTH_API_BASE}/api/submit",
                data=form_data,
                headers=self._headers(raw_access),
            )
        except Exception as exc:  # noqa: BLE001
            logger.error("Network error submitting to Reddit: %s", exc)
            return PublishResult(
                success=False,
                error_message=f"Network error: {exc}",
                is_retryable=True,
            )
        finally:
            if self._http_client is None:
                await client.aclose()

        if resp.status_code == 200:
            resp_json = resp.json()
            json_root = resp_json.get("json", {})
            errors = json_root.get("errors", [])
            if errors:
                err_code = errors[0][0] if errors[0] else "UNKNOWN"
                err_msg = errors[0][1] if len(errors[0]) > 1 else str(errors)
                is_retryable = "RATELIMIT" in str(err_code).upper()
                logger.warning("Reddit submit error: %s (%s)", err_msg, err_code)
                return PublishResult(
                    success=False,
                    error_message=f"Reddit rejected post: {err_msg} ({err_code})",
                    raw_response=resp_json,
                    is_retryable=is_retryable,
                )

            data = json_root.get("data", {})
            post_id = data.get("id") or data.get("name", "")
            post_url = data.get("url")

            return PublishResult(
                success=True,
                external_post_id=post_id,
                external_url=post_url,
                raw_response=resp_json,
            )

        is_retryable = resp.status_code in {429, 500, 502, 503, 504}
        error_msg = f"Reddit API error (HTTP {resp.status_code}): {resp.text}"
        return PublishResult(
            success=False,
            error_message=error_msg,
            raw_response={"status_code": resp.status_code, "body": resp.text},
            is_retryable=is_retryable,
        )

    async def delete_post(self, account: ConnectedAccount, external_post_id: str) -> None:
        """
        Delete a post via POST https://oauth.reddit.com/api/del.
        """
        raw_access = decrypt_token(account.encrypted_access_token)
        if not raw_access:
            raise ValueError("Missing decrypted access token")

        fullname = external_post_id if external_post_id.startswith("t3_") else f"t3_{external_post_id}"

        client = await self._get_client()
        try:
            resp = await client.post(
                f"{REDDIT_OAUTH_API_BASE}/api/del",
                data={"id": fullname},
                headers=self._headers(raw_access),
            )
        finally:
            if self._http_client is None:
                await client.aclose()

        if resp.status_code not in {200, 204}:
            logger.warning("Failed to delete Reddit post %s: %s", external_post_id, resp.text)
            raise RuntimeError(f"Failed to delete Reddit post (HTTP {resp.status_code}): {resp.text}")

    async def fetch_metrics(self, account: ConnectedAccount, external_post_id: str) -> Metrics:
        """
        Fetch post-level performance metrics (score, upvotes, comments, upvote ratio).
        """
        raw_access = decrypt_token(account.encrypted_access_token)
        if not raw_access:
            raise ValueError("Missing decrypted access token")

        fullname = external_post_id if external_post_id.startswith("t3_") else f"t3_{external_post_id}"

        client = await self._get_client()
        try:
            resp = await client.get(
                f"{REDDIT_OAUTH_API_BASE}/by_id/{fullname}",
                headers=self._headers(raw_access),
            )
        finally:
            if self._http_client is None:
                await client.aclose()

        if resp.status_code != 200:
            logger.warning("Failed to fetch Reddit metrics for %s: %s", external_post_id, resp.text)
            return Metrics()

        listing = resp.json().get("data", {}).get("children", [{}])
        post_data = listing[0].get("data", {}) if listing else {}

        score = post_data.get("score", 0)
        ups = post_data.get("ups", score)
        comments = post_data.get("num_comments", 0)
        upvote_ratio = post_data.get("upvote_ratio", 1.0)

        # Reddit upvotes correspond to likes/approvals
        return Metrics(
            impressions=post_data.get("view_count") or ups,
            reach=ups,
            engagements=ups + comments,
            likes=ups,
            comments=comments,
            extras={
                "score": score,
                "upvote_ratio": upvote_ratio,
                "total_awards_received": post_data.get("total_awards_received", 0),
            },
        )

    async def fetch_account_metrics(self, account: ConnectedAccount) -> AccountMetrics:
        """
        Fetch whole-account karma and profile statistics directly from original Reddit source.
        """
        raw_access = decrypt_token(account.encrypted_access_token)
        if not raw_access:
            raise ValueError("Missing decrypted access token")

        client = await self._get_client()
        try:
            resp = await client.get(
                f"{REDDIT_OAUTH_API_BASE}/api/v1/me",
                headers=self._headers(raw_access),
            )
        finally:
            if self._http_client is None:
                await client.aclose()

        if resp.status_code != 200:
            logger.warning("Failed to fetch Reddit account metrics for %s: %s", account.id, resp.text)
            return AccountMetrics()

        user_data = resp.json()
        total_karma = user_data.get("total_karma", 0)
        link_karma = user_data.get("link_karma", 0)
        comment_karma = user_data.get("comment_karma", 0)
        subscribers = user_data.get("subreddit", {}).get("subscribers", 0)

        return AccountMetrics(
            followers_count=subscribers,
            engagements=total_karma,
            extras={
                "total_karma": total_karma,
                "link_karma": link_karma,
                "comment_karma": comment_karma,
                "awarder_karma": user_data.get("awarder_karma", 0),
                "awardee_karma": user_data.get("awardee_karma", 0),
                "is_gold": user_data.get("is_gold", False),
            },
        )

    async def fetch_comments(
        self,
        account: ConnectedAccount,
        external_post_id: str | None = None,
        limit: int = 25,
    ) -> list[dict[str, Any]]:
        """
        Fetch comments on a specific post or incoming inbox comments for the account.
        """
        raw_access = decrypt_token(account.encrypted_access_token)
        if not raw_access:
            raise ValueError("Missing decrypted access token")

        client = await self._get_client()
        comments: list[dict[str, Any]] = []
        try:
            if external_post_id:
                clean_id = external_post_id.removeprefix("t3_")
                url = f"{REDDIT_OAUTH_API_BASE}/comments/{clean_id}?limit={limit}"
                resp = await client.get(url, headers=self._headers(raw_access))
                if resp.status_code == 200:
                    data = resp.json()
                    # data[1] is the comment listing
                    if isinstance(data, list) and len(data) > 1:
                        comment_children = data[1].get("data", {}).get("children", [])
                        for child in comment_children:
                            cdata = child.get("data", {})
                            if cdata.get("body"):
                                comments.append(
                                    {
                                        "id": cdata.get("id"),
                                        "fullname": cdata.get("name"),
                                        "author": cdata.get("author"),
                                        "body": cdata.get("body"),
                                        "score": cdata.get("score", 0),
                                        "created_utc": cdata.get("created_utc"),
                                        "permalink": f"https://reddit.com{cdata.get('permalink', '')}",
                                        "parent_id": cdata.get("parent_id"),
                                        "post_id": clean_id,
                                    }
                                )
            else:
                url = f"{REDDIT_OAUTH_API_BASE}/message/comments?limit={limit}"
                resp = await client.get(url, headers=self._headers(raw_access))
                if resp.status_code == 200:
                    data = resp.json().get("data", {})
                    children = data.get("children", [])
                    for child in children:
                        cdata = child.get("data", {})
                        comments.append(
                            {
                                "id": cdata.get("id"),
                                "fullname": cdata.get("name"),
                                "author": cdata.get("author"),
                                "body": cdata.get("body"),
                                "score": cdata.get("score", 0),
                                "created_utc": cdata.get("created_utc"),
                                "permalink": f"https://reddit.com{cdata.get('context', '')}",
                                "parent_id": cdata.get("parent_id"),
                                "post_title": cdata.get("link_title"),
                                "subreddit": cdata.get("subreddit"),
                            }
                        )
        finally:
            if self._http_client is None:
                await client.aclose()
        return comments

    async def post_comment_reply(
        self,
        account: ConnectedAccount,
        parent_id: str,
        text: str,
    ) -> dict[str, Any]:
        """
        Submit a manual reply from the SaaS UI to a comment or post via official Reddit API.
        """
        raw_access = decrypt_token(account.encrypted_access_token)
        if not raw_access:
            raise ValueError("Missing decrypted access token")

        thing_id = parent_id if "_" in parent_id else f"t1_{parent_id}"

        client = await self._get_client()
        try:
            resp = await client.post(
                f"{REDDIT_OAUTH_API_BASE}/api/comment",
                data={"thing_id": thing_id, "text": text, "api_type": "json"},
                headers=self._headers(raw_access),
            )
        finally:
            if self._http_client is None:
                await client.aclose()

        if resp.status_code != 200:
            logger.error("Failed to post Reddit reply: %s %s", resp.status_code, resp.text)
            raise HTTPException(
                status_code=resp.status_code,
                detail=f"Failed to post Reddit reply: {resp.text}",
            )

        resp_json = resp.json()
        errors = resp_json.get("json", {}).get("errors", [])
        if errors:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Reddit rejected comment reply: {errors}",
            )

        data = resp_json.get("json", {}).get("data", {}).get("things", [{}])[0].get("data", {})
        return {
            "id": data.get("id"),
            "fullname": data.get("name"),
            "author": data.get("author", account.display_name),
            "body": text,
            "parent_id": parent_id,
            "created_utc": data.get("created_utc", datetime.now(UTC).timestamp()),
        }

    async def search_discussions(
        self,
        account: ConnectedAccount,
        query: str,
        subreddit: str | None = None,
        sort: str = "relevance",
        time_filter: str = "week",
        limit: int = 15,
    ) -> list[dict[str, Any]]:
        """
        Search for active, relevant conversations on Reddit across communities or within a specific subreddit.
        """
        raw_access = decrypt_token(account.encrypted_access_token)
        if not raw_access:
            raise ValueError("Missing decrypted access token")

        client = await self._get_client()
        discussions: list[dict[str, Any]] = []
        try:
            params = {
                "q": query,
                "sort": sort,
                "t": time_filter,
                "limit": limit,
                "restrict_sr": "true" if subreddit else "false",
            }
            if subreddit:
                clean_sub = subreddit.strip().lstrip("r/")
                url = f"{REDDIT_OAUTH_API_BASE}/r/{clean_sub}/search"
            else:
                url = f"{REDDIT_OAUTH_API_BASE}/search"

            resp = await client.get(url, params=params, headers=self._headers(raw_access))
            if resp.status_code == 200:
                children = resp.json().get("data", {}).get("children", [])
                for child in children:
                    d = child.get("data", {})
                    discussions.append(
                        {
                            "id": d.get("id"),
                            "fullname": d.get("name"),
                            "title": d.get("title"),
                            "subreddit": d.get("subreddit"),
                            "author": d.get("author"),
                            "score": d.get("score", 0),
                            "num_comments": d.get("num_comments", 0),
                            "created_utc": d.get("created_utc"),
                            "permalink": f"https://reddit.com{d.get('permalink', '')}",
                            "url": d.get("url"),
                            "selftext_snippet": (d.get("selftext") or "")[:200],
                            "flair_text": d.get("link_flair_text"),
                        }
                    )
        finally:
            if self._http_client is None:
                await client.aclose()
        return discussions

    def generate_preview(
        self,
        payload: dict[str, Any],
        subreddit_profile: SubredditProfile | None = None,
        author_name: str = "u/your_username",
    ) -> dict[str, Any]:
        """
        Generate a Reddit-style UI post preview payload with badges, flair styling, and layout.
        """
        subreddit = (payload.get("subreddit") or payload.get("target") or "subreddit").lstrip("r/")
        title = payload.get("title", "Post Title")
        body = payload.get("body") or payload.get("text", "")
        post_type = payload.get("post_type", "text")
        url = payload.get("url") or payload.get("media_url")
        flair_id = payload.get("flair_id")

        flair_text = None
        if flair_id and subreddit_profile and subreddit_profile.available_flairs:
            for f in subreddit_profile.available_flairs:
                if f.get("id") == flair_id:
                    flair_text = f.get("text")
                    break

        return {
            "platform": "reddit",
            "subreddit": f"r/{subreddit}",
            "subreddit_icon_url": f"https://styles.redditmedia.com/t5_{subreddit}/icon.png",
            "author": author_name,
            "posted_ago": "just now",
            "title": title,
            "body_markdown": body,
            "post_type": post_type,
            "url": url,
            "flair": {
                "id": flair_id,
                "text": flair_text or payload.get("flair_text"),
                "bg_color": "#0079D3",
                "text_color": "#FFFFFF",
            }
            if (flair_id or payload.get("flair_text"))
            else None,
            "mock_upvotes": 1,
            "mock_comments_count": 0,
            "share_count": 0,
        }
