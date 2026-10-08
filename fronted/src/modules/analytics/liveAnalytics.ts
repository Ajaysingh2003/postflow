import type { AnalyticsDashboard, PostFeedItemAnalytics } from "@/modules/studio/types";

export function hasMetric(fields: string[] | null | undefined, key: string): boolean {
  return Array.isArray(fields) && fields.includes(key);
}

// Keep returned zero counts; hide columns only when no row supplies the metric.
export function visiblePostMetrics(posts: PostFeedItemAnalytics[]): string[] {
  return ["views", "impressions", "likes", "comments", "shares", "bookmarks"].filter(
    (key) => posts.some((post) => post.metrics_status !== "unavailable" && hasMetric(post.available_metrics, key)),
  );
}

export function hasEngagementRate(post: PostFeedItemAnalytics): boolean {
  return post.metrics_status !== "unavailable" && hasMetric(post.available_metrics, "engagements") &&
    (hasMetric(post.available_metrics, "impressions") ? post.impressions > 0 : hasMetric(post.available_metrics, "views") && post.views > 0);
}

export const liveAnalyticsOptions = {
  staleTime: 0,
  gcTime: 0,
  placeholderData: undefined,
  refetchOnMount: "always" as const,
  refetchOnWindowFocus: true,
  retry: false,
};

export function currentDashboard(
  data: AnalyticsDashboard | undefined,
  accountId: string | null,
  fetching: boolean,
  failed: boolean,
): AnalyticsDashboard | null {
  return !fetching && !failed && data?.account_id === accountId ? data : null;
}
