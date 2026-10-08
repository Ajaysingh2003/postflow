"""Threads official OAuth and container publishing API."""

import json
from datetime import UTC, datetime, timedelta
from ipaddress import ip_address
from typing import Any
from urllib.parse import urlencode, urlsplit

import httpx
from fastapi import HTTPException

from app.core.config import get_settings
from app.modules.channels.adapters.management import ThreadsManagement
from app.modules.channels.adapters.media import remote_urls, save_state
from app.modules.channels.adapters.meta_insights import coverage, fetch_insights
from app.modules.channels.base import (
    AccountMetrics,
    AuthStart,
    Capabilities,
    Issue,
    Metrics,
    PublishResult,
)
from app.modules.channels.models import ConnectedAccount
from app.modules.channels.oauth import decrypt_token, encrypt_token
from app.modules.channels.support import AdapterHTTP

API = "https://graph.threads.net"


class ThreadsAdapter(ThreadsManagement):
    from app.modules.channels.adapters.analytics_posts import threads_posts as fetch_analytics_posts

    platform = "threads"
    required_credentials = ("app_id", "app_secret")
    prepare_media = remote_urls

    def __init__(self, app_id=None, app_secret=None, http_client=None):
        settings = get_settings()
        self.app_id = app_id or settings.threads_app_id
        self.app_secret = app_secret or settings.threads_app_secret
        self.redirect_base_url = settings.oauth_callback_url("threads")
        self._http_client = http_client
        self.capabilities = Capabilities(
            platform="threads",
            display_name="Threads",
            max_text_length=500,
            supports_threads=True,
            max_media_count=20,
            supported_media_types=["image/jpeg", "image/png", "video/mp4"],
            supports_video=True,
            supports_polls=True,
            supports_account_metrics=True,
        )

    async def _get_client(self):
        return self._http_client or AdapterHTTP(self.platform)

    def _oauth_redirect_uri(self, opts: dict) -> str:
        uri = opts.get("redirect_uri") or self.redirect_base_url
        try:
            parsed = urlsplit(uri)
            hostname = (parsed.hostname or "").lower().rstrip(".")
            local = hostname == "localhost" or hostname.endswith(".localhost")
            try:
                address = ip_address(hostname)
                local = local or address.is_loopback or address.is_unspecified
            except ValueError:
                pass
            valid = (
                parsed.scheme == "https"
                and hostname
                and not local
                and not parsed.username
                and not parsed.password
                and not parsed.fragment
                and not any(char.isspace() for char in uri)
            )
            # Validate a supplied port without normalizing the registered URI.
            _ = parsed.port
        except (ValueError, TypeError):
            valid = False
        if not valid:
            raise HTTPException(
                422,
                "Threads login requires an HTTPS callback with a non-localhost hostname. "
                "Set THREADS_REDIRECT_URI to the exact URL registered in your Threads app settings.",
            )
        return uri

    async def build_auth_url(self, workspace_id, state, **opts):
        redirect_uri = self._oauth_redirect_uri(opts)
        scopes = ["threads_basic", "threads_content_publish", "threads_manage_insights"]
        if opts.get("manage_replies"):
            scopes.extend(["threads_read_replies", "threads_manage_replies", "threads_delete"])
        return AuthStart(
            state=state,
            metadata={"requested_scopes": scopes, "redirect_uri": redirect_uri},
            auth_url="https://threads.net/oauth/authorize?"
            + urlencode(
                {
                    "client_id": self.app_id,
                    "redirect_uri": redirect_uri,
                    "scope": ",".join(scopes),
                    "response_type": "code",
                    "state": state,
                }
            ),
        )

    async def handle_callback(self, workspace_id, params, state, **opts):
        if not params.get("code"):
            raise HTTPException(400, "Authorization code is required")
        # The router passes the URI stored with the state when login started.
        # It must also be used for exchange if configuration changes mid-login.
        redirect_uri = self._oauth_redirect_uri(opts)
        client = await self._get_client()
        try:
            response = await client.post(
                API + "/oauth/access_token",
                data={
                    "client_id": self.app_id,
                    "client_secret": self.app_secret,
                    "grant_type": "authorization_code",
                    "redirect_uri": redirect_uri,
                    "code": params["code"],
                },
            )
            response.raise_for_status()
            short = response.json()
            response = await client.get(
                API + "/access_token",
                params={
                    "grant_type": "th_exchange_token",
                    "client_secret": self.app_secret,
                    "access_token": short["access_token"],
                },
            )
            response.raise_for_status()
            tokens = response.json()
            response = await client.get(
                API + "/v1.0/me",
                params={
                    "fields": "id,username,name,threads_profile_picture_url",
                    "access_token": tokens["access_token"],
                },
            )
            response.raise_for_status()
            profile = response.json()
            threads_pic = profile.get("threads_profile_picture_url")
            return ConnectedAccount(
                workspace_id=workspace_id,
                platform="threads",
                external_account_id=str(profile["id"]),
                display_name=profile.get("username", profile["id"]),
                account_type="profile",
                encrypted_access_token=encrypt_token(tokens["access_token"]),
                token_expires_at=datetime.now(UTC)
                + timedelta(seconds=tokens.get("expires_in", 5184000)),
                granted_scopes=opts.get("oauth_metadata", {}).get(
                    "requested_scopes",
                    [
                        "threads_basic",
                        "threads_content_publish",
                        "threads_manage_insights",
                    ],
                ),
                status="active",
                account_metadata={
                    "username": profile.get("username"),
                    "threads_profile_picture_url": threads_pic,
                    "avatar_url": threads_pic,
                },
            )
        finally:
            if self._http_client is None:
                await client.aclose()

    async def refresh_tokens(self, account):
        client = await self._get_client()
        try:
            response = await client.get(
                API + "/refresh_access_token",
                params={
                    "grant_type": "th_refresh_token",
                    "access_token": decrypt_token(account.encrypted_access_token),
                },
            )
            response.raise_for_status()
            tokens = response.json()
            account.encrypted_access_token = encrypt_token(tokens["access_token"])
            account.token_expires_at = datetime.now(UTC) + timedelta(
                seconds=tokens.get("expires_in", 5184000)
            )
            return account
        finally:
            if self._http_client is None:
                await client.aclose()

    async def revoke(self, account):
        client = await self._get_client()
        try:
            response = await client.delete(
                API + "/v1.0/me/permissions",
                params={"access_token": decrypt_token(account.encrypted_access_token)},
            )
            response.raise_for_status()
        finally:
            if self._http_client is None:
                await client.aclose()

    async def list_targets(self, account):
        return []

    async def validate(self, variant):
        payload = variant.payload
        if "thread" in payload:
            from app.modules.channels.adapters.threading import validate_thread

            return await validate_thread(self, variant)
        issues = []
        if (
            not payload.get("text")
            and not payload.get("media_urls")
            and not payload.get("media_ids")
        ):
            issues.append(Issue(field="text", message="Post must contain text or media"))
        if len(payload.get("text", "")) > 500:
            issues.append(
                Issue(
                    field="text",
                    message="Threads text exceeds 500 characters",
                    code="text_too_long",
                )
            )
        if len(payload.get("media_urls", [])) > 20:
            issues.append(Issue(field="media", message="Threads allows at most 20 carousel items"))
        if "poll" in payload:
            poll = payload["poll"]
            options = poll.get("options") if isinstance(poll, dict) else None
            if (
                not isinstance(options, list)
                or not 2 <= len(options) <= 4
                or any(
                    not isinstance(option, str) or not 1 <= len(option.strip()) <= 25
                    for option in options
                )
            ):
                issues.append(
                    Issue(
                        field="poll",
                        message="A poll needs 2–4 nonempty options of at most 25 characters",
                    )
                )
            if (
                payload.get("media_urls")
                or payload.get("media_ids")
                or payload.get("link_attachment")
                or payload.get("text_attachment")
            ):
                issues.append(
                    Issue(
                        field="poll",
                        message="Threads polls require a text-only post without link or text attachments",
                    )
                )
        return issues

    async def publish(self, account, variant):
        if "thread" in variant.payload:
            from app.modules.channels.adapters.threading import publish_thread

            return await publish_thread(
                self,
                account,
                variant,
                lambda completed: {"reply_to_id": completed[-1]["id"]} if completed else {},
            )
        client = await self._get_client()
        token = decrypt_token(account.encrypted_access_token)
        state = getattr(variant, "publish_state", None) or {}
        sending = False
        try:
            creation = state.get("threads_container")
            if not creation:
                payload = variant.payload
                urls = payload.get("media_urls", [])
                data = {
                    "access_token": token,
                    "text": payload.get("text", ""),
                    "media_type": "TEXT",
                }
                if payload.get("reply_to_id"):
                    data["reply_to_id"] = payload["reply_to_id"]
                if payload.get("poll"):
                    data["poll_attachment"] = json.dumps(
                        {
                            f"option_{'abcd'[i]}": option.strip()
                            for i, option in enumerate(payload["poll"]["options"])
                        }
                    )
                if len(urls) > 1:
                    children = list(state.get("threads_children", []))
                    for index, url in enumerate(urls[len(children) :], start=len(children)):
                        video = payload.get("media_types", ["image/jpeg"] * len(urls))[
                            index
                        ].startswith("video/")
                        response = await client.post(
                            f"{API}/v1.0/{account.external_account_id}/threads",
                            data={
                                "access_token": token,
                                "media_type": "VIDEO" if video else "IMAGE",
                                "video_url" if video else "image_url": url,
                                "is_carousel_item": "true",
                                "alt_text": (payload.get("media_alt_texts") or [""] * len(urls))[
                                    index
                                ],
                            },
                        )
                        response.raise_for_status()
                        children.append(response.json()["id"])
                        await save_state(variant, threads_children=children)
                    for child in children:
                        response = await client.get(
                            f"{API}/v1.0/{child}",
                            params={"fields": "status,error_message", "access_token": token},
                        )
                        response.raise_for_status()
                        if response.json().get("status") != "FINISHED":
                            return PublishResult(
                                success=False,
                                is_retryable=response.json().get("status") == "IN_PROGRESS",
                                waiting_for_media=True,
                                retry_after=60,
                                error_message="Threads carousel media is not ready",
                            )
                    data.update(media_type="CAROUSEL", children=",".join(children))
                elif urls:
                    video = payload.get("media_types", ["image/jpeg"])[0].startswith("video/")
                    data.update(media_type="VIDEO" if video else "IMAGE")
                    data["video_url" if video else "image_url"] = urls[0]
                    data["alt_text"] = (payload.get("media_alt_texts") or [""])[0]
                response = await client.post(
                    f"{API}/v1.0/{account.external_account_id}/threads", data=data
                )
                response.raise_for_status()
                creation = response.json()["id"]
                await save_state(variant, threads_container=creation)
            response = await client.get(
                f"{API}/v1.0/{creation}",
                params={"fields": "status,error_message", "access_token": token},
            )
            response.raise_for_status()
            if response.json().get("status") != "FINISHED":
                pending = response.json().get("status") in {"IN_PROGRESS", "PUBLISHED"}
                return PublishResult(
                    success=False,
                    is_retryable=pending and response.json().get("status") != "PUBLISHED",
                    waiting_for_media=response.json().get("status") == "IN_PROGRESS",
                    retry_after=60,
                    outcome_unknown=response.json().get("status") == "PUBLISHED",
                    error_message="Threads container is not ready: "
                    + str(response.json().get("status")),
                )
            sending = True
            response = await client.post(
                f"{API}/v1.0/{account.external_account_id}/threads_publish",
                data={"creation_id": creation, "access_token": token},
            )
            response.raise_for_status()
            return PublishResult(
                success=True,
                external_post_id=str(response.json()["id"]),
                raw_response=response.json(),
            )
        except httpx.HTTPStatusError as exc:
            return PublishResult(
                success=False,
                status_code=exc.response.status_code,
                auth_error=exc.response.status_code == 401,
                is_retryable=exc.response.status_code == 429
                or (exc.response.status_code >= 500 and not sending),
                outcome_unknown=sending and exc.response.status_code >= 500,
                error_message="Threads API request failed",
            )
        except httpx.TransportError:
            return PublishResult(
                success=False,
                is_retryable=not sending,
                outcome_unknown=sending,
                error_message="Threads API connection interrupted",
            )
        finally:
            if self._http_client is None:
                await client.aclose()

    async def delete_post(self, account, external_post_id):
        client = await self._get_client()
        try:
            response = await client.delete(
                f"{API}/v1.0/{external_post_id}",
                params={"access_token": decrypt_token(account.encrypted_access_token)},
            )
            response.raise_for_status()
        finally:
            if self._http_client is None:
                await client.aclose()

    async def fetch_metrics(self, account, external_post_id, context: dict[str, Any] | None = None):
        client = await self._get_client()
        try:
            values, notice = await fetch_insights(
                client,
                f"https://graph.threads.com/v1.0/{external_post_id}/insights",
                {"access_token": decrypt_token(account.encrypted_access_token)},
                ["views", "likes", "replies", "reposts", "quotes"],
                "Threads",
                permissions="threads_basic and threads_manage_insights",
            )
            available = {
                name: values[key]
                for name, key in {"views": "views", "likes": "likes", "comments": "replies"}.items()
                if key in values
            }
            if {"reposts", "quotes"}.issubset(values):
                available["shares"] = values["reposts"] + values["quotes"]
            if {"likes", "replies", "reposts", "quotes"}.issubset(values):
                available["engagements"] = sum(
                    values[k] for k in ("likes", "replies", "reposts", "quotes")
                )
            return Metrics(
                views=values.get("views", 0),
                likes=values.get("likes", 0),
                comments=values.get("replies", 0),
                shares_reposts=values.get("reposts", 0) + values.get("quotes", 0),
                extras=coverage(available, notice, metrics_source="Threads insights", **values),
                engagements=sum(
                    values.get(k, 0) for k in ("likes", "replies", "reposts", "quotes")
                ),
            )
        finally:
            if self._http_client is None:
                await client.aclose()

    async def fetch_account_metrics(self, account):
        client = await self._get_client()
        try:
            # followers_count is a current total and must not receive since/until.
            values, notice = await fetch_insights(
                client,
                f"https://graph.threads.com/v1.0/{account.external_account_id}/threads_insights",
                {"access_token": decrypt_token(account.encrypted_access_token)},
                ["followers_count"],
                "Threads",
                permissions="threads_basic and threads_manage_insights",
            )
            return AccountMetrics(
                followers_count=values.get("followers_count", 0),
                extras=coverage(values, notice, metrics_source="Threads account insights"),
            )
        finally:
            if self._http_client is None:
                await client.aclose()
