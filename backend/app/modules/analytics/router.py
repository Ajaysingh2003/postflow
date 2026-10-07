from datetime import UTC, date, datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_workspace, require_content_access
from app.db.session import get_db
from app.modules.analytics.schemas import (
    AccountAnalyticsResponse,
    PlanLimitsResponse,
    PostAnalyticsResponse,
    PostFeedItemAnalytics,
    VariantAnalyticsResponse,
    WorkspaceOverviewResponse,
)
from app.modules.analytics.service import (
    get_account_analytics,
    get_post_analytics,
    get_posts_analytics_feed,
    get_variant_analytics,
    get_workspace_overview,
    trigger_workspace_metrics_sync,
)
from app.modules.billing.entitlements import get_plan_limits_summary
from app.modules.identity.models import Workspace

router = APIRouter(
    prefix="/analytics",
    tags=["analytics"],
    dependencies=[Depends(require_content_access)],
)


def parse_flexible_datetime(dt_str: str | None) -> datetime | None:
    """Parse ISO datetime or date string safely, handling unencoded + as space."""
    if not dt_str:
        return None
    cleaned = dt_str.strip().replace(" ", "+")
    try:
        dt = datetime.fromisoformat(cleaned)
        return dt if dt.tzinfo else dt.replace(tzinfo=UTC)
    except (ValueError, TypeError, AttributeError):
        try:
            d = date.fromisoformat(cleaned)
            return datetime(d.year, d.month, d.day, tzinfo=UTC)
        except (ValueError, TypeError, AttributeError):
            return None


@router.get("/overview", response_model=WorkspaceOverviewResponse)
def get_overview_endpoint(
    days: int = Query(default=30, ge=1, le=365, description="Timeframe in days"),
    account_id: str | None = Query(default=None),
    start_date: str | None = Query(default=None, description="Start date for custom range filter"),
    end_date: str | None = Query(default=None, description="End date for custom range filter"),
    workspace: Workspace = Depends(get_current_workspace),
    db: Session = Depends(get_db),
) -> WorkspaceOverviewResponse:
    """Aggregate total performance metrics across all social channels for this workspace."""
    return get_workspace_overview(
        db,
        workspace.id,
        days=days,
        start_date=parse_flexible_datetime(start_date),
        end_date=parse_flexible_datetime(end_date),
        account_id=account_id,
    )


@router.get("/accounts", response_model=list[AccountAnalyticsResponse])
def get_accounts_analytics_endpoint(
    workspace: Workspace = Depends(get_current_workspace),
    db: Session = Depends(get_db),
) -> list[AccountAnalyticsResponse]:
    """Retrieve whole-account analytics (followers, profile views, impressions) for all connected accounts."""
    return get_account_analytics(db, workspace.id)


@router.get("/accounts/{account_id}", response_model=AccountAnalyticsResponse)
def get_single_account_analytics_endpoint(
    account_id: str,
    workspace: Workspace = Depends(get_current_workspace),
    db: Session = Depends(get_db),
) -> AccountAnalyticsResponse:
    """Retrieve detailed analytics and historical snapshots for a specific connected account."""
    accounts = get_account_analytics(db, workspace.id, account_id=account_id)
    if not accounts:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Connected account not found in current workspace",
        )
    return accounts[0]


@router.get("/variants/{variant_id}", response_model=VariantAnalyticsResponse)
def get_variant_analytics_endpoint(
    variant_id: str,
    workspace: Workspace = Depends(get_current_workspace),
    db: Session = Depends(get_db),
) -> VariantAnalyticsResponse:
    """Retrieve post-level performance metrics for an individual variant."""
    return get_variant_analytics(db, workspace.id, variant_id)


@router.get("/posts/{post_id}", response_model=PostAnalyticsResponse)
def get_post_analytics_endpoint(
    post_id: str,
    workspace: Workspace = Depends(get_current_workspace),
    db: Session = Depends(get_db),
) -> PostAnalyticsResponse:
    """Retrieve aggregated metrics across all channel variants for a post."""
    return get_post_analytics(db, workspace.id, post_id)


@router.get("/feed", response_model=list[PostFeedItemAnalytics])
def get_analytics_feed_endpoint(
    account_id: str | None = Query(default=None),
    start_date: str | None = Query(default=None, description="Start date for custom range filter"),
    end_date: str | None = Query(default=None, description="End date for custom range filter"),
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    workspace: Workspace = Depends(get_current_workspace),
    db: Session = Depends(get_db),
) -> list[PostFeedItemAnalytics]:
    """Retrieve published posts feed with individual performance metrics and engagement rates."""
    return get_posts_analytics_feed(
        db,
        workspace.id,
        account_id=account_id,
        start_date=parse_flexible_datetime(start_date),
        end_date=parse_flexible_datetime(end_date),
        limit=limit,
        offset=offset,
    )


@router.post("/sync-now")
async def sync_metrics_endpoint(
    workspace: Workspace = Depends(get_current_workspace),
    db: Session = Depends(get_db),
) -> dict[str, int]:
    """Manually trigger immediate metrics synchronization from official platform APIs."""
    return await trigger_workspace_metrics_sync(db, workspace.id)


@router.get("/plan-limits", response_model=PlanLimitsResponse)
def get_plan_limits_endpoint(
    workspace: Workspace = Depends(get_current_workspace),
    db: Session = Depends(get_db),
) -> PlanLimitsResponse:
    """Retrieve current usage vs plan quota limits for connected accounts, scheduled posts, and AI credits."""
    summary = get_plan_limits_summary(db, workspace.id)
    return PlanLimitsResponse.model_validate(summary)
