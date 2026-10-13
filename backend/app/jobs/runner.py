"""Background job runner for scheduling and queue processing,
and subreddit profiles refreshing.
"""

import asyncio
import logging
import signal
import time
from collections.abc import Coroutine
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.logging import configure_safe_logging
from app.db.session import SessionLocal
from app.modules.billing.service import reconcile_subscriptions
from app.modules.channels.oauth import refresh_expiring_accounts
from app.modules.channels.registry import channel_registry
from app.modules.content.models import PostVariant
from app.modules.publishing.service import publish_variant_job, recover_stale_publications

logger = logging.getLogger("jobs")
running = True
_job_runner = asyncio.Runner()


def _stop(*_) -> None:
    global running
    running = False


def _run_sync(coro: Coroutine[Any, Any, Any]) -> Any:
    """Safely run an async coroutine from synchronous code."""
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        loop = None

    if loop and loop.is_running():
        with ThreadPoolExecutor(max_workers=1) as executor:
            return executor.submit(asyncio.run, coro).result()
    return _job_runner.run(coro)


async def dispatch_due_async(db: Session) -> int:
    """
    Query and execute all post variants scheduled for now or in the past.
    Each variant executes independently; failure of one never blocks others.
    """
    now = datetime.now(UTC)
    variants = list(
        db.scalars(
            select(PostVariant)
            .where(
                PostVariant.status == "scheduled",
                PostVariant.scheduled_time <= now,
            )
            .order_by(PostVariant.scheduled_time.asc())
            .limit(100)
        )
    )

    if not variants:
        return 0

    processed = 0
    for variant in variants:
        try:
            await publish_variant_job(variant.id, db)
            processed += 1
        except Exception:
            db.rollback()
            logger.exception("Error processing scheduled variant %s", variant.id)

    return processed


def dispatch_due(db: Session | None = None) -> int:
    """Synchronous dispatcher entry point."""
    if db is not None:
        return _run_sync(dispatch_due_async(db))
    with SessionLocal() as session:
        return _run_sync(dispatch_due_async(session))


def process_queue(db: Session | None = None) -> int:
    """Worker alias for processing due publishing queue."""
    return dispatch_due(db)


async def refresh_channel_metadata_async(db: Session) -> int:
    count = 0
    for platform in channel_registry.list_supported_platforms():
        adapter = channel_registry.require(platform)
        refresh = getattr(adapter, "refresh_metadata", None)
        if refresh:
            count += await refresh(db)
    return count


def refresh_channel_metadata(db: Session | None = None) -> int:
    """Synchronous entry point for refreshing subreddit profiles."""
    if db is not None:
        return _run_sync(refresh_channel_metadata_async(db))
    with SessionLocal() as session:
        return _run_sync(refresh_channel_metadata_async(session))


def run(kind: str) -> None:
    """Main worker/scheduler loop daemon."""
    configure_safe_logging()
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
    signal.signal(signal.SIGTERM, _stop)
    signal.signal(signal.SIGINT, _stop)
    settings = get_settings()
    interval = (
        settings.scheduler_poll_seconds if kind == "scheduler" else settings.worker_poll_seconds
    )
    action = (lambda: 0) if kind == "scheduler" else process_queue
    logger.info("draftva %s started", kind)
    last_reconciliation = 0.0
    last_subreddit_refresh = 0.0
    last_token_refresh = 0.0

    while running:
        try:
            count = action()
            if count:
                logger.info("%s processed %s records", kind, count)

            now_mono = time.monotonic()
            if kind == "scheduler":
                if now_mono - last_token_refresh >= 300:
                    with SessionLocal() as db:
                        recover_stale_publications(db)
                        adapters = {
                            p: channel_registry.require(p)
                            for p in channel_registry.list_supported_platforms()
                        }
                        _run_sync(refresh_expiring_accounts(db, adapters))
                    last_token_refresh = now_mono
                # Hourly billing reconciliation
                if now_mono - last_reconciliation >= 3600:
                    with SessionLocal() as db:
                        reconciled = reconcile_subscriptions(settings, db)
                    last_reconciliation = now_mono
                    if reconciled:
                        logger.info("reconciled %s subscriptions", reconciled)

                # Periodic subreddit profiles refresh (every 4 hours)
                if now_mono - last_subreddit_refresh >= 14400:
                    refreshed = refresh_channel_metadata()
                    last_subreddit_refresh = now_mono
                    if refreshed:
                        logger.info("refreshed %s subreddit profiles", refreshed)

        except Exception:
            logger.exception("%s cycle failed", kind)
        time.sleep(interval)
