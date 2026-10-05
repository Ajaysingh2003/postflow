"""Official API operations on posts published by this application.

These hooks are called only after workspace ownership and user intent checks.
Replies are manual; no monitoring or automatic response job is introduced.
"""

import re
from types import SimpleNamespace
from urllib.parse import quote

from fastapi import HTTPException

from app.core.config import get_settings
from app.modules.channels.management_types import ManagedResult, PostActions, PostReply, RepliesPage
from app.modules.channels.oauth import decrypt_token


class ManagedPosts:
    def reply_text_length(self, text):
        return len(text)

    async def management_request(self, account, method, url, **kwargs):
        client = await self._get_client()
        try:
            response = await client.request(method, url, **kwargs)
            response.raise_for_status()
            return response
        finally:
            if self._http_client is None:
                await client.aclose()

    def bearer(self, account):
        return {"Authorization": "Bearer " + (decrypt_token(account.encrypted_access_token) or "")}

    def post_actions(self, account, variant):
        return PostActions(notices=["Manage replies and edits on the original platform."])

    async def original_post_url(self, account, variant):
        return self.post_actions(account, variant).external_url

    async def delete_published_post(self, account, variant):
        await self.delete_post(account, variant.external_post_id)

    async def reply_to_post(self, account, variant, text, parent, key):
        raise HTTPException(422, "Replies are not available through this integration")

    async def edit_published_post(self, account, variant, text):
        raise HTTPException(422, "Published edits are not available through this integration")


class XManagement(ManagedPosts):
    def reply_text_length(self, text):
        from app.modules.channels.adapters.text import x_length

        return x_length(text)

    def post_actions(self, account, variant):
        return PostActions(can_read_replies=True, can_reply=True, can_delete=True, max_reply_length=280, external_url=f"https://x.com/i/status/{variant.external_post_id}", notices=["Reply search covers the last seven days and requires your app's search access. Published edits must be made on X."])

    async def list_post_replies(self, account, variant, cursor=None):
        params = {"query": f"conversation_id:{variant.external_post_id} is:reply", "max_results": 100, "tweet.fields": "author_id,created_at,referenced_tweets", "expansions": "author_id", "user.fields": "username"}
        if cursor:
            params["next_token"] = cursor
        response = await self.management_request(account, "GET", "https://api.x.com/2/tweets/search/recent", params=params, headers=self.bearer(account))
        data = response.json()
        users = {u["id"]: u.get("username", u["id"]) for u in data.get("includes", {}).get("users", [])}
        return RepliesPage(items=[PostReply(id=p["id"], author=users.get(p.get("author_id"), "X user"), text=p["text"], created_at=p.get("created_at")) for p in data.get("data", [])], next_cursor=data.get("meta", {}).get("next_token"), notice="Only replies indexed in X's recent search window are included.")

    async def reply_to_post(self, account, variant, text, parent, key):
        from app.modules.channels.adapters.text import x_length

        if x_length(text) > 280:
            raise HTTPException(422, "Reply exceeds X's weighted character limit")
        response = await self.management_request(account, "POST", "https://api.x.com/2/tweets", json={"text": text, "reply": {"in_reply_to_tweet_id": parent["id"] if parent else variant.external_post_id}}, headers=self.bearer(account))
        identifier = response.json()["data"]["id"]
        return ManagedResult(external_id=identifier, external_url=f"https://x.com/i/status/{identifier}", message="Reply sent")


class MastodonManagement(ManagedPosts):
    def post_actions(self, account, variant):
        domain = account.account_metadata.get("instance_domain", "")
        limit = account.account_metadata.get("instance_config", {}).get("max_characters", 500)
        return PostActions(can_read_replies=True, can_reply=True, can_edit=True, can_delete=True, max_reply_length=limit, external_url=f"https://{domain}/@{account.account_metadata.get('username', account.external_account_id)}/{variant.external_post_id}")

    def status_url(self, account, variant):
        return f"https://{account.account_metadata['instance_domain']}/api/v1/statuses/{quote(variant.external_post_id, safe='')}"

    async def list_post_replies(self, account, variant, cursor=None):
        response = await self.management_request(account, "GET", self.status_url(account, variant) + "/context", headers=self.bearer(account))
        return RepliesPage(items=[PostReply(id=p["id"], author=p["account"].get("acct", "Mastodon user"), text=re.sub(r"<[^>]+>", "", p.get("content", "")), created_at=p.get("created_at"), parent_id=p.get("in_reply_to_id")) for p in response.json().get("descendants", [])], notice="Replies known to the connected instance are shown.")

    async def reply_to_post(self, account, variant, text, parent, key):
        body = {"status": text, "in_reply_to_id": parent["id"] if parent else variant.external_post_id, "visibility": variant.payload.get("visibility", "public")}
        response = await self.management_request(account, "POST", self.status_url(account, variant).rsplit("/", 1)[0], json=body, headers={**self.bearer(account), "Idempotency-Key": key})
        data = response.json()
        return ManagedResult(external_id=data["id"], external_url=data.get("url"), message="Reply sent")

    async def edit_published_post(self, account, variant, text):
        # Keep all existing media and poll options; only update text/CW here.
        body = {"status": text, "spoiler_text": variant.payload.get("content_warning", ""), "sensitive": variant.payload.get("sensitive", False)}
        response = await self.management_request(account, "PUT", self.status_url(account, variant), json=body, headers=self.bearer(account))
        return ManagedResult(external_id=variant.external_post_id, external_url=response.json().get("url"), message="Published post updated")


class RedditManagement(ManagedPosts):
    def post_actions(self, account, variant):
        identifier = variant.external_post_id.removeprefix("t3_").removeprefix("t1_")
        scopes = set(account.granted_scopes or [])
        return PostActions(can_read_replies="read" in scopes, can_reply="submit" in scopes, can_edit="edit" in scopes and variant.payload.get("post_type", "text") == "text", can_delete="edit" in scopes, edit_field="body", max_reply_length=10000, external_url=f"https://www.reddit.com/comments/{identifier}/", notices=["Reddit titles and link destinations cannot be edited. Reconnect with the edit permission to edit or delete self-posts."])

    async def list_post_replies(self, account, variant, cursor=None):
        identifier = variant.external_post_id.removeprefix("t3_")
        response = await self.management_request(account, "GET", f"https://oauth.reddit.com/comments/{quote(identifier, safe='')}", params={"limit": 100, "depth": 8, "raw_json": 1}, headers=self._headers(decrypt_token(account.encrypted_access_token)))
        items = []
        truncated = False
        def walk(children):
            nonlocal truncated
            for row in children:
                if row.get("kind") == "more":
                    truncated = True
                if row.get("kind") != "t1":
                    continue
                data = row["data"]
                items.append(PostReply(id=data["name"], author=data.get("author", "[deleted]"), text=data.get("body", ""), parent_id=data.get("parent_id")))
                nested = data.get("replies")
                if isinstance(nested, dict):
                    walk(nested.get("data", {}).get("children", []))
        data = response.json()
        walk(data[1].get("data", {}).get("children", []) if isinstance(data, list) and len(data) > 1 else [])
        return RepliesPage(items=items, notice="Some collapsed replies need to be opened on Reddit." if truncated else None)

    async def reply_to_post(self, account, variant, text, parent, key):
        identifier = variant.external_post_id
        response = await self.management_request(account, "POST", "https://oauth.reddit.com/api/comment", data={"api_type": "json", "thing_id": parent["id"] if parent else (identifier if identifier.startswith("t3_") else "t3_" + identifier), "text": text}, headers=self._headers(decrypt_token(account.encrypted_access_token)))
        data = response.json().get("json", {})
        if data.get("errors"):
            raise HTTPException(422, "Reddit rejected the reply: " + str(data["errors"]))
        comment = data["data"]["things"][0]["data"]
        return ManagedResult(external_id=comment["name"], message="Reply sent")

    async def edit_published_post(self, account, variant, text):
        identifier = variant.external_post_id
        response = await self.management_request(account, "POST", "https://oauth.reddit.com/api/editusertext", data={"api_type": "json", "thing_id": identifier if identifier.startswith("t3_") else "t3_" + identifier, "text": text}, headers=self._headers(decrypt_token(account.encrypted_access_token)))
        if response.json().get("json", {}).get("errors"):
            raise HTTPException(422, "Reddit rejected the edit")
        return ManagedResult(external_id=identifier, message="Published body updated")


class LinkedInManagement(ManagedPosts):
    def post_actions(self, account, variant):
        organization = (variant.payload.get("target_urn") or variant.payload.get("author_urn") or "").startswith("urn:li:organization:")
        scope = "organization" if organization else "member"
        scopes = set(account.granted_scopes or [])
        return PostActions(can_read_replies=f"r_{scope}_social_feed" in scopes, can_reply=f"w_{scope}_social_feed" in scopes, can_edit=f"w_{scope}_social" in scopes, can_delete=f"w_{scope}_social" in scopes, max_reply_length=1250, external_url="https://www.linkedin.com/feed/update/" + quote(variant.external_post_id, safe=":"), notices=["Reading and sending comments requires approved LinkedIn social_feed permissions; reconnect after your app is approved."])

    def comment_url(self, variant):
        return "https://api.linkedin.com/rest/socialActions/" + quote(variant.external_post_id, safe="") + "/comments"

    async def list_post_replies(self, account, variant, cursor=None):
        start = int(cursor or "0")
        response = await self.management_request(account, "GET", self.comment_url(variant), params={"start": start, "count": 100}, headers=self._headers(decrypt_token(account.encrypted_access_token)))
        data = response.json()
        items = [PostReply(id=p.get("commentUrn", str(p["id"])), author=p.get("actor", "LinkedIn member"), text=p.get("message", {}).get("text", ""), parent_id=p.get("parentComment")) for p in data.get("elements", [])]
        total = data.get("paging", {}).get("total", start + len(items))
        return RepliesPage(items=items, next_cursor=str(start + len(items)) if start + len(items) < total else None)

    async def reply_to_post(self, account, variant, text, parent, key):
        actor = variant.payload.get("target_urn") or variant.payload.get("author_urn") or account.account_metadata.get("person_urn") or account.external_account_id
        body = {"actor": actor, "object": variant.external_post_id, "message": {"text": text}}
        if parent:
            body["parentComment"] = parent["id"]
        response = await self.management_request(account, "POST", self.comment_url(variant), json=body, headers=self._headers(decrypt_token(account.encrypted_access_token)))
        return ManagedResult(external_id=response.headers.get("x-restli-id") or response.json().get("id"), message="Reply sent")

    async def edit_published_post(self, account, variant, text):
        await self.management_request(account, "POST", "https://api.linkedin.com/rest/posts/" + quote(variant.external_post_id, safe=""), json={"patch": {"$set": {"commentary": text}}}, headers={**self._headers(decrypt_token(account.encrypted_access_token)), "X-RestLi-Method": "PARTIAL_UPDATE"})
        return ManagedResult(external_id=variant.external_post_id, message="Published post updated")


class BlueskyManagement(ManagedPosts):
    def reply_text_length(self, text):
        from app.modules.channels.adapters.text import graphemes

        return graphemes(text)

    def post_actions(self, account, variant):
        parts = variant.external_post_id.split("/")
        return PostActions(can_read_replies=True, can_reply=True, can_delete=True, max_reply_length=300, external_url=f"https://bsky.app/profile/{parts[2]}/post/{parts[-1]}" if len(parts) >= 5 else None, notices=["Bluesky does not support editing a published post in this integration."])

    async def thread_data(self, account, variant):
        client = await self._get_client()
        try:
            response = await self._oauth_request(client, "GET", account.account_metadata.get("pds_url", self.pds_url) + "/xrpc/app.bsky.feed.getPostThread", account=account, params={"uri": variant.external_post_id, "depth": 6, "parentHeight": 0})
            response.raise_for_status()
            return response.json()["thread"]
        finally:
            if self._http_client is None:
                await client.aclose()

    async def list_post_replies(self, account, variant, cursor=None):
        thread = await self.thread_data(account, variant)
        items = []
        def walk(node):
            for child in node.get("replies", []):
                post = child.get("post")
                if post:
                    items.append(PostReply(id=post["uri"], author=post.get("author", {}).get("handle", "Bluesky user"), text=post.get("record", {}).get("text", ""), created_at=post.get("record", {}).get("createdAt"), metadata={"cid": post["cid"]}))
                    walk(child)
        walk(thread)
        return RepliesPage(items=items, notice="Replies returned by the thread API are shown; hidden or deeper replies may remain on Bluesky.")

    async def reply_to_post(self, account, variant, text, parent, key):
        from app.modules.channels.adapters.text import graphemes

        if graphemes(text) > 300 or len(text.encode()) > 3000:
            raise HTTPException(422, "Reply exceeds Bluesky's grapheme/byte limit")
        thread = await self.thread_data(account, variant)
        post = thread["post"]
        root = post.get("record", {}).get("reply", {}).get("root") or {"uri": post["uri"], "cid": post["cid"]}
        target = {"uri": parent["id"], "cid": parent["metadata"]["cid"]} if parent else {"uri": post["uri"], "cid": post["cid"]}
        result = await self.publish(account, SimpleNamespace(payload={"text": text, "reply": {"root": root, "parent": target}}, idempotency_key=key, publish_state={}))
        if not result.success:
            raise HTTPException(502 if result.outcome_unknown else (result.status_code or 422), result.error_message or "Bluesky reply failed")
        return ManagedResult(external_id=result.external_post_id, external_url=result.external_url, message="Reply sent")


class ThreadsManagement(ManagedPosts):
    def post_actions(self, account, variant):
        scopes = set(account.granted_scopes or [])
        return PostActions(can_read_replies="threads_read_replies" in scopes, can_reply="threads_manage_replies" in scopes and "threads_content_publish" in scopes, can_delete="threads_delete" in scopes, max_reply_length=500, notices=["Reconnect with approved reply-management permissions to manage replies. Published text edits are not available through this integration."])

    async def list_post_replies(self, account, variant, cursor=None):
        params = {"fields": "id,text,username,timestamp", "limit": 100, "access_token": decrypt_token(account.encrypted_access_token)}
        if cursor:
            params["after"] = cursor
        response = await self.management_request(account, "GET", f"https://graph.threads.net/v1.0/{quote(variant.external_post_id, safe='')}/replies", params=params)
        data = response.json()
        return RepliesPage(items=[PostReply(id=p["id"], author=p.get("username", "Threads user"), text=p.get("text", ""), created_at=p.get("timestamp")) for p in data.get("data", [])], next_cursor=data.get("paging", {}).get("cursors", {}).get("after") if data.get("paging", {}).get("next") else None)

    async def reply_to_post(self, account, variant, text, parent, key):
        token = decrypt_token(account.encrypted_access_token)
        response = await self.management_request(account, "POST", f"https://graph.threads.net/v1.0/{account.external_account_id}/threads", data={"media_type": "TEXT", "text": text, "reply_to_id": parent["id"] if parent else variant.external_post_id, "access_token": token})
        identifier = response.json()["id"]
        response = await self.management_request(account, "POST", f"https://graph.threads.net/v1.0/{account.external_account_id}/threads_publish", data={"creation_id": identifier, "access_token": token})
        return ManagedResult(external_id=response.json()["id"], message="Reply sent")


class FacebookManagement(ManagedPosts):
    def post_actions(self, account, variant):
        scopes = set(account.granted_scopes or [])
        return PostActions(can_read_replies="pages_read_engagement" in scopes, can_reply="pages_manage_engagement" in scopes, can_edit="pages_manage_posts" in scopes and "_" in variant.external_post_id, can_delete="pages_manage_posts" in scopes, max_reply_length=8000, external_url=f"https://www.facebook.com/{variant.external_post_id}", notices=["Page replies need the pages_manage_engagement permission. Reconnect after your app is approved."])

    def management_token(self, account, variant):
        page = variant.payload.get("page_id") or variant.payload.get("target") or variant.payload.get("target_id")
        token = self._get_page_access_token(account, str(page))
        if not token:
            raise HTTPException(422, "Reconnect this Page to manage its posts")
        return token

    def graph_node(self, identifier):
        return f"https://graph.facebook.com/{get_settings().graph_api_version}/{quote(identifier, safe='')}"

    async def list_post_replies(self, account, variant, cursor=None):
        params = {"access_token": self.management_token(account, variant), "fields": "id,message,from,created_time", "limit": 100}
        if cursor:
            params["after"] = cursor
        response = await self.management_request(account, "GET", self.graph_node(variant.external_post_id) + "/comments", params=params)
        data = response.json()
        return RepliesPage(items=[PostReply(id=p["id"], author=p.get("from", {}).get("name", "Facebook user"), text=p.get("message", ""), created_at=p.get("created_time")) for p in data.get("data", [])], next_cursor=data.get("paging", {}).get("cursors", {}).get("after") if data.get("paging", {}).get("next") else None)

    async def reply_to_post(self, account, variant, text, parent, key):
        identifier = parent["id"] if parent else variant.external_post_id
        response = await self.management_request(account, "POST", self.graph_node(identifier) + "/comments", data={"access_token": self.management_token(account, variant), "message": text})
        return ManagedResult(external_id=response.json()["id"], message="Page reply sent")

    async def edit_published_post(self, account, variant, text):
        await self.management_request(account, "POST", self.graph_node(variant.external_post_id), data={"access_token": self.management_token(account, variant), "message": text})
        return ManagedResult(external_id=variant.external_post_id, message="Published Page post updated")

    async def delete_published_post(self, account, variant):
        await self.management_request(account, "DELETE", self.graph_node(variant.external_post_id), params={"access_token": self.management_token(account, variant)})


class InstagramManagement(ManagedPosts):
    def post_actions(self, account, variant):
        permitted = "instagram_business_manage_comments" in set(account.granted_scopes or [])
        return PostActions(can_read_replies=permitted, can_reply=permitted, reply_requires_parent=True, max_reply_length=2200, external_url=variant.payload.get("permalink") or (variant.publish_state or {}).get("external_url"), notices=["Select a comment to reply to. Caption edits and post deletion must be made on Instagram; comment management requires an approved permission."])

    def graph_node(self, identifier):
        return f"https://graph.instagram.com/{get_settings().graph_api_version}/{quote(identifier, safe='')}"

    async def original_post_url(self, account, variant):
        existing = self.post_actions(account, variant).external_url
        if existing:
            return existing
        response = await self.management_request(account, "GET", self.graph_node(variant.external_post_id), params={"fields": "permalink", "access_token": decrypt_token(account.encrypted_access_token)})
        return response.json().get("permalink")

    async def list_post_replies(self, account, variant, cursor=None):
        params = {"fields": "id,text,username,timestamp", "limit": 100, "access_token": decrypt_token(account.encrypted_access_token)}
        if cursor:
            params["after"] = cursor
        response = await self.management_request(account, "GET", self.graph_node(variant.external_post_id) + "/comments", params=params)
        data = response.json()
        return RepliesPage(items=[PostReply(id=p["id"], author=p.get("username", "Instagram user"), text=p.get("text", ""), created_at=p.get("timestamp")) for p in data.get("data", [])], next_cursor=data.get("paging", {}).get("cursors", {}).get("after") if data.get("paging", {}).get("next") else None)

    async def reply_to_post(self, account, variant, text, parent, key):
        if not parent:
            raise HTTPException(422, "Select an Instagram comment to reply to")
        response = await self.management_request(account, "POST", self.graph_node(parent["id"]) + "/replies", data={"message": text, "access_token": decrypt_token(account.encrypted_access_token)})
        return ManagedResult(external_id=response.json()["id"], message="Instagram comment reply sent")
