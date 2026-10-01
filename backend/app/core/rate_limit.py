import hashlib
import time

from fastapi import Request
from redis.asyncio import Redis

from app.core.config import Settings

POLICIES = (
    ("/api/v1/auth/", 20, 60),
    ("/api/v1/assistant/", 30, 60),
    ("/api/v1/channels/", 30, 60),
    ("/api/v1/media/uploads", 30, 60),
    ("/api/v1/webhooks/dodo", 180, 60),
)


class RateLimiter:
    def __init__(self, settings: Settings):
        self.enabled = settings.rate_limit_enabled
        self.redis = Redis.from_url(settings.redis_url, decode_responses=True)
        self.fallback: dict[str, tuple[int, float]] = {}

    def policy(self, path: str) -> tuple[int, int] | None:
        for prefix, limit, window in POLICIES:
            if path.startswith(prefix):
                return limit, window
        return None

    @staticmethod
    def identity(request: Request) -> str:
        authorization = request.headers.get("authorization", "")
        if authorization:
            return hashlib.sha256(authorization.encode()).hexdigest()[:24]
        forwarded = request.headers.get("x-forwarded-for", "").split(",", 1)[0].strip()
        return forwarded or (request.client.host if request.client else "unknown")

    async def check(self, request: Request) -> tuple[bool, int, int]:
        policy = self.policy(request.url.path)
        if not self.enabled or policy is None:
            return True, 0, 0
        limit, window = policy
        bucket = int(time.time()) // window
        key = f"rate:{request.url.path.split('/', 5)[:5]}:{self.identity(request)}:{bucket}"
        try:
            count = await self.redis.incr(key)
            if count == 1:
                await self.redis.expire(key, window + 1)
        except Exception:  # noqa: BLE001
            now = time.monotonic()
            count, expires = self.fallback.get(key, (0, now + window))
            if expires <= now:
                count, expires = 0, now + window
            count += 1
            self.fallback[key] = (count, expires)
        retry_after = window - (int(time.time()) % window)
        return count <= limit, max(0, limit - count), retry_after
