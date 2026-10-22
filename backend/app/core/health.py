"""Dependency readiness with bounded timeouts and no connection details in responses."""

import logging

from fastapi import HTTPException
from redis import Redis
from redis.exceptions import RedisError
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.core.config import get_settings
from app.db.session import engine

logger = logging.getLogger(__name__)


def check_dependencies() -> None:
    dependency = "database"
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        settings = get_settings()
        if settings.rate_limit_enabled:
            dependency = "redis"
            with Redis.from_url(
                settings.redis_url, socket_connect_timeout=2, socket_timeout=2
            ) as cache:
                cache.ping()
    except (SQLAlchemyError, RedisError, OSError, ValueError) as exc:
        logger.warning("Readiness check failed for %s", dependency)
        raise HTTPException(503, "Backend dependencies are not ready") from exc
