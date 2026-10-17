"""Short-lived Redis analytics, distributed refresh leases and HTTP-read budgets.

Metrics never go into the SQL database. Authorization is checked before every cache read.
"""

import asyncio
import hashlib
import json
import logging
import secrets
import time
from contextvars import ContextVar
from dataclasses import dataclass

from fastapi import HTTPException
from redis.asyncio import Redis
from redis.exceptions import RedisError

from app.core.config import get_settings

logger = logging.getLogger(__name__)
RELEASE = (
    "if redis.call('GET',KEYS[1]) == ARGV[1] then return redis.call('DEL',KEYS[1]) end return 0"
)
RESERVE = "local n=tonumber(redis.call('GET',KEYS[1]) or '0'); if n>=tonumber(ARGV[2]) then return -1 end; n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],ARGV[1]) end; return n"
COUNT = "local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],ARGV[1]) end; return n"


def connection():
    return Redis.from_url(
        get_settings().redis_url, decode_responses=True, socket_connect_timeout=2, socket_timeout=2
    )


@dataclass
class ReadBudget:
    workspace_id: str
    redis: object = None
    used: int = 0
    daily_used: int = 0

    async def consume(self, platform):
        settings = get_settings()
        if self.used >= settings.analytics_max_reads_per_refresh:
            raise HTTPException(
                429, "Analytics read budget reached. Narrow the date range or try later"
            )
        self.used += 1
        if self.redis is not None:
            bucket = int(time.time()) // 86400
            key = f"analytics:reads:{self.workspace_id}:{bucket}"
            try:
                reserved = int(
                    await self.redis.eval(
                        RESERVE, 1, key, 172800, settings.analytics_daily_read_limit
                    )
                )
            except RedisError as exc:
                raise HTTPException(
                    503, "Analytics cost protection is temporarily unavailable"
                ) from exc
            if reserved < 0:
                self.daily_used = settings.analytics_daily_read_limit
                raise HTTPException(
                    429, "Daily analytics read budget reached. Try again after midnight UTC"
                )
            self.daily_used = max(self.daily_used, reserved)
            await self.redis.eval(COUNT, 1, key + ":" + platform, 172800)


current_budget: ContextVar[ReadBudget | None] = ContextVar("analytics_read_budget", default=None)


async def count_read(platform):
    budget = current_budget.get()
    if budget is not None:
        await budget.consume(platform)


class PageLimit(Exception):
    pass


def pages():
    yield from range(get_settings().analytics_max_pages_per_account)
    raise PageLimit


async def cached_dashboard(workspace_id, identity, refresh, build):
    """One full bounded dataset serves every offset and posts/replies tab."""
    settings = get_settings()
    # Unit tests explicitly opt in with a fake/isolated Redis; never use developers' real cache.
    if settings.app_env == "test":
        budget = ReadBudget(workspace_id)
        token = current_budget.set(budget)
        try:
            return await build(), False, budget.used, 0
        finally:
            current_budget.reset(token)
    client = connection()
    key = (
        "analytics:dataset:v1:"
        + hashlib.sha256(json.dumps(identity, sort_keys=True).encode()).hexdigest()
    )
    lease = secrets.token_hex(16)
    acquired = False

    async def usage():
        return int(
            await client.get(f"analytics:reads:{workspace_id}:{int(time.time()) // 86400}") or 0
        )

    try:
        try:
            value = await client.get(key)
            old_value = value
            if value and not refresh:
                return json.loads(value), True, 0, await usage()
            acquired = bool(await client.set(key + ":lock", lease, nx=True, ex=180))
            if not acquired:
                for _ in range(6):
                    await asyncio.sleep(0.25)
                    value = await client.get(key)
                    if value and (not refresh or value != old_value):
                        return json.loads(value), True, 0, await usage()
                raise HTTPException(
                    429,
                    "Analytics is already updating. Please retry shortly",
                    headers={"Retry-After": "3"},
                )
            latest = await client.get(key)
            if latest and not refresh:
                return json.loads(latest), True, 0, await usage()
            # A per-workspace cooldown prevents date-range changes from bypassing refresh limits.
            if refresh and not await client.set(
                f"analytics:refresh:{workspace_id}",
                "1",
                nx=True,
                ex=settings.analytics_refresh_cooldown_seconds,
            ):
                raise HTTPException(
                    429,
                    "Please wait before refreshing analytics again",
                    headers={"Retry-After": str(settings.analytics_refresh_cooldown_seconds)},
                )
        except RedisError as exc:
            # Do not turn a Redis outage into unlimited paid provider reads.
            raise HTTPException(
                503, "Analytics cache is temporarily unavailable. Please retry"
            ) from exc
        budget = ReadBudget(workspace_id, client)
        token = current_budget.set(budget)
        try:
            data = await asyncio.wait_for(
                build(), timeout=settings.analytics_refresh_timeout_seconds
            )
        except TimeoutError as exc:
            raise HTTPException(
                504, "Analytics took too long. Choose one account or a shorter date range"
            ) from exc
        finally:
            current_budget.reset(token)
        encoded = json.dumps(data)
        if len(encoded.encode()) > settings.analytics_cache_max_bytes:
            raise HTTPException(
                422, "Analytics result is too large. Choose one account or a shorter date range"
            )
        try:
            await client.set(key, encoded, ex=settings.analytics_cache_ttl_seconds)
        except RedisError as exc:
            raise HTTPException(503, "Could not cache this analytics result. Please retry") from exc
        return data, False, budget.used, budget.daily_used
    finally:
        try:
            if acquired:
                await client.eval(RELEASE, 1, key + ":lock", lease)
        except RedisError:
            logger.warning("Analytics refresh lease will expire automatically")
        await client.aclose()
