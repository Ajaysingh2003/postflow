"""Platform rate limiting for outbound publishing calls.

Ensures postflow adheres to official social network rate limits using
a shared Redis backend when available, or an in-memory fallback.
"""

import logging
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


DEFAULT_PLATFORM_POLICIES: dict[str, RatePolicy] = {
    "x": RatePolicy(max_requests=50, window_seconds=900),  # 50 tweets per 15 min
    "linkedin": RatePolicy(max_requests=100, window_seconds=86400),  # 100 posts per 24 hrs
    "reddit": RatePolicy(max_requests=100, window_seconds=60),  # 100 requests per 60s
    "bluesky": RatePolicy(max_requests=300, window_seconds=300),  # 300 requests per 5 min
    "mastodon": RatePolicy(max_requests=300, window_seconds=300),  # 300 requests per 5 min
    "facebook": RatePolicy(max_requests=200, window_seconds=3600),  # 200 requests per hr
    "instagram": RatePolicy(max_requests=100, window_seconds=3600),  # 100 requests per hr
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
        # In-memory sliding log fallback: key -> list of monotonic timestamps
        self._memory_timestamps: dict[str, list[float]] = defaultdict(list)

    def _get_key(self, platform: str, account_id: str | None) -> str:
        acc_part = account_id or "default"
        return f"rate_limit:publishing:{platform}:{acc_part}"

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
shared_rate_limiter = PlatformRateLimiter()
