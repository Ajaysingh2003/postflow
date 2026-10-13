import logging
import secrets
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text

from app.core.config import get_settings
from app.core.logging import configure_safe_logging
from app.core.rate_limit import RateLimiter
from app.db import models as _models  # noqa: F401
from app.db.base import Base
from app.db.session import engine
from app.modules.agents.router import oauth_router as agent_oauth_router
from app.modules.agents.router import router as agents_router
from app.modules.agents.server import AgentTransport, create_mcp_application
from app.modules.analytics.router import router as analytics_router
from app.modules.assistant.router import router as assistant_router
from app.modules.billing.router import router as billing_router
from app.modules.channels.reddit_router import router as reddit_router
from app.modules.channels.router import router as channels_router
from app.modules.content.management_router import router as management_router
from app.modules.content.router import router as content_router
from app.modules.identity.router import router as identity_router
from app.modules.media.router import router as media_router
from app.modules.publishing.router import router as publishing_router
from app.modules.workspaces.router import router as workspaces_router

configure_safe_logging()
settings = get_settings()
logger = logging.getLogger("api")
rate_limiter = RateLimiter(settings)


@asynccontextmanager
async def lifespan(app: FastAPI):
    if settings.debug:
        Base.metadata.create_all(bind=engine)
    mcp, app.state.agent_transport = create_mcp_application()
    async with mcp.session_manager.run():
        yield


app = FastAPI(
    title="draftva API",
    version="0.1.0",
    lifespan=lifespan,
    docs_url="/docs" if settings.debug else None,
    redoc_url="/redoc" if settings.debug else None,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=[
        "Authorization",
        "Content-Type",
        "Idempotency-Key",
        "X-Workspace-ID",
        "MCP-Protocol-Version",
        "Mcp-Session-Id",
    ],
    expose_headers=["WWW-Authenticate", "Mcp-Session-Id"],
)


@app.middleware("http")
async def request_context(request: Request, call_next):
    request_id = request.headers.get("X-Request-ID") or secrets.token_hex(12)
    started = time.perf_counter()
    allowed, remaining, retry_after = await rate_limiter.check(request)
    if not allowed:
        return JSONResponse(
            status_code=429,
            content={"detail": "Rate limit exceeded"},
            headers={
                "Retry-After": str(retry_after),
                "X-RateLimit-Remaining": "0",
                "X-Request-ID": request_id,
            },
        )
    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    if remaining:
        response.headers["X-RateLimit-Remaining"] = str(remaining)
    logger.info(
        "request completed",
        extra={
            "request_id": request_id,
            "method": request.method,
            "path": request.url.path,
            "status_code": response.status_code,
            "duration_ms": round((time.perf_counter() - started) * 1000, 2),
        },
    )
    return response


@app.get("/health", tags=["system"])
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/ready", tags=["system"])
def readiness() -> dict[str, str]:
    with engine.connect() as connection:
        connection.execute(text("SELECT 1"))
    return {"status": "ready"}


for module_router in (
    agents_router,
    identity_router,
    workspaces_router,
    billing_router,
    channels_router,
    reddit_router,
    content_router,
    management_router,
    media_router,
    publishing_router,
    assistant_router,
    analytics_router,
):
    app.include_router(module_router, prefix="/api/v1")

app.include_router(agent_oauth_router)


@app.get("/.well-known/oauth-protected-resource")
@app.get("/.well-known/oauth-protected-resource/mcp")
def agent_resource_metadata():
    from app.modules.agents.security import SCOPES

    return {
        "resource": settings.mcp_url,
        "authorization_servers": [settings.mcp_url.removesuffix("/mcp")],
        "scopes_supported": list(SCOPES),
        "bearer_methods_supported": ["header"],
        "resource_name": "draftva",
    }


# Keep this last: the MCP transport shares the backend origin, while API routes remain explicit.
app.mount("/", AgentTransport())
