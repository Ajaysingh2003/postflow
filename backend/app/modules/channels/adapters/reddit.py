import logging
import urllib.parse
from datetime import UTC, datetime, timedelta
from typing import Any

import httpx
import regex
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.modules.channels.adapters.management import RedditManagement
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
from app.modules.channels.support import AdapterHTTP
from app.modules.content.models import PostVariant

logger = logging.getLogger(__name__)

# Reddit Official API Endpoints
REDDIT_AUTH_URL = "https://www.reddit.com/api/v1/authorize"
REDDIT_TOKEN_URL = "https://www.reddit.com/api/v1/access_token"
REDDIT_REVOKE_URL = "https://www.reddit.com/api/v1/revoke_token"
REDDIT_OAUTH_API_BASE = "https://oauth.reddit.com"

# Scopes needed for postflow: identity, submit, reading subreddits, flairs
REDDIT_SCOPES = ["identity", "submit", "read", "mysubreddits", "flair"]


class RedditAdapter(RedditManagement):
    """
    Official platform adapter for Reddit.
    Requires descriptive User-Agent, OAuth 2.0 with permanent refresh tokens,
    subreddit targeting, and adherence to subreddit rules and flair requirements.
    """

    platform = "reddit"
    required_credentials = ("client_id", "client_secret")

    def __init__(
        self,
        client_id: str | None = None,
        client_secret: str | None = None,
        user_agent: str | None = None,
        http_client: httpx.AsyncClient | None = None,
    ) -> None:
        settings = get_settings()
        self.client_id = client_id or settings.reddit_client_id or "reddit_client_id_placeholder"
        self.client_secret = (
            client_secret or settings.reddit_client_secret or "reddit_client_secret_placeholder"
        )
        self.user_agent = (
            user_agent or settings.reddit_user_agent or "web:postflow:v0.1.0 (by /u/postflowapp)"
        )
        self.redirect_base_url = settings.oauth_callback_url(self.platform)
        self._http_client = http_client

        self.capabilities = Capabilities(
            platform=self.platform,
            display_name="Reddit",
            max_text_length=40000,
            text_length_type="characters",
            supports_media=False,
            supported_media_types=[
                "image/jpeg",
                "image/png",
                "image/webp",
                "image/gif",
                "video/mp4",
            ],
            max_media_count=0,
            supports_video=False,
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
        return AdapterHTTP(self.platform)

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
        if opts.get("manage_replies"):
            scopes = list(dict.fromkeys([*scopes, "edit"]))

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
            logger.error(
                "Reddit token exchange failed: %s %s", token_resp.status_code, token_resp.text
            )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Reddit token exchange failed: {token_resp.text}",
            )

        token_data = token_resp.json()
        access_token = token_data.get("access_token")
        refresh_token = token_data.get("refresh_token")
        expires_in = token_data.get("expires_in", 3600)
        granted_scope_str = token_data.get("scope", "")
        granted_scopes = granted_scope_str.split(" ") if granted_scope_str else opts.get("oauth_metadata", {}).get("requested_scopes", REDDIT_SCOPES)

        # Fetch authenticated Reddit user identity
        user_info = await self._fetch_me(access_token)
        username = user_info.get("name", "Reddit User")
        reddit_id = user_info.get("id", username)

        raw_icon = user_info.get("icon_img") or user_info.get("snoovatar_img")
        icon_url = raw_icon.replace("&amp;", "&") if isinstance(raw_icon, str) else None

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
                "icon_img": icon_url,
                "avatar_url": icon_url,
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
            raise RuntimeError(
                f"Reddit token refresh failed (HTTP {resp.status_code}): {resp.text}"
            )

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
            resp = await client.post(
                REDDIT_REVOKE_URL,
                data=data,
                auth=auth,
                headers=self._headers(),
            )
            resp.raise_for_status()
        except Exception as exc:
            logger.warning("Error revoking Reddit token for %s: %s", account.id, exc)
            raise
        finally:
            if self._http_client is None:
                await client.aclose()

    async def list_targets(self, account):
        token = decrypt_token(account.encrypted_access_token)
        client = await self._get_client()
        targets = []
        after = None
        seen = set()
        try:
            while True:
                response = await client.get(
                    REDDIT_OAUTH_API_BASE + "/subreddits/mine/subscriber",
                    params={"limit": 100, **({"after": after} if after else {})},
                    headers=self._headers(token),
                )
                response.raise_for_status()
                listing = response.json()["data"]
                for child in listing.get("children", []):
                    data = child["data"]
                    name = data.get("display_name")
                    if (
                        name
                        and not data.get("user_is_banned")
                        and data.get("subreddit_type") != "private"
                    ):
                        targets.append(
                            Target(
                                id=name,
                                name="r/" + name,
                                target_type="subreddit",
                                description=data.get("public_description"),
                                metadata={
                                    "submission_type": data.get("submission_type"),
                                    "subreddit_type": data.get("subreddit_type"),
                                    "requires_approval": data.get("subreddit_type")
                                    in {"restricted", "private"},
                                },
                            )
                        )
                after = listing.get("after")
                if not after:
                    break
                if after in seen:
                    raise RuntimeError("Reddit pagination cursor repeated")
                seen.add(after)
            return targets
        finally:
            if self._http_client is None:
                await client.aclose()

    async def refresh_metadata(self, db):
        now = datetime.now(UTC)
        stale_cutoff = now - timedelta(hours=24)

        # 1. Existing cached profiles older than 24h
        profiles_to_refresh = list(
            db.scalars(
                select(SubredditProfile).where(
                    (SubredditProfile.fetched_at.is_(None))
                    | (SubredditProfile.fetched_at < stale_cutoff)
                )
            )
        )
        subreddits_to_check = {p.name for p in profiles_to_refresh}

        # Include every referenced community; no fixed first-page cap.
        recent_variants = list(
            db.scalars(
                select(PostVariant)
                .where(PostVariant.platform == "reddit")
                .order_by(PostVariant.created_at.desc())
            )
        )
        for v in recent_variants:
            if isinstance(v.payload, dict):
                raw = v.payload.get("subreddit") or v.payload.get("target") or ""
                clean = raw.strip().removeprefix("r/").lower()
                if clean:
                    subreddits_to_check.add(clean)

        if not subreddits_to_check:
            return 0

        # Find an active Reddit connected account to perform the queries
        account = db.scalar(
            select(ConnectedAccount).where(
                ConnectedAccount.platform == "reddit",
                ConnectedAccount.status == "active",
            )
        )
        if not account:
            logger.debug("No active Reddit account available to refresh subreddit profiles")
            return 0

        refreshed_count = 0
        for sub_name in subreddits_to_check:
            try:
                await self.refresh_subreddit_profile(db, account, sub_name)
                refreshed_count += 1
            except Exception:  # noqa: BLE001
                logger.warning("Failed to refresh subreddit profile for r/%s", sub_name)

        return refreshed_count

    async def refresh_subreddit_profile(
        self,
        db: Session,
        account: ConnectedAccount,
        subreddit_name: str,
    ) -> SubredditProfile:
        """
        Fetch and cache rules, flairs, and allowed post types in subreddit_profiles table.
        """
        clean_name = subreddit_name.strip().removeprefix("r/").lower()
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
            rules_resp.raise_for_status()
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
            flair_resp.raise_for_status()
            if flair_resp.status_code == 200:
                for f in flair_resp.json():
                    flairs.append({"id": f.get("id"), "text": f.get("text")})

            # 3. Fetch about info
            about_resp = await client.get(
                f"{REDDIT_OAUTH_API_BASE}/r/{clean_name}/about",
                headers=self._headers(raw_access),
            )
            about_resp.raise_for_status()
            if about_resp.status_code == 200:
                about_data = about_resp.json().get("data", {})
                if about_data.get("subreddit_type") == "private":
                    raise HTTPException(
                        422,
                        "Private communities require a workspace-scoped rules cache and are not supported",
                    )
                stype = about_data.get("submission_type", "any")
                if stype == "self":
                    allowed_types = ["text"]
                elif stype == "link":
                    allowed_types = ["link"]
                flair_required = bool(about_data.get("link_flair_required"))
            requirements_resp = await client.get(
                f"{REDDIT_OAUTH_API_BASE}/api/v1/{clean_name}/post_requirements",
                headers=self._headers(raw_access),
            )
            requirements_resp.raise_for_status()
            requirements = requirements_resp.json()
            flair_required = flair_required or bool(requirements.get("is_flair_required"))
            requirements = {
                **requirements,
                "max_length": requirements.get("title_text_max_length") or 300,
                "min_length": requirements.get("title_text_min_length") or 1,
            }
            if (
                about_data.get("user_is_banned")
                or about_data.get("subreddit_type") == "archived"
                or (
                    about_data.get("subreddit_type") == "restricted"
                    and not about_data.get("user_is_contributor")
                    and not about_data.get("user_is_moderator")
                )
            ):
                requirements["cannot_submit"] = True
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
            profile.title_requirements = requirements
            profile.fetched_at = now
        else:
            profile = SubredditProfile(
                name=clean_name,
                display_name=f"r/{clean_name}",
                rules=rules,
                allowed_post_types=allowed_types,
                flair_required=flair_required,
                available_flairs=flairs,
                title_requirements=requirements,
                fetched_at=now,
            )
            db.add(profile)

        db.commit()
        db.refresh(profile)
        return profile

    async def prepare_validation(self, variant, db):
        payload = variant.payload
        clean = (
            str(payload.get("subreddit") or payload.get("target") or "").removeprefix("r/").lower()
        )
        profile = db.scalar(select(SubredditProfile).where(SubredditProfile.name == clean))
        account = getattr(variant, "validation_account", None)
        from app.core.security import as_utc

        if (
            not profile
            or not profile.fetched_at
            or as_utc(profile.fetched_at) < datetime.now(UTC) - timedelta(hours=24)
        ):
            if account:
                profile = await self.refresh_subreddit_profile(db, account, clean)
            else:
                raise HTTPException(422, "Fresh subreddit rules are required before scheduling")
        variant.subreddit_profile = profile

    async def validate(self, variant: Any, **opts: Any) -> list[Issue]:
        """
        Validate Reddit post payload: target subreddit, title, body length, and cached subreddit rules.
        Payload example: {"subreddit": "...", "title": "...", "body": "...", "url": null, "flair_id": "...", "post_type": "text"}
        """
        issues: list[Issue] = []
        payload = getattr(variant, "payload", {})
        if not isinstance(payload, dict):
            return [
                Issue(field="payload", message="Invalid variant payload format", severity="error")
            ]

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
        if post_type not in {"text", "link"}:
            issues.append(
                Issue(
                    field="post_type",
                    message="Only text and link posts are supported by the approved Reddit integration",
                    code="unsupported_post_type",
                )
            )

        # Check cached subreddit profile if provided
        sub_profile = opts.get("subreddit_profile") or getattr(variant, "subreddit_profile", None)
        if sub_profile and subreddit:
            flairs = (
                getattr(sub_profile, "available_flairs", [])
                if not isinstance(sub_profile, dict)
                else sub_profile.get("available_flairs", [])
            )
            if payload.get("flair_id") and payload["flair_id"] not in {f.get("id") for f in flairs}:
                issues.append(
                    Issue(
                        field="flair_id",
                        message="Selected flair is not available in this subreddit",
                        code="invalid_flair",
                    )
                )
            flair_req = (
                getattr(sub_profile, "flair_required", False)
                if hasattr(sub_profile, "flair_required")
                else (
                    sub_profile.get("flair_required", False)
                    if isinstance(sub_profile, dict)
                    else False
                )
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
                else (
                    sub_profile.get("allowed_post_types", [])
                    if isinstance(sub_profile, dict)
                    else []
                )
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
                else (
                    sub_profile.get("title_requirements", {})
                    if isinstance(sub_profile, dict)
                    else {}
                )
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

        if sub_profile:
            req = (
                getattr(sub_profile, "title_requirements", {})
                if not isinstance(sub_profile, dict)
                else sub_profile.get("title_requirements", {})
            )
            if req.get("cannot_submit"):
                issues.append(
                    Issue(field="subreddit", message="This account cannot submit to the community")
                )
            for field, value, prefix in (("title", title, "title"), ("body", body, "body")):
                minimum = req.get(prefix + "_text_min_length") or (
                    req.get("min_length", 1) if field == "title" else 0
                )
                maximum = req.get(prefix + "_text_max_length") or (
                    300 if field == "title" else 40000
                )
                if not minimum <= len(value) <= maximum:
                    issues.append(
                        Issue(
                            field=field,
                            message="Content does not match the community length requirements",
                        )
                    )
                if any(
                    v.lower() in value.lower() for v in req.get(prefix + "_blacklisted_strings", [])
                ) or any(
                    v.lower() not in value.lower()
                    for v in req.get(prefix + "_required_strings", [])
                ):
                    issues.append(
                        Issue(
                            field=field,
                            message="Content does not match the community word requirements",
                        )
                    )
                for pattern in req.get(prefix + "_regexes", []):
                    try:
                        if not regex.search(pattern, value, timeout=0.02):
                            issues.append(
                                Issue(
                                    field=field,
                                    message="Content does not match the community pattern requirements",
                                )
                            )
                    except (regex.error, TimeoutError):
                        issues.append(
                            Issue(
                                field=field,
                                message="Community validation pattern could not be checked",
                            )
                        )
            if (
                post_type == "text"
                and req.get("body_restriction_policy") == "required"
                and not body.strip()
            ):
                issues.append(Issue(field="body", message="This community requires a post body"))
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

        clean_sub = subreddit.strip().removeprefix("r/")
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

        if post_type not in {"text", "link"}:
            return PublishResult(
                success=False, error_message="Only text and link posts are supported"
            )
        kind = "link" if post_type == "link" and url else "self"

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
                outcome_unknown=isinstance(exc, httpx.TransportError),
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
                    status_code=resp.status_code,
                    auth_error=resp.status_code == 401,
                    outcome_unknown=resp.status_code >= 500,
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

        is_retryable = resp.status_code == 429
        error_msg = f"Reddit API error (HTTP {resp.status_code}): {resp.text}"
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
        Delete a post via POST https://oauth.reddit.com/api/del.
        """
        raw_access = decrypt_token(account.encrypted_access_token)
        if not raw_access:
            raise ValueError("Missing decrypted access token")

        fullname = (
            external_post_id if external_post_id.startswith("t3_") else f"t3_{external_post_id}"
        )

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
            raise RuntimeError(
                f"Failed to delete Reddit post (HTTP {resp.status_code}): {resp.text}"
            )

    async def fetch_metrics(self, account: ConnectedAccount, external_post_id: str) -> Metrics:
        """
        Fetch post-level performance metrics (score, upvotes, comments, upvote ratio).
        """
        raw_access = decrypt_token(account.encrypted_access_token)
        if not raw_access:
            raise ValueError("Missing decrypted access token")

        fullname = (
            external_post_id if external_post_id.startswith("t3_") else f"t3_{external_post_id}"
        )

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
            raise RuntimeError("Metrics request failed or is unsupported")

        listing = resp.json().get("data", {}).get("children", [{}])
        post_data = listing[0].get("data", {}) if listing else {}

        score = post_data.get("score", 0)
        ups = post_data.get("ups", score)
        comments = post_data.get("num_comments", 0)
        upvote_ratio = post_data.get("upvote_ratio", 1.0)

        # Reddit upvotes correspond to likes/approvals
        return Metrics(
            impressions=post_data.get("view_count") or 0,
            reach=0,
            engagements=ups + comments,
            likes=ups,
            comments=comments,
            extras={
                "unavailable_metrics": ["reach", "clicks"]
                + (["impressions"] if post_data.get("view_count") is None else []),
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
            logger.warning(
                "Failed to fetch Reddit account metrics for %s: %s", account.id, resp.text
            )
            raise RuntimeError("Account metrics request failed or is unsupported")

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
