import hashlib
import hmac
import ipaddress
import time

from fastapi import HTTPException, Request
from redis.asyncio import Redis

from app.core.config import Settings

POLICIES = (
    ("/oauth/", 30, 60),
    ("/mcp", 120, 60),
    ("/api/v1/agents/", 30, 60),
    ("/api/v1/auth/login", 20, 60),
    ("/api/v1/auth/register", 10, 900),
    ("/api/v1/auth/password", 20, 60),
    ("/api/v1/auth/google", 20, 60),
    ("/api/v1/auth/x/", 10, 60),
    ("/api/v1/auth/email", 12, 60),
    ("/api/v1/assistant/", 30, 60),
    ("/api/v1/channels/", 30, 60),
    ("/api/v1/media/uploads", 30, 60),
    ("/api/v1/media/attachments", 10, 60),
    ("/api/v1/analytics/", 60, 60),
    ("/api/v1/workspaces/invitations/", 20, 60),
    ("/api/v1/workspaces/current/invitations", 10, 60),
    ("/api/v1/webhooks/dodo", 180, 60),
)


class RateLimiter:
    def __init__(self, settings: Settings):
        self.enabled = settings.rate_limit_enabled
        self.allow_fallback = settings.debug
        self.proxy_secret = settings.auth_proxy_secret
        self.redis = Redis.from_url(settings.redis_url, decode_responses=True)
        self.fallback: dict[str, tuple[int, float]] = {}

    def policy(self, path: str) -> tuple[int, int] | None:
        for prefix, limit, window in POLICIES:
            if path.startswith(prefix):
                return limit, window
        return None

    def identity(self, request: Request) -> str:
        # Uvicorn handles forwarded IPs only from configured trusted proxies.
        # Raw X-Forwarded-For and arbitrary Authorization values cannot bypass auth limits.
        if (
            request.url.path.startswith("/api/v1/auth/")
            or request.url.path == "/api/v1/workspaces/invitations/preview"
        ):
            ip = request.headers.get("x-auth-client-ip", "")
            timestamp = request.headers.get("x-auth-client-timestamp", "")
            signature = request.headers.get("x-auth-client-signature", "")
            if self.proxy_secret and ip and timestamp and signature:
                try:
                    ipaddress.ip_address(ip)
                    fresh = abs(time.time() - int(timestamp)) <= 60
                    expected = hmac.new(
                        self.proxy_secret.encode(), f"{timestamp}:{ip}".encode(), hashlib.sha256
                    ).hexdigest()
                    if fresh and hmac.compare_digest(signature, expected):
                        return ip
                except ValueError:
                    return request.client.host if request.client else "unknown"
            return request.client.host if request.client else "unknown"
        authorization = request.headers.get("authorization", "")
        if authorization:
            return hashlib.sha256(authorization.encode()).hexdigest()[:24]
        return request.client.host if request.client else "unknown"

    async def consume(self, key, limit, window):
        bucket = int(time.time()) // window
        key = f"rate:{hashlib.sha256(key.encode()).hexdigest()}:{bucket}"
        try:
            count = await self.redis.eval(
                "local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],ARGV[1]) end; return n",
                1,
                key,
                window + 1,
            )
        except Exception as exc:
            if not self.allow_fallback:
                raise HTTPException(
                    503, "Authentication protection is temporarily unavailable. Please retry"
                ) from exc
            now = time.monotonic()
            count, expires = self.fallback.get(key, (0, now + window))
            if expires <= now:
                count, expires = 0, now + window
            count += 1
            self.fallback[key] = (count, expires)
            if len(self.fallback) > 10_000:
                self.fallback = {k: v for k, v in self.fallback.items() if v[1] > now}
        retry_after = window - (int(time.time()) % window)
        return count <= limit, max(0, limit - count), retry_after

    async def check(self, request: Request) -> tuple[bool, int, int]:
        policy = self.policy(request.url.path)
        if not self.enabled or policy is None:
            return True, 0, 0
        limit, window = policy
        result = await self.consume(
            request.url.path + ":ip:" + self.identity(request), limit, window
        )
        if not result[0]:
            return result
        if request.url.path.startswith("/api/v1/auth/") and request.method == "POST":
            body = await request.body()
            if len(body) > 16_384:
                raise HTTPException(413, "Authentication request is too large")
            try:
                import json

                data = json.loads(body)
            except (ValueError, UnicodeError):
                return result
            email = data.get("email") if isinstance(data, dict) else None
            if isinstance(email, str) and len(email) <= 320:
                if request.url.path.endswith("/login"):
                    per_email = (10, 900)
                elif request.url.path.endswith(("/email/resend", "/password/forgot")):
                    per_email = (5, 3600)
                else:
                    per_email = (20, 900)
                result = await self.consume(
                    request.url.path + ":email:" + email.strip().lower(), *per_email
                )
        return result
