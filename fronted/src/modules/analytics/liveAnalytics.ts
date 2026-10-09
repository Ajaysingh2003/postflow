import type { AnalyticsDashboard, PostFeedItemAnalytics } from "@/modules/studio/types";

export function hasMetric(fields: string[] | null | undefined, key: string): boolean {
  return Array.isArray(fields) && fields.includes(key);
}

export function analyticsPostUrl(post: Pick<PostFeedItemAnalytics, "platform" | "external_post_id" | "external_url">): string | null {
  for (const value of [post.external_url, post.external_post_id]) {
    if (!value) continue;
    try {
      const url = new URL(value);
      if (url.protocol === "https:" && !url.username && !url.password) return url.href;
    } catch { /* An identifier may still have a known platform permalink. */ }
  }
  const id = post.external_post_id;
  if (!id) return null;
  if (post.platform === "x" && /^\d+$/.test(id)) return `https://x.com/i/status/${id}`;
  if (post.platform === "linkedin" && /^urn:li:(share|ugcPost):\d+$/.test(id)) return `https://www.linkedin.com/feed/update/${id}`;
  if (post.platform === "reddit" && /^(t3_)?[a-z0-9]+$/i.test(id)) return `https://reddit.com/comments/${id.replace(/^t3_/, "")}`;
  if (post.platform === "bluesky") {
    const match = /^at:\/\/([^/]+)\/app\.bsky\.feed\.post\/([^/]+)$/.exec(id);
    if (match) return `https://bsky.app/profile/${encodeURIComponent(match[1])}/post/${encodeURIComponent(match[2])}`;
  }
  return null;
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
