"""Official, paginated account feeds. These functions are bound by each adapter.

Only request-scoped data is returned. Never follow a provider-supplied URL with credentials.
"""

import html
import re
from datetime import UTC, datetime, timedelta
from urllib.parse import parse_qs, quote, urlsplit

from app.modules.channels.base import AnalyticsPost, AnalyticsPosts, Metrics
from app.modules.channels.oauth import decrypt_token


def timestamp(value):
    if isinstance(value, (float, int)):
        return datetime.fromtimestamp(value / 1000 if value > 10**12 else value, UTC)
    return datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(UTC)


def interactions(data, mapping, source, extras=None):
    values = {
        metric: int(data[key] or 0)
        for metric, key in mapping.items()
        if key in data and data[key] is not None
    }
    available = list(values)
    if {"likes", "comments", "shares_reposts"}.issubset(values):
        values["engagements"] = values["likes"] + values["comments"] + values["shares_reposts"]
        available.append("engagements")
    return Metrics(
        **values,
        extras={
            **(extras or {}),
            "metrics_status": "partial",
            "metrics_notice": "Only metrics returned by the platform are shown.",
            "available_metrics": ["shares" if v == "shares_reposts" else v for v in available],
            "metrics_source": source,
        },
    )


async def x_posts(self, account, start, end):
    from app.modules.channels.adapters.x import X_API_BASE

    token = decrypt_token(account.encrypted_access_token)
    headers = {"Authorization": f"Bearer {token}"}
    params = {
        "max_results": 100,
        "exclude": "retweets",
        "start_time": max(start, datetime(2010, 11, 6, tzinfo=UTC)).isoformat(timespec="seconds"),
        "end_time": end.isoformat(timespec="seconds"),
        "tweet.fields": "created_at,public_metrics,attachments,referenced_tweets,in_reply_to_user_id",
        "expansions": "attachments.media_keys",
        "media.fields": "url,preview_image_url",
    }
    client = await self._get_client()
    posts, replies, visited, seen, complete, notice = [], [], set(), set(), True, None
    try:
        while True:
            response = await client.get(
                f"{X_API_BASE}/users/{quote(account.external_account_id, safe='')}/tweets",
                headers=headers,
                params=params,
            )
            response.raise_for_status()
            data = response.json()
            if data.get("errors"):
                complete, notice = (
                    False,
                    "X returned incomplete timeline data. Some posts or metrics may be unavailable.",
                )
            media = {
                m["media_key"]: m.get("url") or m.get("preview_image_url")
                for m in data.get("includes", {}).get("media", [])
            }
            for item in data.get("data", []):
                references = (item.get("referenced_tweets") or []) + (
                    item.get("referenced_posts") or []
                )
                if item["id"] in seen or any(r.get("type") == "retweeted" for r in references):
                    continue
                seen.add(item["id"])
                is_reply = bool(item.get("in_reply_to_user_id")) or any(
                    r.get("type") == "replied_to" for r in references
                )
                (replies if is_reply else posts).append(
                    AnalyticsPost(
                        external_post_id=item["id"],
                        text=item.get("text", ""),
                        published_at=timestamp(item["created_at"]),
                        metrics=self.metrics_from_post(item),
                        is_reply=is_reply,
                        external_url=f"https://x.com/i/status/{item['id']}",
                        media_urls=[
                            media[k]
                            for k in item.get("attachments", {}).get("media_keys", [])
                            if media.get(k)
                        ],
                    )
                )
            cursor = data.get("meta", {}).get("next_token")
            if not cursor:
                break
            if cursor in visited:
                complete, notice = (
                    False,
                    "X repeated a pagination cursor; the dataset is incomplete.",
                )
                break
            visited.add(cursor)
            params["pagination_token"] = cursor
        # Enrich recent owned posts with private counters in batches, retaining public fields on denial.
        recent = [
            p for p in posts + replies if p.published_at >= datetime.now(UTC) - timedelta(days=30)
        ]
        for offset in range(0, len(recent), 100):
            batch = recent[offset : offset + 100]
            response = await client.get(
                f"{X_API_BASE}/tweets",
                headers=headers,
                params={
                    "ids": ",".join(p.external_post_id for p in batch),
                    "tweet.fields": "public_metrics,non_public_metrics,organic_metrics",
                },
            )
            if response.status_code != 200:
                notice = "X did not allow private analytics. Public metrics are shown; check API credits and account permissions."
                break
            enriched = {d["id"]: self.metrics_from_post(d) for d in response.json().get("data", [])}
            for post in batch:
                if post.external_post_id in enriched:
                    post.metrics = enriched[post.external_post_id]
        if len(posts) + len(replies) >= 3200:
            complete, notice = (
                False,
                "X's user timeline is limited to its most recent 3,200 posts. Older history is not included.",
            )
        return AnalyticsPosts(
            posts=posts, replies=replies, supports_replies=True, complete=complete, notice=notice
        )
    finally:
        if self._http_client is None:
            await client.aclose()


async def linkedin_posts(self, account, start, end):
    from app.modules.channels.adapters.linkedin import LINKEDIN_REST_BASE

    org = account.account_metadata.get("target_org_urn")
    if not org and account.external_account_id.startswith("urn:li:organization:"):
        org = account.external_account_id
    if not org:
        return AnalyticsPosts(
            complete=False,
            notice="LinkedIn personal-profile analytics is not available in this integration. Select a company Page to view its analytics.",
        )
    headers = {
        **self._headers(decrypt_token(account.encrypted_access_token)),
        "X-RestLi-Method": "FINDER",
    }
    client = await self._get_client()
    posts, offset, visited = [], 0, set()
    try:
        while True:
            response = await client.get(
                f"{LINKEDIN_REST_BASE}/posts",
                headers=headers,
                params={
                    "q": "author",
                    "author": org,
                    "count": 100,
                    "start": offset,
                    "sortBy": "LAST_MODIFIED",
                },
            )
            response.raise_for_status()
            data = response.json()
            for item in data.get("elements", []):
                if item.get("lifecycleState") != "PUBLISHED" or not item.get("publishedAt"):
                    continue
                published = timestamp(item["publishedAt"])
                if start <= published <= end:
                    posts.append(
                        AnalyticsPost(
                            external_post_id=item["id"],
                            text=item.get("commentary", ""),
                            published_at=published,
                        )
                    )
            next_link = next(
                (
                    link.get("href")
                    for link in data.get("paging", {}).get("links", [])
                    if link.get("rel") == "next"
                ),
                None,
            )
            if not next_link:
                break
            next_offset = parse_qs(urlsplit(next_link).query).get("start", [None])[0]
            if next_offset is None or int(next_offset) in visited or int(next_offset) <= offset:
                return AnalyticsPosts(
                    posts=posts,
                    complete=False,
                    notice="LinkedIn did not return valid pagination. The dataset is incomplete.",
                )
            offset = int(next_offset)
            visited.add(offset)
        return AnalyticsPosts(posts=posts)
    finally:
        if self._http_client is None:
            await client.aclose()


async def bluesky_posts(self, account, start, end):
    client = await self._get_client()
    params = {
        "actor": account.account_metadata.get("did") or account.external_account_id,
        "limit": 100,
        "filter": "posts_no_replies",
    }
    posts, cursors = [], set()
    try:
        while True:
            response = await self._oauth_request(
                client,
                "GET",
                f"{account.account_metadata.get('pds_url', self.pds_url)}/xrpc/app.bsky.feed.getAuthorFeed",
                params=params,
                account=account,
                headers={
                    "Authorization": f"Bearer {decrypt_token(account.encrypted_access_token)}"
                },
            )
            response.raise_for_status()
            data = response.json()
            for entry in data.get("feed", []):
                if entry.get("reason", {}).get("$type") == "app.bsky.feed.defs#reasonRepost":
                    continue
                item = entry["post"]
                if item.get("author", {}).get("did") != params["actor"]:
                    continue
                if item["record"].get("reply"):
                    continue
                published = timestamp(item["record"]["createdAt"])
                images = item.get("embed", {}).get("images", [])
                posts.append(
                    AnalyticsPost(
                        external_post_id=item["uri"],
                        text=item["record"].get("text", ""),
                        published_at=published,
                        media_urls=[i["thumb"] for i in images if i.get("thumb")],
                        metrics=interactions(
                            item,
                            {
                                "likes": "likeCount",
                                "comments": "replyCount",
                                "shares_reposts": "repostCount",
                            },
                            "app.bsky.feed.getAuthorFeed",
                            {"quoteCount": item.get("quoteCount")},
                        ),
                    )
                )
            cursor = data.get("cursor")
            if not cursor:
                break
            if cursor in cursors:
                return AnalyticsPosts(
                    posts=posts, complete=False, notice="Bluesky repeated its pagination cursor."
                )
            cursors.add(cursor)
            params["cursor"] = cursor
        return AnalyticsPosts(posts=posts)
    finally:
        if self._http_client is None:
            await client.aclose()


async def mastodon_posts(self, account, start, end):
    domain = account.account_metadata["instance_domain"]
    user_id = (
        account.account_metadata.get("user_id") or account.external_account_id.split("@", 1)[0]
    )
    client = await self._get_client()
    posts, cursors = [], set()
    params = {"limit": 40, "exclude_reblogs": "true", "exclude_replies": "true"}
    try:
        while True:
            response = await client.get(
                f"https://{domain}/api/v1/accounts/{quote(str(user_id), safe='')}/statuses",
                headers={
                    "Authorization": f"Bearer {decrypt_token(account.encrypted_access_token)}"
                },
                params=params,
            )
            response.raise_for_status()
            items = response.json()
            for item in items:
                # Mastodon's exclude_replies only excludes replies to other accounts.
                # Check the parent ID too so self-replies do not become original posts.
                if item.get("reblog") or item.get("in_reply_to_id"):
                    continue
                posts.append(
                    AnalyticsPost(
                        external_post_id=item["id"],
                        external_url=item.get("url"),
                        text=html.unescape(re.sub("<[^>]+>", "", item.get("content", ""))),
                        published_at=timestamp(item["created_at"]),
                        media_urls=[
                            m["preview_url"]
                            for m in item.get("media_attachments", [])
                            if m.get("preview_url")
                        ],
                        metrics=interactions(
                            item,
                            {
                                "likes": "favourites_count",
                                "comments": "replies_count",
                                "shares_reposts": "reblogs_count",
                            },
                            "Mastodon account statuses",
                        ),
                    )
                )
            next_url = response.links.get("next", {}).get("url")
            if not items or not next_url or timestamp(items[-1]["created_at"]) < start:
                break
            cursor = parse_qs(urlsplit(next_url).query).get("max_id", [None])[0]
            if not cursor or cursor in cursors:
                return AnalyticsPosts(
                    posts=posts, complete=False, notice="Mastodon returned invalid pagination."
                )
            cursors.add(cursor)
            params["max_id"] = cursor
        return AnalyticsPosts(posts=posts)
    finally:
        if self._http_client is None:
            await client.aclose()


async def reddit_posts(self, account, start, end):
    from app.modules.channels.adapters.reddit import REDDIT_OAUTH_API_BASE

    client = await self._get_client()
    headers = self._headers(decrypt_token(account.encrypted_access_token))
    posts, cursors = [], set()
    params = {"limit": 100, "sort": "new", "raw_json": 1}
    try:
        me = await client.get(f"{REDDIT_OAUTH_API_BASE}/api/v1/me", headers=headers)
        me.raise_for_status()
        username = me.json()["name"]
        while True:
            response = await client.get(
                f"{REDDIT_OAUTH_API_BASE}/user/{quote(username, safe='')}/submitted",
                headers=headers,
                params=params,
            )
            response.raise_for_status()
            data = response.json()["data"]
            items = [c["data"] for c in data.get("children", [])]
            for item in items:
                metrics = interactions(
                    item,
                    {"likes": "ups", "comments": "num_comments", "impressions": "view_count"},
                    "Reddit submitted listing",
                    {"score": item.get("score")},
                )
                posts.append(
                    AnalyticsPost(
                        external_post_id=item.get("name") or item["id"],
                        text=f"{item.get('title', '')}\n{item.get('selftext', '')}".strip(),
                        published_at=timestamp(item["created_utc"]),
                        metrics=metrics,
                        payload={"subreddit": item.get("subreddit")},
                    )
                )
            cursor = data.get("after")
            if not cursor or not items or timestamp(items[-1]["created_utc"]) < start:
                break
            if cursor in cursors:
                return AnalyticsPosts(
                    posts=posts, complete=False, notice="Reddit repeated its pagination cursor."
                )
            cursors.add(cursor)
            params["after"] = cursor
        return AnalyticsPosts(
            posts=posts,
            complete=len(posts) < 1000,
            notice="Reddit listings expose at most about 1,000 recent submissions."
            if len(posts) >= 1000
            else None,
        )
    finally:
        if self._http_client is None:
            await client.aclose()


async def _graph_posts(self, account, start, end, base, target, edge, fields, token):
    client = await self._get_client()
    params = {"fields": fields, "limit": 100, "access_token": token}
    posts, cursors = [], set()
    try:
        while True:
            response = await client.get(f"{base}/{quote(target, safe='')}/{edge}", params=params)
            response.raise_for_status()
            data = response.json()
            for item in data.get("data", []):
                published = timestamp(item.get("timestamp") or item["created_time"])
                posts.append(
                    AnalyticsPost(
                        external_post_id=item["id"],
                        text=item.get("caption") or item.get("message") or item.get("text") or "",
                        published_at=published,
                        external_url=item.get("permalink") or item.get("permalink_url"),
                        media_urls=[
                            u
                            for u in [
                                item.get("thumbnail_url")
                                or item.get("media_url")
                                or item.get("full_picture")
                            ]
                            if u
                        ],
                    )
                )
            paging = data.get("paging", {})
            if not paging.get("next"):
                break
            cursor = paging.get("cursors", {}).get("after")
            if not cursor or cursor in cursors:
                return AnalyticsPosts(
                    posts=posts, complete=False, notice="The platform returned invalid pagination."
                )
            cursors.add(cursor)
            params["after"] = cursor
            # Meta timeline edges are newest first; stop at the requested date.
            if posts and posts[-1].published_at < start:
                break
        return AnalyticsPosts(posts=posts)
    finally:
        if self._http_client is None:
            await client.aclose()


async def facebook_posts(self, account, start, end):
    from app.modules.channels.adapters.facebook import GRAPH_API_BASE

    pages = account.account_metadata.get("pages", [])
    target = account.account_metadata.get("primary_page_id") or (pages[0]["id"] if pages else None)
    if not target:
        return AnalyticsPosts(complete=False, notice="Select a Facebook Page to view analytics.")
    return await _graph_posts(
        self,
        account,
        start,
        end,
        GRAPH_API_BASE,
        str(target),
        "published_posts",
        "id,message,created_time,full_picture,permalink_url",
        self._get_page_access_token(account, str(target))
        or decrypt_token(account.encrypted_access_token),
    )


async def instagram_posts(self, account, start, end):
    target = str(account.account_metadata.get("primary_ig_id") or "")
    return await _graph_posts(
        self,
        account,
        start,
        end,
        self._analytics_api_base(account),
        target,
        "media",
        "id,caption,timestamp,media_url,thumbnail_url,permalink",
        self._get_ig_token(account, target),
    )


async def threads_posts(self, account, start, end):
    from app.modules.channels.adapters.threads import API

    return await _graph_posts(
        self,
        account,
        start,
        end,
        f"{API}/v1.0",
        account.external_account_id,
        "threads",
        "id,text,timestamp,media_url,thumbnail_url,permalink",
        decrypt_token(account.encrypted_access_token),
    )
