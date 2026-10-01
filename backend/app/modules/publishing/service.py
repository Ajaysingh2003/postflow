"""Publishing service handling scheduling, pre-publish validation,
idempotent publishing execution, exponential retries, and attempt audit logging.
"""

import logging
import random
from datetime import UTC, datetime, timedelta

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.channels.base import Issue, PublishResult
from app.modules.channels.models import ConnectedAccount, SubredditProfile
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

    # Subreddit-aware cached rule validation for Reddit
    sub_profile = None
    if variant.platform == "reddit" and db and isinstance(variant.payload, dict):
        raw_sub = variant.payload.get("subreddit") or variant.payload.get("target") or ""
        clean_sub = raw_sub.strip().lstrip("r/").lower()
        if clean_sub:
            sub_profile = db.scalar(
                select(SubredditProfile).where(SubredditProfile.name == clean_sub)
            )

    # Invoke platform adapter validation
    adapter_issues = await adapter.validate(variant, subreddit_profile=sub_profile)
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
    if post:
        check_scheduled_posts_limit(db, post.workspace_id)

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

    variant.scheduled_time = target_time
    variant.status = "scheduled"

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

    variant.status = "draft"
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

    # 3. Automatic Token Refresh if Expiring
    now_utc = datetime.now(UTC)
    if account.token_expires_at and account.token_expires_at <= now_utc + timedelta(minutes=5):
        try:
            logger.info("Account %s token expiring, refreshing before publish", account.id)
            await adapter.refresh_tokens(account)
            account.status = "active"
            account.last_synced_at = datetime.now(UTC)
            db.commit()
        except Exception as refresh_exc:  # noqa: BLE001
            logger.warning("Token refresh failed for account %s: %s", account.id, refresh_exc)
            account.status = "needs_reauth"
            variant.status = "failed"
            variant.last_error = (
                f"Token refresh failed: {refresh_exc}. Account marked needs_reauth."
            )
            attempt = PublishAttempt(
                variant_id=variant.id,
                started_at=now_utc,
                finished_at=datetime.now(UTC),
                result="auth_error",
                status_code=401,
                error=variant.last_error,
            )
            db.add(attempt)
            db.commit()
            db.refresh(attempt)
            return attempt

    # 4. Pre-publish Validation
    validation_issues = await validate_variant(variant, db)
    error_issues = [i for i in validation_issues if i.severity == "error"]
    if error_issues:
        error_msg = "; ".join(f"{i.field}: {i.message}" for i in error_issues)
        variant.status = "failed"
        variant.last_error = f"Pre-publish validation failed: {error_msg}"
        attempt = PublishAttempt(
            variant_id=variant.id,
            started_at=now_utc,
            finished_at=datetime.now(UTC),
            result="fatal_error",
            error=variant.last_error,
        )
        db.add(attempt)
        db.commit()
        db.refresh(attempt)
        return attempt

    # 5. Shared Platform Rate Limiter Check
    limiter = rate_limiter or shared_rate_limiter
    allowed, retry_after = await limiter.check_rate_limit(variant.platform, account.id)
    if not allowed:
        variant.attempt_count += 1
        variant.scheduled_time = datetime.now(UTC) + timedelta(seconds=max(5.0, retry_after))
        variant.status = "scheduled"
        variant.last_error = f"Platform rate limit hit. Rescheduled in {round(retry_after, 1)}s."
        attempt = PublishAttempt(
            variant_id=variant.id,
            started_at=now_utc,
            finished_at=datetime.now(UTC),
            result="retryable_error",
            status_code=429,
            error=variant.last_error,
        )
        db.add(attempt)
        db.commit()
        db.refresh(attempt)
        return attempt

    # 6. Publish Execution
    variant.status = "publishing"
    db.commit()

    started_at = datetime.now(UTC)
    status_code: int | None = 200
    try:
        publish_result: PublishResult = await adapter.publish(account, variant)
        await limiter.record_request(variant.platform, account.id)
    except Exception as exc:
        logger.exception("Publishing execution raised error for variant %s", variant.id)
        publish_result = PublishResult(
            success=False,
            error_message=f"Unhandled error during publish: {exc}",
            is_retryable=True,
        )
        status_code = 500

    finished_at = datetime.now(UTC)

    # 7. Process Result and Update Status / Audit Log
    if publish_result.success:
        variant.status = "published"
        variant.external_post_id = publish_result.external_post_id
        variant.last_error = None
        variant.attempt_count += 1
        attempt = PublishAttempt(
            variant_id=variant.id,
            started_at=started_at,
            finished_at=finished_at,
            result="success",
            status_code=status_code or 200,
            response_payload=publish_result.raw_response,
        )
        # Update post status if all variants finished
        post = variant.post
        if post:
            all_done = all(v.status in ("published", "failed") for v in post.variants)
            if all_done:
                post.status = (
                    "published"
                    if any(v.status == "published" for v in post.variants)
                    else "failed"
                )
    else:
        err_text = publish_result.error_message or "Unknown publication error"
        is_auth = (
            "401" in err_text
            or "unauthorized" in err_text.lower()
            or "invalid_grant" in err_text.lower()
            or "token has been expired" in err_text.lower()
            or "invalid access token" in err_text.lower()
        )

        if is_auth:
            account.status = "needs_reauth"
            variant.status = "failed"
            variant.last_error = f"Auth error: {err_text}. Account marked needs_reauth."
            attempt = PublishAttempt(
                variant_id=variant.id,
                started_at=started_at,
                finished_at=finished_at,
                result="auth_error",
                status_code=401,
                error=variant.last_error,
                response_payload=publish_result.raw_response,
            )
        elif publish_result.is_retryable:
            variant.attempt_count += 1
            if variant.attempt_count < MAX_ATTEMPTS:
                jitter = random.uniform(1.0, 5.0)
                backoff = (
                    min(
                        BASE_BACKOFF_SECONDS * (2 ** (variant.attempt_count - 1)),
                        MAX_BACKOFF_SECONDS,
                    )
                    + jitter
                )
                variant.scheduled_time = datetime.now(UTC) + timedelta(seconds=backoff)
                variant.status = "scheduled"
                variant.last_error = f"Transient error: {err_text}. Retrying in {round(backoff, 1)}s (attempt {variant.attempt_count}/{MAX_ATTEMPTS})."
                attempt = PublishAttempt(
                    variant_id=variant.id,
                    started_at=started_at,
                    finished_at=finished_at,
                    result="retryable_error",
                    status_code=status_code or 500,
                    error=variant.last_error,
                    response_payload=publish_result.raw_response,
                )
            else:
                variant.status = "failed"
                variant.last_error = f"Max retries ({MAX_ATTEMPTS}) exceeded: {err_text}"
                attempt = PublishAttempt(
                    variant_id=variant.id,
                    started_at=started_at,
                    finished_at=finished_at,
                    result="fatal_error",
                    status_code=status_code or 500,
                    error=variant.last_error,
                    response_payload=publish_result.raw_response,
                )
        else:
            variant.status = "failed"
            variant.last_error = f"Publish failed: {err_text}"
            attempt = PublishAttempt(
                variant_id=variant.id,
                started_at=started_at,
                finished_at=finished_at,
                result="fatal_error",
                status_code=status_code or 400,
                error=variant.last_error,
                response_payload=publish_result.raw_response,
            )

    db.add(attempt)
    db.commit()
    db.refresh(attempt)
    return attempt


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
