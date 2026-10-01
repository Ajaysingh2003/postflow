"""Analytics module for metrics snapshots, performance aggregation, and reporting."""

from app.modules.analytics.models import MetricSnapshot
from app.modules.analytics.router import router
from app.modules.analytics.service import (
    get_account_analytics,
    get_post_analytics,
    get_variant_analytics,
    get_workspace_overview,
    trigger_workspace_metrics_sync,
)

__all__ = [
    "MetricSnapshot",
    "get_account_analytics",
    "get_post_analytics",
    "get_variant_analytics",
    "get_workspace_overview",
    "router",
    "trigger_workspace_metrics_sync",
]
