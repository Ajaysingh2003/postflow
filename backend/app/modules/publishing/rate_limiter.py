"""Platform rate limiting for outbound publishing calls.

Ensures draftva adheres to official social network rate limits using
a shared Redis backend when available, or an in-memory fallback.
"""

import asyncio
import logging
import secrets
import time
from collections import defaultdict
from dataclasses import dataclass

from redis.asyncio import Redis

from app.core.config import get_settings

logger = logging.getLogger("publishing.rate_limiter")


@dataclass(frozen=True)
class RatePolicy:
    max_requests: int
    window_seconds: int
    scope: str = "account"


DEFAULT_PLATFORM_POLICIES: dict[str, RatePolicy] = {
    "x": RatePolicy(max_requests=50, window_seconds=900),  # 50 tweets per 15 min
    "linkedin": RatePolicy(max_requests=100, window_seconds=86400),  # 100 posts per 24 hrs
    "reddit": RatePolicy(max_requests=100, window_seconds=60, scope="app"),  # 100 requests per 60s
    "bluesky": RatePolicy(max_requests=300, window_seconds=300),  # 300 requests per 5 min
    "mastodon": RatePolicy(max_requests=300, window_seconds=300),  # 300 requests per 5 min
    "facebook": RatePolicy(max_requests=200, window_seconds=3600),  # 200 requests per hr
    "instagram": RatePolicy(max_requests=100, window_seconds=3600),
    "threads": RatePolicy(max_requests=100, window_seconds=3600),  # 100 requests per hr
}


class PlatformRateLimiter:
    def __init__(
        self,
        policies: dict[str, RatePolicy] | None = None,
        redis_client: Redis | None = None,
    ) -> None:
        self.policies = policies or DEFAULT_PLATFORM_POLICIES
        self._settings = get_settings()
        self._redis = redis_client
        self._lock = asyncio.Lock()
        self._blocked_until: dict[str, float] = {}
        # In-memory sliding log fallback: key -> list of monotonic timestamps
        self._memory_timestamps: dict[str, list[float]] = defaultdict(list)

    def _get_key(self, platform: str, account_id: str | None) -> str:
        policy = self.policies.get(platform)
        acc_part = "app" if policy and policy.scope == "app" else (account_id or "default")
        return f"rate_limit:publishing:{platform}:{acc_part}"

    async def acquire(self, platform: str, account_id: str | None = None) -> tuple[bool, float]:
        """Reserve capacity atomically before each HTTP request."""
        policy = self.policies.get(platform)
        if not policy:
            return True, 0
        key = self._get_key(platform, account_id)
        if self._blocked_until.get(key, 0) > time.time():
            return False, self._blocked_until[key] - time.time()
        if self._redis:
            script = """
            local now = tonumber(ARGV[1])
            redis.call('ZREMRANGEBYSCORE', KEYS[1], 0, now-tonumber(ARGV[2]))
            if redis.call('ZCARD', KEYS[1]) >= tonumber(ARGV[3]) then return 0 end
            redis.call('ZADD', KEYS[1], now, ARGV[4])
            redis.call('EXPIRE', KEYS[1], tonumber(ARGV[2])+10)
            return 1
            """
            try:
                blocked = await self._redis.ttl(key + ":blocked")
                if blocked > 0:
                    return False, float(blocked)
                allowed = await self._redis.eval(
                    script,
                    1,
                    key + ":bucket",
                    time.time(),
                    policy.window_seconds,
                    policy.max_requests,
                    secrets.token_hex(16),
                )
                return bool(allowed), 0 if allowed else float(policy.window_seconds)
            except Exception:  # noqa: BLE001
                if not self._settings.debug:
                    raise RuntimeError("Shared rate-limit storage is unavailable")
        async with self._lock:
            allowed, delay = await self.check_rate_limit(platform, account_id)
            if allowed:
                await self.record_request(platform, account_id)
            return allowed, delay

    async def observe(self, platform, account_id, headers):
        remaining = headers.get("x-ratelimit-remaining") or headers.get("x-rate-limit-remaining")
        reset = (
            headers.get("retry-after")
            or headers.get("x-ratelimit-reset")
            or headers.get("x-rate-limit-reset")
        )
        try:
            exhausted = remaining is not None and float(remaining) <= 0
        except ValueError:
            exhausted = False
        if reset and (headers.get("retry-after") or exhausted):
            try:
                delay = float(reset)
                if not headers.get("retry-after") and delay > time.time() - 3600:
                    delay -= time.time()
                key = self._get_key(platform, account_id)
                self._blocked_until[key] = time.time() + max(1, delay)
                if self._redis:
                    await self._redis.set(key + ":blocked", "1", ex=max(1, int(delay)))
            except ValueError:
                logger.debug("Unrecognized rate-limit reset header")

    async def check_rate_limit(
        self,
        platform: str,
        account_id: str | None = None,
    ) -> tuple[bool, float]:
        """
        Check if request is allowed under platform policy.
        Returns (is_allowed, retry_after_seconds).
        """
        policy = self.policies.get(platform.lower())
        if not policy:
            return True, 0.0

        key = self._get_key(platform, account_id)
        now = time.monotonic()

        # Clean old timestamps in-memory
        cutoff = now - policy.window_seconds
        timestamps = [ts for ts in self._memory_timestamps[key] if ts > cutoff]
        self._memory_timestamps[key] = timestamps

        if len(timestamps) >= policy.max_requests:
            # Over limit, calculate earliest expiration
            oldest = timestamps[0]
            retry_after = max(1.0, (oldest + policy.window_seconds) - now)
            return False, retry_after

        # Try redis if configured
        if self._redis:
            try:
                unix_now = time.time()
                redis_key = f"{key}:bucket"
                pipe = self._redis.pipeline()
                pipe.zremrangebyscore(redis_key, 0, unix_now - policy.window_seconds)
                pipe.zcard(redis_key)
                _, count = await pipe.execute()
                if count >= policy.max_requests:
                    return False, float(policy.window_seconds)
            except Exception as exc:  # noqa: BLE001
                logger.debug("Redis rate limit check error, using memory fallback: %s", exc)

        return True, 0.0

    async def record_request(
        self,
        platform: str,
        account_id: str | None = None,
    ) -> None:
        """Record an executed publishing request."""
        policy = self.policies.get(platform.lower())
        if not policy:
            return

        key = self._get_key(platform, account_id)
        now = time.monotonic()
        self._memory_timestamps[key].append(now)

        if self._redis:
            try:
                unix_now = time.time()
                redis_key = f"{key}:bucket"
                pipe = self._redis.pipeline()
                pipe.zadd(redis_key, {str(unix_now): unix_now})
                pipe.expire(redis_key, policy.window_seconds + 10)
                await pipe.execute()
            except Exception as exc:  # noqa: BLE001
                logger.debug("Redis rate limit record error: %s", exc)

    def reset(self) -> None:
        """Clear in-memory state (useful in tests)."""
        self._memory_timestamps.clear()


# Default singleton instance
shared_rate_limiter = PlatformRateLimiter(
    redis_client=Redis.from_url(get_settings().redis_url)
    if get_settings().app_env != "test"
    else None
)
