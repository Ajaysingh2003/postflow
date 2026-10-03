"""Shared HTTP lifecycle; platform-specific requests stay inside adapters."""

import httpx
from fastapi import HTTPException

from app.modules.publishing.rate_limiter import shared_rate_limiter


class AdapterHTTP(httpx.AsyncClient):
    def __init__(self, platform: str, account_id: str = "app", **kwargs):
        self.platform = platform
        self.account_id = account_id
        super().__init__(timeout=30, **kwargs)

    async def send(self, request, **kwargs):
        allowed, delay = await shared_rate_limiter.acquire(self.platform, self.account_id)
        if not allowed:
            raise HTTPException(
                429, "Platform request limit exceeded", headers={"Retry-After": str(int(delay) + 1)}
            )
        response = await super().send(request, **kwargs)
        await shared_rate_limiter.observe(self.platform, self.account_id, response.headers)
        return response


def require_credentials(adapter, *names):
    if any(
        not getattr(adapter, name, None) or "placeholder" in str(getattr(adapter, name))
        for name in names
    ):
        raise HTTPException(503, f"{adapter.platform} OAuth is not configured")
