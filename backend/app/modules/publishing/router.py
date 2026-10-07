"""FastAPI router for publishing operations: scheduling, immediate publishing,
pre-flight validation, and audit attempts.
"""

from datetime import datetime, timedelta
from typing import Any
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from app.core.dependencies import (
    get_current_user,
    get_current_workspace,
    require_content_access,
    require_roles,
)
from app.core.security import as_utc
from app.db.session import get_db
from app.modules.channels.models import ConnectedAccount
from app.modules.content.models import Post, PostVariant
from app.modules.identity.models import User, Workspace
from app.modules.publishing.models import PublishAttempt
from app.modules.publishing.schemas import (
    CalendarEntryResponse,
    CalendarPageResponse,
    PublishAttemptResponse,
    SchedulePostRequest,
    ScheduleVariantRequest,
    ValidateVariantResponse,
    ValidationIssueResponse,
    VariantPublishResultResponse,
)
from app.modules.publishing.service import (
    cancel_variant_schedule,
    get_attempt,
    get_variant_attempts,
    publish_variant_job,
    schedule_post,
    schedule_variant,
    validate_variant,
)

router = APIRouter(
    prefix="/publishing",
    tags=["publishing"],
    dependencies=[Depends(require_content_access)],
)


@router.get("/calendar", response_model=CalendarPageResponse)
def calendar_entries(
    start: datetime,
    end: datetime,
    cursor: int = Query(default=0, ge=0),
    limit: int = Query(default=200, ge=1, le=200),
    workspace: Workspace = Depends(get_current_workspace),
    db: Session = Depends(get_db),
) -> CalendarPageResponse:
    """Page through this workspace's dated publications in a half-open UTC range."""
    if start.tzinfo is None or end.tzinfo is None:
        raise HTTPException(422, "Calendar dates must include a timezone")
    start, end = as_utc(start), as_utc(end)
    if end <= start or end - start > timedelta(days=63):
        raise HTTPException(422, "Choose a calendar range of up to 63 days")
    event_time = case(
        (PostVariant.status == "published", func.coalesce(PostVariant.published_at, PostVariant.scheduled_time, PostVariant.updated_at)),
        (PostVariant.status == "failed", func.coalesce(PostVariant.scheduled_time, PostVariant.updated_at)),
        else_=PostVariant.scheduled_time,
    )
    rows = db.execute(
        select(PostVariant, Post.title, event_time.label("event_time"))
        .join(Post, Post.id == PostVariant.post_id)
        .where(
            Post.workspace_id == workspace.id,
            PostVariant.status.in_(["scheduled", "publishing", "published", "failed"]),
            event_time >= start,
            event_time < end,
        )
        .order_by(event_time, PostVariant.id)
        .offset(cursor)
        .limit(limit + 1)
    ).all()
    return CalendarPageResponse(
        items=[CalendarEntryResponse(post_title=title, time=as_utc(time), variant=variant) for variant, title, time in rows[:limit]],
        next_cursor=cursor + limit if len(rows) > limit else None,
    )


def _get_workspace_variant(db: Session, workspace_id: str, variant_id: str) -> PostVariant:
    variant = db.scalar(
        select(PostVariant)
        .join(Post, PostVariant.post_id == Post.id)
        .where(PostVariant.id == variant_id, Post.workspace_id == workspace_id)
    )
    if not variant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Post variant not found in current workspace",
        )
    return variant


def _get_workspace_post(db: Session, workspace_id: str, post_id: str) -> Post:
    post = db.scalar(select(Post).where(Post.id == post_id, Post.workspace_id == workspace_id))
    if not post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Post not found in current workspace",
        )
    return post


@router.post(
    "/variants/{variant_id}/schedule",
    response_model=VariantPublishResultResponse,
    status_code=status.HTTP_200_OK,
)
async def schedule_variant_endpoint(
    variant_id: str,
    payload: ScheduleVariantRequest,
    workspace: Workspace = Depends(get_current_workspace),
    db: Session = Depends(get_db),
) -> VariantPublishResultResponse:
    """Schedule a variant for publication at a target UTC datetime."""
    variant = _get_workspace_variant(db, workspace.id, variant_id)
    scheduled = await schedule_variant(db, variant.id, payload.scheduled_time)
    return VariantPublishResultResponse(
        variant_id=scheduled.id,
        status=scheduled.status,
        scheduled_time=scheduled.scheduled_time,
        external_post_id=scheduled.external_post_id,
        last_error=scheduled.last_error,
        attempt_count=scheduled.attempt_count,
    )


@router.post(
    "/variants/{variant_id}/publish-now",
    response_model=VariantPublishResultResponse,
    status_code=status.HTTP_200_OK,
)
async def publish_now_endpoint(
    variant_id: str,
    workspace: Workspace = Depends(get_current_workspace),
    db: Session = Depends(get_db),
) -> VariantPublishResultResponse:
    """Immediately dispatch publishing of an individual variant."""
    variant = _get_workspace_variant(db, workspace.id, variant_id)
    attempt = await publish_variant_job(variant.id, db)
    db.refresh(variant)
    return VariantPublishResultResponse(
        variant_id=variant.id,
        status=variant.status,
        scheduled_time=variant.scheduled_time,
        external_post_id=variant.external_post_id,
        last_error=variant.last_error,
        attempt_count=variant.attempt_count,
        latest_attempt=PublishAttemptResponse.model_validate(attempt),
    )


@router.post(
    "/variants/{variant_id}/cancel",
    response_model=VariantPublishResultResponse,
    status_code=status.HTTP_200_OK,
)
def cancel_variant_endpoint(
    variant_id: str,
    workspace: Workspace = Depends(get_current_workspace),
    db: Session = Depends(get_db),
) -> VariantPublishResultResponse:
    """Cancel a scheduled variant, returning it to draft status."""
    variant = _get_workspace_variant(db, workspace.id, variant_id)
    cancelled = cancel_variant_schedule(db, variant.id)
    return VariantPublishResultResponse(
        variant_id=cancelled.id,
        status=cancelled.status,
        scheduled_time=cancelled.scheduled_time,
        external_post_id=cancelled.external_post_id,
        last_error=cancelled.last_error,
        attempt_count=cancelled.attempt_count,
    )


@router.post(
    "/variants/{variant_id}/validate",
    response_model=ValidateVariantResponse,
    status_code=status.HTTP_200_OK,
)
async def validate_variant_endpoint(
    variant_id: str,
    workspace: Workspace = Depends(get_current_workspace),
    db: Session = Depends(get_db),
) -> ValidateVariantResponse:
    """Validate a variant's text, media, target, and cached rules prior to scheduling."""
    variant = _get_workspace_variant(db, workspace.id, variant_id)
    issues = await validate_variant(variant, db)
    error_count = sum(1 for i in issues if i.severity == "error")
    return ValidateVariantResponse(
        variant_id=variant.id,
        platform=variant.platform,
        is_valid=error_count == 0,
        issues=[
            ValidationIssueResponse(
                field=i.field,
                message=i.message,
                severity=i.severity,
                code=i.code,
            )
            for i in issues
        ],
    )


@router.post(
    "/posts/{post_id}/schedule",
    status_code=status.HTTP_200_OK,
)
async def schedule_post_endpoint(
    post_id: str,
    payload: SchedulePostRequest,
    workspace: Workspace = Depends(get_current_workspace),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    """Schedule all draft variants of a post for publication."""
    post = _get_workspace_post(db, workspace.id, post_id)
    await schedule_post(db, post.id, payload.scheduled_time)
    return {"status": "scheduled", "post_id": post.id}


@router.get(
    "/variants/{variant_id}/attempts",
    response_model=list[PublishAttemptResponse],
    status_code=status.HTTP_200_OK,
)
def list_variant_attempts_endpoint(
    variant_id: str,
    workspace: Workspace = Depends(get_current_workspace),
    db: Session = Depends(get_db),
) -> list[PublishAttempt]:
    """Retrieve audit history and attempts for a variant."""
    variant = _get_workspace_variant(db, workspace.id, variant_id)
    return get_variant_attempts(db, variant.id)


@router.get(
    "/attempts/{attempt_id}",
    response_model=PublishAttemptResponse,
    status_code=status.HTTP_200_OK,
)
def get_attempt_endpoint(
    attempt_id: str,
    workspace: Workspace = Depends(get_current_workspace),
    db: Session = Depends(get_db),
) -> PublishAttempt:
    """Retrieve an individual publish attempt by ID."""
    attempt = get_attempt(db, attempt_id)
    if not attempt:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Publish attempt not found",
        )
    # Check workspace ownership via variant
    _get_workspace_variant(db, workspace.id, attempt.variant_id)
    return attempt


class RejectVariantRequest(BaseModel):
    reason: str | None = Field(default=None, description="Optional rejection feedback")


class RedditMultiCommunityPostRequest(BaseModel):
    account_id: str = Field(..., description="Connected Reddit account ID")
    base_text: str = Field(..., min_length=5, description="Base post body or content")
    title: str = Field(default="", description="Base title (optional)")
    subreddits: list[str] = Field(
        ..., min_length=1, max_length=10, description="List of target subreddits"
    )
    scheduled_time: datetime | None = Field(default=None, description="Optional scheduled UTC time")
    publish_now: bool = Field(default=False, description="Whether to publish immediately")
    adapted_variants: list[dict[str, Any]] | None = Field(
        default=None,
        description="Optional pre-adapted variant payloads (e.g. from reddit_multi_community_adapt)",
    )


@router.post(
    "/variants/{variant_id}/submit-for-approval",
    status_code=status.HTTP_200_OK,
)
def submit_variant_for_approval_endpoint(
    variant_id: str,
    workspace: Workspace = Depends(get_current_workspace),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    """Submit a draft variant for team review/approval."""
    variant = _get_workspace_variant(db, workspace.id, variant_id)
    if variant.status != "draft":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Only draft variants can be submitted for approval (current status: {variant.status})",
        )
    variant.status = "pending_approval"
    db.commit()
    return {"variant_id": variant.id, "status": variant.status}


@router.post(
    "/variants/{variant_id}/approve",
    status_code=status.HTTP_200_OK,
)
def approve_variant_endpoint(
    variant_id: str,
    workspace: Workspace = Depends(get_current_workspace),
    _=Depends(require_roles("owner", "admin")),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    """Approve a variant submitted for team review."""
    variant = _get_workspace_variant(db, workspace.id, variant_id)
    if variant.status not in ("pending_approval", "rejected"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot approve variant with status: {variant.status}",
        )
    variant.status = "approved"
    db.commit()
    return {"variant_id": variant.id, "status": variant.status}


@router.post(
    "/variants/{variant_id}/reject",
    status_code=status.HTTP_200_OK,
)
def reject_variant_endpoint(
    variant_id: str,
    payload: RejectVariantRequest,
    workspace: Workspace = Depends(get_current_workspace),
    _=Depends(require_roles("owner", "admin")),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    """Reject a variant during team review with optional feedback."""
    variant = _get_workspace_variant(db, workspace.id, variant_id)
    variant.status = "rejected"
    if payload.reason:
        variant.last_error = payload.reason
    db.commit()
    return {"variant_id": variant.id, "status": variant.status, "reason": payload.reason or ""}


@router.post(
    "/reddit/multi-community-post",
    status_code=status.HTTP_201_CREATED,
)
async def post_to_multiple_subreddits_endpoint(
    payload: RedditMultiCommunityPostRequest,
    user: User = Depends(get_current_user),
    workspace: Workspace = Depends(get_current_workspace),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """
    Create a post and adapt/schedule distinct, rule-compliant variants across multiple subreddits in one go.
    """
    account = db.scalar(
        select(ConnectedAccount).where(
            ConnectedAccount.id == payload.account_id,
            ConnectedAccount.workspace_id == workspace.id,
            ConnectedAccount.platform == "reddit",
        )
    )
    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Connected Reddit account not found",
        )
    if account.status != "active":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Reddit account is {account.status}; please reconnect",
        )

    if len({s.lower().removeprefix("r/") for s in payload.subreddits}) != len(payload.subreddits):
        raise HTTPException(422, "Each subreddit must be selected once")
    if len(payload.subreddits) > 1:
        adapted = payload.adapted_variants or []
        bodies = [v.get("body", "").strip() for v in adapted]
        if (
            len(adapted) != len(payload.subreddits)
            or not all(bodies)
            or len(set(bodies)) != len(bodies)
        ):
            raise HTTPException(
                422, "Provide a distinct, explicitly approved variant for every subreddit"
            )
    # 1. Create parent Post
    base_title = payload.title.strip() if payload.title else payload.base_text[:60].strip()
    post = Post(
        workspace_id=workspace.id,
        author_id=user.id,
        title=base_title or "Multi-Community Post",
        base_text=payload.base_text,
        status="draft",
    )
    db.add(post)
    db.flush()

    created_variants: list[dict[str, Any]] = []

    # 2. Create adapted variant per target subreddit
    for raw_sub in payload.subreddits:
        clean_sub = raw_sub.strip().lstrip("r/")
        adapted = next(
            (
                v
                for v in (payload.adapted_variants or [])
                if v.get("subreddit", "").strip().lstrip("r/").lower() == clean_sub.lower()
            ),
            None,
        )

        sub_title = (
            (adapted.get("title") if adapted else None)
            or base_title
            or f"Discussion in r/{clean_sub}"
        )
        sub_body = (adapted.get("body") if adapted else None) or payload.base_text
        sub_flair = (
            (adapted.get("recommended_flair") or adapted.get("flair_id")) if adapted else None
        )
        sub_type = (adapted.get("post_type") if adapted else None) or "text"

        variant_payload = {
            "subreddit": clean_sub,
            "title": sub_title,
            "body": sub_body,
            "post_type": sub_type,
            "flair_id": sub_flair,
        }

        variant = PostVariant(
            post_id=post.id,
            connected_account_id=account.id,
            platform="reddit",
            payload=variant_payload,
            scheduled_time=payload.scheduled_time,
            status="draft",
            idempotency_key=f"mc_{uuid4().hex}",
        )
        db.add(variant)
        db.flush()

        if payload.scheduled_time:
            await schedule_variant(db, variant.id, payload.scheduled_time)
        elif payload.publish_now:
            await publish_variant_job(variant.id, db)

        created_variants.append(
            {
                "variant_id": variant.id,
                "subreddit": clean_sub,
                "title": sub_title,
                "status": variant.status,
                "scheduled_time": variant.scheduled_time,
            }
        )

    db.commit()
    return {
        "post_id": post.id,
        "title": post.title,
        "variants_count": len(created_variants),
        "variants": created_variants,
    }


class ReconcilePublicationRequest(BaseModel):
    external_post_id: str = Field(min_length=1, max_length=255)


@router.post("/variants/{variant_id}/reconcile", response_model=VariantPublishResultResponse)
async def reconcile_publication(
    variant_id: str,
    payload: ReconcilePublicationRequest,
    workspace: Workspace = Depends(get_current_workspace),
    _=Depends(require_roles("owner", "admin")),
    db: Session = Depends(get_db),
):
    variant = _get_workspace_variant(db, workspace.id, variant_id)
    if not variant.publish_state.get("outcome_unknown"):
        raise HTTPException(409, "Only an uncertain publication can be reconciled")
    account = db.get(ConnectedAccount, variant.connected_account_id)
    if not account or account.workspace_id != workspace.id:
        raise HTTPException(404, "Account not found")
    from app.modules.channels.registry import channel_registry

    await channel_registry.require(variant.platform).fetch_metrics(
        account,
        payload.external_post_id,
        context={
            "payload": variant.payload or {},
            "published_at": variant.published_at,
            "variant_id": variant.id,
        },
    )
    from app.core.security import utcnow

    variant.external_post_id = payload.external_post_id
    variant.status = "published"
    variant.published_at = utcnow()
    variant.publish_state = {**variant.publish_state, "outcome_unknown": False, "reconciled": True}
    variant.last_error = None
    variant.publishing_started_at = None
    from app.modules.publishing.models import PublishAttempt

    db.add(
        PublishAttempt(
            variant_id=variant.id,
            started_at=utcnow(),
            finished_at=utcnow(),
            result="reconciled",
            response_payload={"external_post_id": payload.external_post_id},
        )
    )
    if all(v.status in {"published", "failed"} for v in variant.post.variants):
        variant.post.status = "published"
    db.commit()
    return VariantPublishResultResponse(
        variant_id=variant.id,
        status=variant.status,
        external_post_id=variant.external_post_id,
        attempt_count=variant.attempt_count,
    )
