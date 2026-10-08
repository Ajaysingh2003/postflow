"""Publishing service handling scheduling, pre-publish validation,
idempotent publishing execution, exponential retries, and attempt audit logging.
"""

import logging
import random
from datetime import UTC, datetime, timedelta

import httpx
from fastapi import HTTPException, status
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.core.security import as_utc
from app.modules.channels.base import Issue, MediaProcessingPending, PublishResult
from app.modules.channels.models import ConnectedAccount
from app.modules.channels.registry import channel_registry
from app.modules.content.models import Post, PostVariant
from app.modules.publishing.models import PublishAttempt
from app.modules.publishing.rate_limiter import PlatformRateLimiter, shared_rate_limiter

logger = logging.getLogger("publishing.service")

MAX_ATTEMPTS = 5
BASE_BACKOFF_SECONDS = 10
MAX_BACKOFF_SECONDS = 3600


async def validate_variant(
    variant: PostVariant,
    db: Session | None = None,
) -> list[Issue]:
    """
    Validate post variant constraints against platform capabilities and cached rules.
    Runs both before scheduling and right before publishing.
    """
    issues: list[Issue] = []
    adapter = channel_registry.get(variant.platform)
    if not adapter:
        return [
            Issue(
                field="platform",
                message=f"Platform '{variant.platform}' has no registered adapter",
                severity="error",
                code="unknown_platform",
            )
        ]

    # Validate connected account existence and health if assigned
    if variant.connected_account_id and db:
        account = db.scalar(
            select(ConnectedAccount).where(ConnectedAccount.id == variant.connected_account_id)
        )
        if not account:
            issues.append(
                Issue(
                    field="connected_account_id",
                    message="Target connected account does not exist",
                    severity="error",
                    code="account_not_found",
                )
            )
        elif account.status in ("needs_reauth", "disabled"):
            issues.append(
                Issue(
                    field="connected_account_id",
                    message=f"Connected account '{account.display_name}' requires re-authentication (status: {account.status})",
                    severity="error",
                    code="account_unhealthy",
                )
            )

    if db and variant.connected_account_id:
        account = db.get(ConnectedAccount, variant.connected_account_id)
        post = db.get(Post, variant.post_id)
        if (
            account
            and post
            and (account.workspace_id != post.workspace_id or account.platform != variant.platform)
        ):
            return [
                Issue(
                    field="connected_account_id",
                    message="Account does not belong to this workspace/platform",
                    code="account_mismatch",
                )
            ]
        variant.validation_account = account
    prepare = getattr(adapter, "prepare_validation", None)
    if prepare and db:
        await prepare(variant, db)
    assets = []
    if db and variant.connected_account_id:
        from app.modules.media.publishing import media_for_variant

        assets = (
            media_for_variant(db, variant.validation_account, variant)
            if variant.validation_account
            else []
        )
        caps = (
            getattr(adapter, "account_capabilities", lambda _: adapter.capabilities)(
                variant.validation_account
            )
            if variant.validation_account
            else adapter.capabilities
        )
        groups = [assets]
        thread = variant.payload.get("thread")
        if caps.supports_threads and isinstance(thread, list) and thread:
            assigned = any(
                isinstance(item, dict) and ("media_ids" in item or "media_asset_ids" in item)
                for item in thread
            )
            mapped = {asset.id: (asset, alt) for asset, alt in assets}
            groups = []
            for index, item in enumerate(thread):
                ids = (
                    item.get("media_asset_ids", item.get("media_ids", []))
                    if isinstance(item, dict)
                    else []
                )
                if not isinstance(ids, list) or any(not isinstance(aid, str) for aid in ids):
                    issues.append(Issue(field="media", message="Invalid thread attachments"))
                    ids = []
                if any(aid not in mapped for aid in ids):
                    issues.append(
                        Issue(
                            field="media",
                            message="Thread attachment is unavailable in this variant",
                        )
                    )
                groups.append(
                    [mapped[aid] for aid in ids if aid in mapped]
                    if assigned
                    else (assets if index == 0 else [])
                )
        if any(len(group) > caps.max_media_count for group in groups):
            issues.append(Issue(field="media", message="Too many attachments for this account"))
        if any(a.content_type not in caps.supported_media_types for a, _ in assets):
            issues.append(Issue(field="media", message="Unsupported media type for this platform"))
        if not caps.supports_alt_text and any(alt for _, alt in assets):
            issues.append(Issue(field="media", message="This upload API does not support alt text"))
        if caps.max_alt_text_length and any(
            len(alt) > caps.max_alt_text_length for _, alt in assets
        ):
            issues.append(
                Issue(field="media", message="Attachment alt text exceeds the platform limit")
            )
        validate_media = getattr(adapter, "validate_media", None)
        if validate_media:
            for group in groups:
                if group:
                    issues.extend(await validate_media(group))
    adapter_issues = await adapter.validate(variant)
    if assets:
        adapter_issues = [
            i
            for i in adapter_issues
            if i.code != "media_required"
            and "contain text or media" not in i.message
            and "cannot be empty" not in i.message
        ]
    issues.extend(adapter_issues)
    return issues


async def schedule_variant(
    db: Session,
    variant_id: str,
    scheduled_time: datetime | None = None,
    bypass_validation: bool = False,
) -> PostVariant:
    """Schedule a variant for publication at a target UTC timestamp."""
    variant = db.scalar(select(PostVariant).where(PostVariant.id == variant_id))
    if not variant:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Variant not found")

    if variant.status == "published":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Variant is already published"
        )
    if (variant.publish_state or {}).get("outcome_unknown"):
        raise HTTPException(409, "Reconcile the previous publication before scheduling again")
    if variant.status == "publishing":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Variant is currently in the process of publishing",
        )
    if variant.status == "pending_approval":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Variant is pending team approval before it can be scheduled",
        )
    if variant.status == "rejected":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Variant was rejected during team review and cannot be scheduled",
        )

    # Enforce billing plan monthly scheduled posts quota
    from app.modules.billing.entitlements import check_scheduled_posts_limit

    post = variant.post

    # Pre-schedule validation
    if not bypass_validation:
        issues = await validate_variant(variant, db)
        error_issues = [i for i in issues if i.severity == "error"]
        if error_issues:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail={"issues": [i.model_dump() for i in error_issues]},
            )

    target_time = scheduled_time or datetime.now(UTC)
    if target_time.tzinfo is None:
        target_time = target_time.replace(tzinfo=UTC)

    if post and variant.status != "scheduled":
        check_scheduled_posts_limit(db, post.workspace_id)
    changed = db.execute(
        update(PostVariant)
        .where(
            PostVariant.id == variant.id,
            PostVariant.status == variant.status,
            PostVariant.publishing_started_at.is_(None),
        )
        .values(scheduled_time=target_time, status="scheduled")
    ).rowcount
    if changed != 1:
        db.rollback()
        raise HTTPException(409, "Publication changed while scheduling; reload this variant")
    db.refresh(variant)

    # Update parent post status if still draft
    post = variant.post
    if post and post.status == "draft":
        post.status = "scheduled"

    db.commit()
    db.refresh(variant)
    return variant


async def schedule_post(
    db: Session,
    post_id: str,
    scheduled_time: datetime | None = None,
) -> Post:
    """Schedule all draft variants of a post."""
    post = db.scalar(select(Post).where(Post.id == post_id))
    if not post:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")

    target_time = scheduled_time or datetime.now(UTC)
    if target_time.tzinfo is None:
        target_time = target_time.replace(tzinfo=UTC)

    scheduled_count = 0
    for variant in post.variants:
        if variant.status in ("draft", "failed"):
            await schedule_variant(
                db, variant.id, scheduled_time=target_time, bypass_validation=False
            )
            scheduled_count += 1

    post.status = "scheduled"
    db.commit()
    db.refresh(post)
    return post


def cancel_variant_schedule(db: Session, variant_id: str) -> PostVariant:
    """Revert a scheduled variant back to draft status."""
    variant = db.scalar(select(PostVariant).where(PostVariant.id == variant_id))
    if not variant:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Variant not found")

    if variant.status != "scheduled":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot cancel variant with status '{variant.status}'. Only 'scheduled' variants can be cancelled.",
        )

    changed = db.execute(
        update(PostVariant)
        .where(PostVariant.id == variant.id, PostVariant.status == "scheduled")
        .values(status="draft", scheduled_time=None)
    ).rowcount
    if changed != 1:
        db.rollback()
        raise HTTPException(409, "Publisher already claimed this variant")
    db.commit()
    db.refresh(variant)
    return variant


async def publish_variant_job(
    variant_id: str,
    db: Session,
    rate_limiter: PlatformRateLimiter | None = None,
) -> PublishAttempt:
    """
    Core publication job for an individual variant:
    - Independent per-variant execution (isolated failures)
    - Idempotency protection against double-posts
    - Account health checks & token refresh
    - Pre-publish validation
    - Shared platform rate limiting
    - Exponential backoff retry on transient errors
    - Needs-reauth marking on authentication errors
    - Publish attempt audit logging
    """
    variant = db.scalar(select(PostVariant).where(PostVariant.id == variant_id))
    if not variant:
        raise ValueError(f"PostVariant {variant_id} not found")

    # 1. Idempotency Guard: never double-publish
    if variant.status == "published" and variant.external_post_id:
        logger.info(
            "Variant %s already published (%s). Returning idempotent success.",
            variant_id,
            variant.external_post_id,
        )
        attempt = PublishAttempt(
            variant_id=variant.id,
            started_at=datetime.now(UTC),
            finished_at=datetime.now(UTC),
            result="success",
            status_code=200,
            response_payload={
                "idempotent_duplicate": True,
                "external_post_id": variant.external_post_id,
            },
        )
        db.add(attempt)
        db.commit()
        db.refresh(attempt)
        return attempt

    # 2. Account Resolution & Health Verification
    account: ConnectedAccount | None = None
    if variant.connected_account_id:
        account = db.scalar(
            select(ConnectedAccount).where(ConnectedAccount.id == variant.connected_account_id)
        )

    if not account:
        variant.status = "failed"
        variant.last_error = f"Connected account missing for variant {variant_id}"
        attempt = PublishAttempt(
            variant_id=variant.id,
            started_at=datetime.now(UTC),
            finished_at=datetime.now(UTC),
            result="fatal_error",
            error=variant.last_error,
        )
        db.add(attempt)
        db.commit()
        db.refresh(attempt)
        return attempt

    post = db.get(Post, variant.post_id)
    if (
        not post
        or account.workspace_id != post.workspace_id
        or account.platform != variant.platform
    ):
        raise HTTPException(403, "Account does not belong to the variant workspace/platform")
    if variant.status not in {"draft", "scheduled", "approved", "failed"}:
        raise HTTPException(409, "Variant is not available for publication")
    if account.status == "needs_reauth" and account.encrypted_refresh_token:
        adapter = channel_registry.get(variant.platform)
        if adapter:
            try:
                from app.modules.channels.oauth import refresh_account_tokens

                await refresh_account_tokens(db, account, adapter)
            except Exception as exc:  # noqa: BLE001
                logger.info(
                    "Just-in-time refresh for account %s did not recover: %s", account.id, exc
                )

    if account.status in ("needs_reauth", "disabled"):
        variant.status = "failed"
        variant.last_error = (
            f"Account '{account.display_name}' has status '{account.status}'. Re-auth required."
        )
        attempt = PublishAttempt(
            variant_id=variant.id,
            started_at=datetime.now(UTC),
            finished_at=datetime.now(UTC),
            result="auth_error",
            status_code=401,
            error=variant.last_error,
        )
        db.add(attempt)
        db.commit()
        db.refresh(attempt)
        return attempt

    adapter = channel_registry.get(variant.platform)
    if not adapter:
        variant.status = "failed"
        variant.last_error = f"Adapter for platform '{variant.platform}' not registered"
        attempt = PublishAttempt(
            variant_id=variant.id,
            started_at=datetime.now(UTC),
            finished_at=datetime.now(UTC),
            result="fatal_error",
            error=variant.last_error,
        )
        db.add(attempt)
        db.commit()
        db.refresh(attempt)
        return attempt

    post = db.get(Post, variant.post_id)
    if (
        not post
        or account.workspace_id != post.workspace_id
        or account.platform != variant.platform
    ):
        raise HTTPException(403, "Account does not belong to the variant workspace/platform")
    if variant.status not in {"draft", "scheduled", "approved", "failed"}:
        raise HTTPException(409, "Variant is not available for publication")
    if (variant.publish_state or {}).get("outcome_unknown"):
        raise HTTPException(409, "Previous publish outcome is unknown; reconcile before retrying")
    from app.modules.billing.entitlements import check_scheduled_posts_limit

    if variant.status != "scheduled":
        check_scheduled_posts_limit(db, post.workspace_id)
    cost = getattr(adapter, "publishing_cost", None)
    if cost:
        from app.modules.billing.usage import reserve_provider_cost

        reserve_provider_cost(
            db, post.workspace_id, variant, cost(variant), adapter.publishing_budget()
        )
    now = datetime.now(UTC)
    claimed = db.execute(
        update(PostVariant)
        .where(
            PostVariant.id == variant.id,
            PostVariant.status.in_(["draft", "scheduled", "approved", "failed"]),
        )
        .values(status="publishing", publishing_started_at=now)
    )
    if claimed.rowcount != 1:
        db.rollback()
        raise HTTPException(409, "Variant was claimed by another publisher")
    attempt = PublishAttempt(variant_id=variant.id, started_at=now, result="publishing")
    db.add(attempt)
    db.commit()
    db.refresh(variant)
    sending = False
    refreshing = False
    try:
        if account.token_expires_at and as_utc(account.token_expires_at) <= now + timedelta(
            minutes=5
        ):
            refreshing = True
            await adapter.refresh_tokens(account)
            account.last_synced_at = datetime.now(UTC)
            db.commit()
            refreshing = False
        issues = await validate_variant(variant, db)
        errors = [i for i in issues if i.severity == "error"]
        if errors:
            raise HTTPException(422, "; ".join(i.message for i in errors))
        limiter = rate_limiter or shared_rate_limiter
        allowed, delay = await limiter.acquire(variant.platform, account.id)
        if not allowed:
            raise HTTPException(
                429, "Platform rate limit reached", headers={"Retry-After": str(int(delay) + 1)}
            )

        async def persist_state():
            db.add(variant)
            db.commit()

        variant.persist_publish_state = persist_state
        from app.modules.media.publishing import prepare_media

        await prepare_media(db, account, variant, adapter)
        sending = True
        result = await adapter.publish(account, variant)
    except MediaProcessingPending as exc:
        result = PublishResult(
            success=False,
            waiting_for_media=True,
            is_retryable=True,
            status_code=503,
            error_message=str(exc.detail),
            retry_after=int(exc.headers["Retry-After"]),
        )
    except HTTPException as exc:
        result = PublishResult(
            success=False,
            status_code=exc.status_code,
            error_message=str(exc.detail),
            auth_error=refreshing or exc.status_code == 401,
            is_retryable=exc.status_code in {429, 502, 503},
            retry_after=int(exc.headers.get("Retry-After", 0)) if exc.headers else None,
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning("Publication %s interrupted (%s)", variant.id, type(exc).__name__)
        result = PublishResult(
            success=False,
            error_message=type(exc).__name__,
            auth_error=refreshing,
            outcome_unknown=sending,
            is_retryable=not sending and isinstance(exc, httpx.TransportError),
        )
    finished = datetime.now(UTC)
    attempt.finished_at = finished
    attempt.status_code = result.status_code
    attempt.response_payload = result.raw_response
    variant.publishing_started_at = None
    auth_error = result.auth_error or any(
        word in (result.error_message or "").lower()
        for word in (
            "401",
            "unauthorized",
            "invalid_grant",
            "invalid access token",
            "token has been expired",
        )
    )
    if result.success and not result.external_post_id:
        result = result.model_copy(
            update={
                "success": False,
                "outcome_unknown": True,
                "error_message": "Provider accepted publication without returning a post identifier",
            }
        )
    if result.success:
        variant.status = "published"
        variant.external_post_id = result.external_post_id
        variant.published_at = finished
        variant.last_error = None
        variant.attempt_count += 1
        attempt.result = "success"
        attempt.status_code = result.status_code or 200
        from app.modules.billing.models import UsageLedger

        for charge in db.scalars(
            select(UsageLedger).where(
                UsageLedger.reference_id == variant.id,
                UsageLedger.workspace_id == post.workspace_id,
            )
        ):
            charge.state = "settled"
    elif result.outcome_unknown:
        variant.status = "failed"
        variant.publish_state = {**(variant.publish_state or {}), "outcome_unknown": True}
        variant.last_error = (
            "Publication outcome is unknown; reconcile the remote post before retrying"
        )
        attempt.result = "outcome_unknown"
        attempt.error = variant.last_error
    elif auth_error:
        account.status = "needs_reauth"
        variant.status = "failed"
        variant.last_error = "Auth error: reconnect this account before publishing"
        attempt.result = "auth_error"
        attempt.status_code = 401
        attempt.error = variant.last_error
    else:
        if result.waiting_for_media:
            checks = (variant.publish_state or {}).get("processing_checks", 0) + 1
            variant.publish_state = {**(variant.publish_state or {}), "processing_checks": checks}
            if checks > 60:
                result.is_retryable = False
        else:
            variant.attempt_count += 1
        if result.is_retryable and variant.attempt_count < MAX_ATTEMPTS:
            delay = result.retry_after or min(
                BASE_BACKOFF_SECONDS * 2 ** max(0, variant.attempt_count - 1), MAX_BACKOFF_SECONDS
            ) + random.uniform(1, 5)
            variant.status = "scheduled"
            variant.scheduled_time = finished + timedelta(seconds=delay)
            attempt.result = "retryable_error"
            attempt.status_code = result.status_code or 500
        else:
            variant.status = "failed"
            attempt.result = "fatal_error"
            attempt.status_code = result.status_code or 400
        variant.last_error = result.error_message or "Publication failed"
        if variant.attempt_count >= MAX_ATTEMPTS:
            variant.last_error = f"Max retries ({MAX_ATTEMPTS}) exceeded: " + variant.last_error
        attempt.error = variant.last_error
    if all(v.status in {"published", "failed"} for v in post.variants):
        post.status = (
            "published" if any(v.status == "published" for v in post.variants) else "failed"
        )
    db.commit()
    db.refresh(attempt)
    return attempt


def recover_stale_publications(db: Session, now: datetime | None = None) -> int:
    """A crashed worker may have posted remotely; never automatically resend it."""
    cutoff = (now or datetime.now(UTC)) - timedelta(minutes=30)
    variants = list(
        db.scalars(
            select(PostVariant)
            .where(PostVariant.status == "publishing", PostVariant.publishing_started_at < cutoff)
            .with_for_update(skip_locked=True)
        )
    )
    for variant in variants:
        variant.status = "failed"
        variant.publish_state = {**(variant.publish_state or {}), "outcome_unknown": True}
        variant.last_error = (
            "Publisher stopped before recording an outcome; reconcile before retrying"
        )
        for attempt in db.scalars(
            select(PublishAttempt).where(
                PublishAttempt.variant_id == variant.id, PublishAttempt.result == "publishing"
            )
        ):
            attempt.result = "outcome_unknown"
            attempt.finished_at = datetime.now(UTC)
            attempt.error = variant.last_error
    db.commit()
    return len(variants)


def get_variant_attempts(db: Session, variant_id: str) -> list[PublishAttempt]:
    """Retrieve all audit attempts for a given post variant."""
    return list(
        db.scalars(
            select(PublishAttempt)
            .where(PublishAttempt.variant_id == variant_id)
            .order_by(PublishAttempt.started_at.desc())
        )
    )


def get_attempt(db: Session, attempt_id: str) -> PublishAttempt | None:
    """Retrieve a single publish attempt by ID."""
    return db.scalar(select(PublishAttempt).where(PublishAttempt.id == attempt_id))
