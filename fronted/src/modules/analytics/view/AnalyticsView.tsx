"use client";

import React, { Suspense, useEffect, useMemo, useState } from "react";

import Link from "next/link";

import { useRouter } from "next/navigation";

import { useSuspenseQuery } from "@tanstack/react-query";

import { toast } from "sonner";

import {
  format,
  subDays,
  startOfDay,
  endOfDay,
  differenceInCalendarDays,
} from "date-fns";

import type { DateRange } from "react-day-picker";

import {
  Eye,
  Heart,
  MessageCircle,
  Repeat2,
  Bookmark,
  MousePointerClick,
  RefreshCw,
  TrendingUp,
  Download,
  Share,
  MoreHorizontal,
  ExternalLink,
  ArrowUpDown,
  Sparkles,
  Percent,
  Plus,
  CalendarDays,
  ChevronDown,
  Info,
  Copy,
  AlertCircle,
  Users,
  LucideIcon,
  FileText,
  Check,
} from "lucide-react";

import {
  analyticsPostUrl,
  currentDashboard,
  liveAnalyticsOptions,
  hasMetric,
  hasEngagementRate,
  visiblePostMetrics,
} from "../liveAnalytics";

import { useTRPC } from "@/trpc/client";

import { useComposer } from "@/modules/content/context/ComposerContext";

import { PlatformMark } from "@/modules/content/studio/AccountSwitcher";

import { channelName } from "@/modules/studio/types";

import { Button } from "@/components/ui/button";

import { Skeleton } from "@/components/ui/skeleton";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

import { Calendar } from "@/components/ui/calendar";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { cn } from "@/lib/utils";

import type { Account, PostFeedItemAnalytics } from "@/modules/studio/types";
import {
  MetricCard,
  MetricCardSkeleton,
  MetricsGridSkeleton,
} from "../component/MetricCard";
import AnalyticsSkeleton from "../component/AnalyticsSkeleton";

/* -------------------------------------------------------------------------- */

/*  Helpers                                                                   */

/* -------------------------------------------------------------------------- */

type SortKey =
  | "latest"
  | "views"
  | "impressions"
  | "likes"
  | "engagements"
  | "eng_rate";

type Timeframe = "7d" | "30d" | "90d" | "all" | "custom";

const ANALYTICS_PAGE_SIZE = 50;

const EMPTY_ACCOUNTS: Account[] = [];

const EMPTY_FEED: PostFeedItemAnalytics[] = [];

const SORT_LABELS: Record<SortKey, string> = {
  latest: "Latest",

  impressions: "Most impressions",

  views: "Most views",

  likes: "Most likes",

  engagements: "Most engagements",

  eng_rate: "Highest engagement rate",
};

const PRESETS: {
  id: Exclude<Timeframe, "custom">;

  label: string;

  short: string;
}[] = [
  { id: "7d", label: "7 days", short: "7d" },

  { id: "30d", label: "30 days", short: "30d" },

  { id: "90d", label: "90 days", short: "90d" },

  { id: "all", label: "All time", short: "All" },
];

function formatNumber(num: number | null | undefined): string {
  if (num === null || num === undefined || !Number.isFinite(num)) return "–";

  if (num >= 1_000_000)
    return `${(num / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;

  if (num >= 10_000) return `${Math.round(num / 1_000)}K`;

  if (num >= 1_000) return `${(num / 1_000).toFixed(1).replace(/\.0$/, "")}K`;

  return num.toLocaleString();
}

function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return "No sync time";

  const timestamp = new Date(dateStr).getTime();

  if (!Number.isFinite(timestamp)) return "Unknown update time";

  const diff = Date.now() - timestamp;

  const minutes = Math.floor(diff / 60_000);

  if (minutes < 1) return "Just now";

  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);

  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);

  if (days < 30) return `${days}d ago`;

  return new Date(dateStr).toLocaleDateString(undefined, {
    month: "short",

    day: "numeric",
  });
}

function postMetric(
  post: PostFeedItemAnalytics,

  key: string,

  value: number | null | undefined,
): string {
  if (
    post.metrics_status === "unavailable" ||
    !hasMetric(post.available_metrics, key)
  ) {
    return "–";
  }

  return formatNumber(value);
}

function postEngagementRate(post: PostFeedItemAnalytics): string {
  if (!hasEngagementRate(post)) return "–";

  return `${post.engagement_rate}%`;
}

/* -------------------------------------------------------------------------- */

/*  Small components                                                          */

/* -------------------------------------------------------------------------- */

function SortableHead({
  children,

  active,

  onClick,

  align = "right",

  className,
}: {
  children: React.ReactNode;

  active?: boolean;

  onClick?: () => void;

  align?: "left" | "right";

  className?: string;
}) {
  return (
    <th
      className={cn(
        "sticky top-0 z-10 bg-card px-3 py-2.5 text-[11px] font-medium whitespace-nowrap",

        align === "right" ? "text-right" : "text-left",

        className,
      )}
    >
      <button
        type="button"
        onClick={onClick}
        disabled={!onClick}
        className={cn(
          "inline-flex items-center gap-1.5 transition-colors",

          align === "right" && "flex-row-reverse",

          onClick ? "cursor-pointer hover:text-foreground" : "cursor-default",

          active && "text-foreground",
        )}
      >
        <span className="inline-flex items-center gap-1.5">{children}</span>

        {/* Reserved width so active/inactive headers never shift */}

        <span
          className={cn(
            "w-2.5 text-[10px] leading-none",

            active ? "opacity-100" : "opacity-0",
          )}
        >
          ↓
        </span>
      </button>
    </th>
  );
}

/* -------------------------------------------------------------------------- */

/*  Main view                                                                 */

/* -------------------------------------------------------------------------- */

function AnalyticsDashboardContent({ accounts }: { accounts: Account[] }) {
  const trpc = useTRPC();

  const router = useRouter();

  const { setStudioNavigation } = useComposer();

  const [dateOpen, setDateOpen] = useState(false);

  const [accountSelection, setSelectedAccountId] = useState<string | "all">("");

  const [timeframe, setTimeframe] = useState<Timeframe>("30d");

  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => ({
    from: subDays(new Date(), 29),

    to: new Date(),
  }));

  const [draftDateRange, setDraftDateRange] = useState<DateRange | undefined>(
    () => ({ from: subDays(new Date(), 29), to: new Date() }),
  );

  const [sortBy, setSortBy] = useState<SortKey>("latest");

  const [pageState, setPageState] = useState({ scope: "", offset: 0 });

  const activeAccount = useMemo(() => {
    if (accountSelection && accountSelection !== "all") {
      const match = accounts.find((a) => a.id === accountSelection);

      if (match) return match;
    }

    return accounts.find((a) => a.status === "active") ?? accounts[0];
  }, [accounts, accountSelection]);

  const selectedAccountId =
    accountSelection === "all" ? "all" : activeAccount.id;

  // 2. Keep top navigation in sync

  useEffect(() => {
    if (!activeAccount || !accounts.length) {
      setStudioNavigation(null);

      return;
    }

    setStudioNavigation({
      account: activeAccount,

      accounts,

      onSelect: (id: string) => setSelectedAccountId(id),
    });

    return () => setStudioNavigation(null);
  }, [activeAccount, accounts, setStudioNavigation]);

  // 3. Date bounds (full days so "today" isn't cut off mid-day)

  const startDateStr = useMemo(() => {
    if (timeframe === "all") return new Date(0).toISOString();

    if (!dateRange?.from) return undefined;

    return startOfDay(dateRange.from).toISOString();
  }, [timeframe, dateRange]);

  const endDateStr = useMemo(() => {
    if (timeframe === "all" || !dateRange?.to) return undefined;

    return endOfDay(dateRange.to).toISOString();
  }, [timeframe, dateRange]);

  const formattedDateLabel = useMemo(() => {
    if (timeframe === "all") return "All time";

    if (dateRange?.from && dateRange?.to) {
      return `${format(dateRange.from, "MMM d")} – ${format(dateRange.to, "MMM d, yyyy")}`;
    }

    if (dateRange?.from) return `From ${format(dateRange.from, "MMM d, yyyy")}`;

    return "Select date range";
  }, [timeframe, dateRange]);

  const handleSelectPreset = (preset: Exclude<Timeframe, "custom">) => {
    setTimeframe(preset);

    const now = new Date();

    if (preset === "all") {
      setDateRange(undefined);

      setDraftDateRange(undefined);
    } else {
      const from = subDays(now, parseInt(preset, 10) - 1);

      setDateRange({ from, to: now });

      setDraftDateRange({ from, to: now });
    }
  };

  const feedScope = JSON.stringify([
    selectedAccountId,

    startDateStr ?? "",

    endDateStr ?? "",
  ]);

  const feedOffset = pageState.scope === feedScope ? pageState.offset : 0;

  // One account-scoped response keeps the cards and table consistent.

  const dashboardQuery = useSuspenseQuery({
    ...trpc.studio.analyticsDashboard.queryOptions({
      account_id: selectedAccountId === "all" ? undefined : activeAccount.id,

      start_date: startDateStr,

      end_date: endDateStr,

      limit: ANALYTICS_PAGE_SIZE,

      offset: feedOffset,

      content_type: "posts",
    }),

    ...liveAnalyticsOptions,
  });

  // Never render a previous result during a switch, refresh, or failed request.

  const dashboardData = currentDashboard(
    dashboardQuery.data,

    selectedAccountId === "all" ? null : activeAccount.id,

    dashboardQuery.isFetching,

    dashboardQuery.isError,
  );

  const accountData =
    dashboardData?.accounts.find((a) => a.account_id === activeAccount.id) ??
    null;

  const overviewData = dashboardData?.overview ?? null;

  const feedPosts: PostFeedItemAnalytics[] = dashboardData?.posts ?? EMPTY_FEED;

  const accountMetricsQuery = dashboardQuery;

  const overviewQuery = dashboardQuery;

  const feedQuery = dashboardQuery;

  const refreshMetrics = async () => {
    const result = await dashboardQuery.refetch();

    if (result.error) toast.error("Couldn't refresh analytics");
  };

  // 5. Sort only the current server-paginated page.

  const sortedPosts = (() => {
    const list = [...feedPosts];

    const effectiveSort =
      sortBy === "latest" ||
      feedPosts.some((post) =>
        sortBy === "eng_rate"
          ? hasEngagementRate(post)
          : hasMetric(post.available_metrics, sortBy),
      )
        ? sortBy
        : "latest";

    list.sort((a, b) => {
      const metricSort = (
        metric:
          | "views"
          | "impressions"
          | "likes"
          | "engagements"
          | "engagement_rate",

        key: string,
      ) => {
        const aAvailable = hasMetric(a.available_metrics, key);

        const bAvailable = hasMetric(b.available_metrics, key);

        if (aAvailable !== bAvailable) return aAvailable ? -1 : 1;

        if (!aAvailable) return 0;

        return (b[metric] ?? 0) - (a[metric] ?? 0);
      };

      if (effectiveSort === "views") return metricSort("views", "views");

      if (effectiveSort === "impressions")
        return metricSort("impressions", "impressions");

      if (effectiveSort === "likes") return metricSort("likes", "likes");

      if (effectiveSort === "engagements")
        return metricSort("engagements", "engagements");

      if (effectiveSort === "eng_rate") {
        const aAvailable = hasEngagementRate(a);

        const bAvailable = hasEngagementRate(b);

        if (aAvailable !== bAvailable) return aAvailable ? -1 : 1;

        if (!aAvailable) return 0;

        return b.engagement_rate - a.engagement_rate;
      }

      return (
        new Date(b.published_at || b.created_at).getTime() -
        new Date(a.published_at || a.created_at).getTime()
      );
    });

    return list;
  })();

  // Never substitute a page of feed rows or account lifetime totals for the

  // selected-range aggregate. Missing coverage stays visibly unavailable.

  const totalPublishedPosts = overviewData?.total_posts_published;

  const summaryMetric = (key: string, value: number | undefined) => {
    if (totalPublishedPosts === 0 && dashboardData?.dataset_complete)
      return formatNumber(0);

    if (
      !overviewData ||
      overviewData.metrics_status === "unavailable" ||
      !hasMetric(overviewData.available_metrics, key)
    ) {
      return "–";
    }

    return formatNumber(value);
  };

  const overviewNotice =
    overviewData?.metrics_notice ??
    feedPosts.find((post) => post.metrics_notice)?.metrics_notice ??
    null;

  const followerMetrics = (
    accountData?.extras as Record<string, unknown> | null
  )?.available_metrics;

  const hasFollowerMetric =
    !!accountData &&
    accountData.metrics_status !== "unavailable" &&
    (hasMetric(
      Array.isArray(followerMetrics) ? followerMetrics : undefined,

      "followers_count",
    ) ||
      accountData?.metrics_status === "available");

  const tableMetrics = visiblePostMetrics(feedPosts);

  const showEngagementRate = feedPosts.some(hasEngagementRate);

  const metricLabels: Record<string, string> = {
    views: "Views",
    impressions: "Impressions",
    likes: "Likes",

    comments:
      selectedAccountId === "all"
        ? "Comments / replies"
        : ["x", "threads", "bluesky", "mastodon"].includes(
              activeAccount?.platform ?? "",
            )
          ? "Replies"
          : "Comments",

    shares:
      selectedAccountId === "all"
        ? "Shares / reposts"
        : activeAccount?.platform === "threads"
          ? "Reposts & quotes"
          : ["x", "bluesky", "mastodon"].includes(activeAccount?.platform ?? "")
            ? "Reposts"
            : "Shares",

    bookmarks: activeAccount?.platform === "instagram" ? "Saves" : "Bookmarks",
  };

  const metricIcons: Record<string, LucideIcon> = {
    views: Eye,
    impressions: Eye,
    likes: Heart,
    comments: MessageCircle,
    shares: Repeat2,
    bookmarks: Bookmark,
  };

  const sortOptions = (Object.keys(SORT_LABELS) as SortKey[]).filter(
    (key) =>
      key === "latest" ||
      (key === "eng_rate"
        ? showEngagementRate
        : feedPosts.some((post) => hasMetric(post.available_metrics, key))),
  );

  const displayedSort = sortOptions.includes(sortBy) ? sortBy : "latest";

  // 7. Actions

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${selectedAccountId === "all" ? "All accounts" : (activeAccount?.display_name ?? "Account")} analytics`,

          url: window.location.href,
        });
      } catch {
        /* user dismissed */
      }
    } else {
      await navigator.clipboard.writeText(window.location.href);

      toast.success("Link copied");
    }
  };

  const handleExportCSV = () => {
    if (!sortedPosts.length) {
      toast.message("No posts to export");

      return;
    }

    const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;

    const headers = [
      "Post text",
      "Platform",
      "Published at",
      ...tableMetrics.map((key) => metricLabels[key]),
      ...(showEngagementRate ? ["Engagement rate %"] : []),
    ];

    const rows = sortedPosts.map((p) =>
      [
        p.text,
        p.platform,
        p.published_at || p.created_at,

        ...tableMetrics.map((key) =>
          postMetric(p, key, p[key as keyof PostFeedItemAnalytics] as number),
        ),

        ...(showEngagementRate ? [postEngagementRate(p)] : []),
      ]
        .map(esc)
        .join(","),
    );

    const blob = new Blob(
      ["\uFEFF" + [headers.map(esc).join(","), ...rows].join("\n")],

      {
        type: "text/csv;charset=utf-8;",
      },
    );

    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");

    a.href = url;

    const exportName =
      selectedAccountId === "all"
        ? "all_accounts"
        : activeAccount?.display_name || "social";

    const safeExportName = exportName.replace(/[^a-z0-9_-]+/gi, "_");

    a.download = `${safeExportName}_analytics_${format(new Date(), "yyyy-MM-dd")}_page-${feedOffset / ANALYTICS_PAGE_SIZE + 1}.csv`;

    document.body.appendChild(a);

    a.click();

    document.body.removeChild(a);

    URL.revokeObjectURL(url);

    toast.success("CSV exported");
  };

  if (
    dashboardData &&
    accountData?.metrics_status === "unavailable" &&
    overviewData?.metrics_status === "unavailable"
  ) {
    return (
      <div
        className="flex h-full min-h-[450px] flex-col items-center justify-center p-8 text-center"
        role="status"
      >
        <PlatformMark
          platform={activeAccount?.platform ?? ""}
          className="mb-6 !size-12 !text-3xl"
        />

        <h2 className="text-xl font-semibold">
          {channelName(activeAccount?.platform ?? "")} analytics is not
          available
        </h2>

        <p className="mt-3 max-w-lg text-sm leading-relaxed text-muted-foreground">
          {dashboardData.dataset_notice ??
            accountData.metrics_notice ??
            "This account does not currently provide analytics through its official API."}
        </p>

        <Button
          className="mt-6"
          variant="outline"
          onClick={() => void refreshMetrics()}
        >
          <RefreshCw className="mr-2 size-4" /> Try again
        </Button>
      </div>
    );
  }

  const isRefreshing =
    feedQuery.isFetching ||
    overviewQuery.isFetching ||
    accountMetricsQuery.isFetching;

  const latestFeedSyncAt = feedPosts.reduce<string | null>((latest, post) => {
    const fetchedAt = post.metrics_fetched_at;

    if (!fetchedAt) return latest;

    if (!latest || new Date(fetchedAt).getTime() > new Date(latest).getTime()) {
      return fetchedAt;
    }

    return latest;
  }, null);

  const lastSyncedAt =
    selectedAccountId !== "all"
      ? (accountData?.last_synced_at ?? latestFeedSyncAt)
      : latestFeedSyncAt;

  const syncStatus = isRefreshing
    ? "Updating metrics"
    : lastSyncedAt
      ? `Updated ${formatRelativeTime(lastSyncedAt)}`
      : "Live analytics";

  const pageStart = feedPosts.length > 0 ? feedOffset + 1 : 0;

  const pageEnd = feedOffset + feedPosts.length;

  const canGoNext =
    totalPublishedPosts !== undefined
      ? pageEnd < totalPublishedPosts
      : feedPosts.length === ANALYTICS_PAGE_SIZE;

  /* --------------------------------- Render --------------------------------- */

  return (
    <div className="flex h-full flex-col space-y-5 overflow-y-auto bg-background px-4 py-5 md:px-8 md:py-6">
      {/* Page heading and source freshness */}

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
            Performance
          </p>

          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            Analytics
          </h1>

          {/* <p className="mt-1 text-sm text-muted-foreground">

            {selectedAccountId === "all"

              ? "All connected accounts"

              : activeAccount?.display_name ?? "Selected account"}

            <span className="px-1.5">·</span>

            {formattedDateLabel}

          </p> */}

          <p className="mt-1 text-xs text-muted-foreground/80">
            All posts from the selected account, including those published
            outside Postflow. The date range filters posts by publish date;
            metrics are their latest reported totals.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border-[0.5px] border-border bg-card px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
            <span
              className={cn(
                "size-1.5 rounded-full",

                isRefreshing
                  ? "animate-pulse bg-blue-500"
                  : lastSyncedAt
                    ? "bg-emerald-500"
                    : "bg-muted-foreground/50",
              )}
            />

            {syncStatus}
          </span>

          <Button
            variant="outline"
            size="sm"
            onClick={() => void refreshMetrics()}
            disabled={isRefreshing}
            className="h-8 cursor-pointer gap-1.5 rounded-lg text-xs"
            title="Refresh metrics"
          >
            <RefreshCw
              className={cn("size-3.5", isRefreshing && "animate-spin")}
            />

            <span>{isRefreshing ? "Refreshing…" : "Refresh"}</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleShare}
            className="h-8 cursor-pointer gap-1.5 rounded-lg text-xs font-medium"
          >
            <Share className="size-3.5" />
            Share
          </Button>
        </div>
      </div>

      {overviewQuery.isError ||
      feedQuery.isError ||
      accountMetricsQuery.isError ? (
        <div
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/20 bg-destructive/5 p-3.5 text-sm"
          role="alert"
        >
          <div className="flex items-start gap-2.5 text-muted-foreground">
            <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" />

            <span>
              Analytics could not be loaded. Try again to refresh this view.
            </span>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              void refreshMetrics();
            }}
          >
            Try again
          </Button>
        </div>
      ) : null}

      {dashboardData?.dataset_notice ? (
        <p
          className="rounded-xl border border-border p-3 text-sm text-muted-foreground"
          role="status"
        >
          {dashboardData.dataset_notice}
        </p>
      ) : null}

      {overviewNotice && !overviewQuery.isError ? (
        <div
          className="flex items-start gap-2.5 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3.5 text-xs text-muted-foreground"
          role="status"
        >
          <Info className="mt-0.5 size-4 shrink-0 text-amber-600" />

          <p className="leading-relaxed">{overviewNotice}</p>
        </div>
      ) : null}

      {accountData?.metrics_notice && !hasFollowerMetric ? (
        <p className="text-xs text-muted-foreground" role="status">
          {accountData.metrics_notice}
        </p>
      ) : null}

      {/* Only show metrics the selected account actually returns. */}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
        {dashboardQuery.isFetching ? (
          <MetricsGridSkeleton count={7} className="col-span-full" />
        ) : null}

        {!dashboardQuery.isFetching &&
        selectedAccountId !== "all" &&
        hasFollowerMetric ? (
          <MetricCard
            index={0}
            icon={Users}
            color="#6366f1"
            label="Followers"
            value={formatNumber(accountData?.followers_count)}
            hint="Current account total"
          />
        ) : null}

        {[
          {
            key: "views",
            total: overviewData?.total_views,
            label: "Views",
            icon: Eye,
            color: "#10b981",
          },

          {
            key: "impressions",
            total: overviewData?.total_impressions,
            label:
              activeAccount?.platform === "x"
                ? "Post impressions"
                : "Impressions",
            icon: Eye,
            color: "#10b981",
          },

          {
            key: "reach",
            total: overviewData?.total_reach,
            label: "Reach",
            icon: TrendingUp,
            color: "#0ea5e9",
          },

          {
            key: "profile_clicks",
            total: overviewData?.total_profile_clicks,
            label: "Profile clicks",
            icon: MousePointerClick,
            color: "#0ea5e9",
          },

          {
            key: "engagements",
            total: overviewData?.total_engagements,
            label: "Engagements",
            icon: Heart,
            color: "#ec4899",
          },

          {
            key: "likes",
            total: overviewData?.total_likes,
            label: "Likes",
            icon: Heart,
            color: "#f97316",
          },
        ]
          .filter(
            (metric) =>
              !dashboardQuery.isFetching &&
              hasMetric(overviewData?.available_metrics, metric.key),
          )
          .map((metric, index) => (
            <MetricCard
              key={metric.key}
              index={index + 1}
              icon={metric.icon}
              color={metric.color}
              label={metric.label}
              value={summaryMetric(metric.key, metric.total)}
              hint="Totals for posts published in this period"
            />
          ))}

        {activeAccount?.platform === "x" &&
        selectedAccountId !== "all" &&
        !dashboardQuery.isFetching ? (
          <MetricCard
            icon={MessageCircle}
            color="#8b5cf6"
            label="Total impressions"
            value={formatNumber(dashboardData?.inclusive_impressions?.total)}
            hint={
              dashboardData?.inclusive_impressions?.complete
                ? "Posts + your replies published in this period"
                : dashboardData?.inclusive_impressions?.total != null
                  ? "Partial total · posts + your replies returned by X"
                  : "Posts + your replies · currently unavailable"
            }
          />
        ) : null}

        {!dashboardQuery.isFetching ? (
          <MetricCard
            index={6}
            icon={FileText}
            color="#8b5cf6"
            label="Published posts"
            value={
              dashboardData?.dataset_complete
                ? formatNumber(totalPublishedPosts)
                : "–"
            }
            hint="Returned by the platform for this period"
          />
        ) : null}
      </div>

      {/* Filters row */}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Quick presets (desktop). Same state as the popover list. */}

          <div
            role="tablist"
            aria-label="Timeframe"
            className="hidden items-center gap-0.5 rounded-xl border-[0.5px] border-border bg-muted/50 p-0.5 sm:flex"
          >
            {PRESETS.map((p) => {
              const active = timeframe === p.id;

              return (
                <button
                  key={p.id}
                  role="tab"
                  aria-selected={active}
                  type="button"
                  onClick={() => handleSelectPreset(p.id)}
                  className={cn(
                    "h-7 cursor-pointer rounded-[10px] px-3 text-xs font-medium transition-all outline-none focus-visible:ring-2 focus-visible:ring-ring/50",

                    active
                      ? "bg-card text-foreground shadow-[0_1px_2px_rgba(0,0,0,0.08)] ring-[0.5px] ring-border"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {p.short}
                </button>
              );
            })}
          </div>

          {/* Date range popover */}

          <Popover
            open={dateOpen}
            onOpenChange={(open) => {
              setDateOpen(open);

              if (open) setDraftDateRange(dateRange);
            }}
          >
            <PopoverTrigger
              render={
                <Button
                  variant="outline"
                  size="sm"
                  className={cn(
                    "h-8 cursor-pointer gap-2 rounded-xl border-[0.5px] bg-card px-3 text-xs font-medium shadow-[0_1px_1px_rgba(0,0,0,0.03)]",

                    timeframe === "custom" &&
                      "border-primary/40 text-foreground",
                  )}
                >
                  <CalendarDays className="size-3.5 text-muted-foreground" />

                  <span className="tabular-nums">{formattedDateLabel}</span>

                  <ChevronDown
                    className={cn(
                      "size-3 text-muted-foreground/70 transition-transform duration-200",

                      dateOpen && "rotate-180",
                    )}
                  />
                </Button>
              }
            />

            <PopoverContent
              align="start"
              sideOffset={8}
              className="w-auto overflow-hidden rounded-2xl p-0 shadow-xl"
            >
              <div className="flex flex-col sm:flex-row">
                {/* Presets: sidebar on desktop, scroll row on mobile */}

                <div className="flex gap-1 overflow-x-auto border-b-[0.5px] border-border p-2 sm:w-40 sm:flex-col sm:overflow-visible sm:border-b-0 sm:border-r-[0.5px] sm:p-2.5">
                  <p className="hidden px-2.5 pb-1 pt-1 text-[11px] font-medium text-muted-foreground sm:block">
                    Quick ranges
                  </p>

                  {PRESETS.map((p) => {
                    const active = timeframe === p.id;

                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          handleSelectPreset(p.id);

                          setDateOpen(false);
                        }}
                        className={cn(
                          "flex shrink-0 cursor-pointer items-center justify-between gap-3 rounded-lg px-2.5 py-1.5 text-left text-xs font-medium transition-colors",

                          active
                            ? "bg-primary/10 text-foreground"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground",
                        )}
                      >
                        {p.id === "all" ? "All time" : `Last ${p.label}`}

                        {active && <Check className="size-3.5 text-primary" />}
                      </button>
                    );
                  })}

                  <button
                    type="button"
                    disabled
                    className={cn(
                      "flex shrink-0 items-center justify-between gap-3 rounded-lg px-2.5 py-1.5 text-left text-xs font-medium",

                      timeframe === "custom"
                        ? "bg-primary/10 text-foreground"
                        : "hidden text-muted-foreground sm:flex",
                    )}
                  >
                    Custom range
                    {timeframe === "custom" && (
                      <Check className="size-3.5 text-primary" />
                    )}
                  </button>
                </div>

                {/* Calendar + footer */}

                <div className="flex flex-col">
                  <Calendar
                    mode="range"
                    selected={draftDateRange}
                    defaultMonth={draftDateRange?.from}
                    onSelect={setDraftDateRange}
                    disabled={{ after: new Date() }}
                    numberOfMonths={1}
                    showOutsideDays={false}
                    className="p-3"
                  />

                  <div className="flex items-center justify-between gap-4 border-t-[0.5px] border-border bg-muted/30 px-4 py-2.5">
                    <div className="min-w-0 text-[11px] leading-tight">
                      {draftDateRange?.from ? (
                        <>
                          <p className="truncate font-medium text-foreground tabular-nums">
                            {format(draftDateRange.from, "MMM d, yyyy")}

                            {draftDateRange.to &&
                              ` – ${format(draftDateRange.to, "MMM d, yyyy")}`}
                          </p>

                          <p className="mt-0.5 text-muted-foreground">
                            {draftDateRange.to
                              ? `${differenceInCalendarDays(draftDateRange.to, draftDateRange.from) + 1} days selected`
                              : "Select an end date"}
                          </p>
                        </>
                      ) : (
                        <p className="text-muted-foreground">
                          Choose a date range
                        </p>
                      )}
                    </div>

                    <div className="flex shrink-0 items-center gap-1.5">
                      {timeframe !== "30d" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 cursor-pointer px-2.5 text-xs text-muted-foreground hover:text-foreground"
                          onClick={() => {
                            handleSelectPreset("30d");

                            setDateOpen(false);
                          }}
                        >
                          Reset
                        </Button>
                      )}

                      <Button
                        size="sm"
                        className="h-7 cursor-pointer px-3 text-xs"
                        disabled={!!draftDateRange?.from && !draftDateRange?.to}
                        onClick={() => {
                          if (draftDateRange?.from && draftDateRange.to) {
                            setDateRange(draftDateRange);

                            setTimeframe("custom");
                          } else if (!draftDateRange) {
                            setTimeframe("all");

                            setDateRange(undefined);
                          }

                          setDateOpen(false);
                        }}
                      >
                        Apply
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {/* Sort */}

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="outline"
                size="sm"
                className="h-8 cursor-pointer gap-2 rounded-xl border-[0.5px] bg-card px-3 text-xs font-medium shadow-[0_1px_1px_rgba(0,0,0,0.03)]"
              >
                <ArrowUpDown className="size-3 text-muted-foreground" />

                <span className="text-muted-foreground">Sort</span>

                <span>{SORT_LABELS[displayedSort]}</span>

                <ChevronDown className="size-3 text-muted-foreground/70" />
              </Button>
            }
          />

          <DropdownMenuContent
            align="end"
            className="w-56 rounded-xl p-1 text-xs"
          >
            <p className="px-2 pb-1 pt-1.5 text-[11px] font-medium text-muted-foreground">
              Sort posts by
            </p>

            {sortOptions.map((key) => (
              <DropdownMenuItem
                key={key}
                onClick={() => setSortBy(key)}
                className={cn(
                  "cursor-pointer justify-between gap-2 rounded-lg py-1.5",

                  sortBy === key && "bg-primary/10 font-medium",
                )}
              >
                {SORT_LABELS[key]}

                {sortBy === key && <Check className="size-3.5 text-primary" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          variant="outline"
          size="sm"
          onClick={handleExportCSV}
          disabled={!sortedPosts.length}
          className="h-8 cursor-pointer gap-2 rounded-xl border-[0.5px] bg-card px-3 text-xs font-medium"
          title="Export the visible page of posts"
        >
          <Download className="size-3.5 text-muted-foreground" />
          Export page
        </Button>
      </div>

      {/* Posts table */}

      <div className="max-h-[740px] min-h-[360px] overflow-auto rounded-xl border-[0.5px] border-border">
        <table className="w-full min-w-[760px] table-fixed text-xs">
          <colgroup>
            <col />

            {tableMetrics.map((key) => (
              <col
                key={key}
                className={key === "shares" ? "w-[144px]" : "w-[100px]"}
              />
            ))}

            {showEngagementRate ? <col className="w-[96px]" /> : null}

            <col className="w-12" />
          </colgroup>

          <thead>
            <tr className="border-b-[0.5px] border-border text-muted-foreground">
              <SortableHead
                align="left"
                active={displayedSort === "latest"}
                onClick={() => setSortBy("latest")}
              >
                Post
              </SortableHead>

              {tableMetrics.map((key) => {
                const Icon = metricIcons[key];

                const sortable = ["views", "impressions", "likes"].includes(
                  key,
                );

                return (
                  <SortableHead
                    key={key}
                    active={displayedSort === key}
                    onClick={
                      sortable ? () => setSortBy(key as SortKey) : undefined
                    }
                  >
                    <Icon className="size-3 opacity-60" />
                    {metricLabels[key]}
                  </SortableHead>
                );
              })}

              {showEngagementRate ? (
                <SortableHead
                  active={displayedSort === "eng_rate"}
                  onClick={() => setSortBy("eng_rate")}
                >
                  <Percent className="size-3 opacity-60" />
                  Eng. rate
                </SortableHead>
              ) : null}

              <th className="sticky top-0 z-10 bg-card" />
            </tr>
          </thead>

          <tbody className="divide-y-[0.5px] divide-border">
            {!sortedPosts.length && (
              <tr>
                <td
                  colSpan={
                    tableMetrics.length + (showEngagementRate ? 1 : 0) + 2
                  }
                  className="px-4 py-16 text-center"
                >
                  <p className="text-sm font-medium text-foreground">
                    {feedQuery.isFetching
                      ? "Loading published posts…"
                      : feedQuery.isError ||
                          dashboardData?.dataset_complete === false
                        ? "Published posts could not be loaded"
                        : totalPublishedPosts === 0
                          ? `No posts published during ${formattedDateLabel.toLowerCase()}.`
                          : "No posts on this page."}
                  </p>

                  <p className="mt-1 text-xs text-muted-foreground">
                    {feedQuery.isError ||
                    dashboardData?.dataset_complete === false
                      ? "Retry the request to see post performance."
                      : "Change the date range or account to view another set of posts."}
                  </p>
                </td>
              </tr>
            )}

            {sortedPosts.map((post) => {
              const mediaThumb = post.media_urls?.[0];

              const externalUrl = analyticsPostUrl(post);

              const num =
                "px-3 py-3 text-right align-middle tabular-nums text-foreground";

              return (
                <tr
                  key={post.variant_id}
                  title={post.metrics_notice ?? undefined}
                  className="group transition-colors hover:bg-muted/40"
                >
                  {/* Post: thumb slot + clamped text + meta */}

                  <td className="min-w-0 px-3 py-3 align-middle">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border-[0.5px] border-border bg-muted/40">
                        {mediaThumb ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={mediaThumb}
                            alt=""
                            loading="lazy"
                            className="size-full object-cover"
                          />
                        ) : (
                          <FileText className="size-4 text-muted-foreground/60" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1 space-y-1">
                        <p
                          title={post.text}
                          className="line-clamp-2 break-words text-[13px] leading-snug text-foreground"
                        >
                          {post.text || "No text content"}
                        </p>

                        <div className="flex min-w-0 items-center gap-3 overflow-hidden whitespace-nowrap text-[11px] text-muted-foreground">
                          <span className="shrink-0">
                            {formatRelativeTime(
                              post.published_at || post.created_at,
                            )}
                          </span>

                          <span className="shrink-0">
                            {selectedAccountId === "all"
                              ? `${post.account_display_name || channelName(post.platform)} · ${channelName(post.platform)}`
                              : channelName(post.platform)}
                          </span>

                          {post.post_id && (
                            <Link
                              href={`/dashboard/content?${new URLSearchParams({ post: post.post_id, variant: post.variant_id })}`}
                              className="shrink-0 underline-offset-2 transition-colors hover:text-foreground hover:underline"
                            >
                              Open in studio
                            </Link>
                          )}

                          {externalUrl && (
                            <a
                              href={externalUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex min-w-0 items-center gap-1 underline-offset-2 transition-colors hover:text-foreground hover:underline"
                            >
                              <span className="truncate">
                                View on {channelName(post.platform)}
                              </span>

                              <ExternalLink className="size-2.5 shrink-0" />
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>

                  {tableMetrics.map((key) => (
                    <td key={key} className={num}>
                      {postMetric(
                        post,
                        key,
                        post[key as keyof PostFeedItemAnalytics] as number,
                      )}
                    </td>
                  ))}

                  {showEngagementRate ? (
                    <td className="px-3 py-3 text-right align-middle">
                      <span
                        className={cn(
                          "inline-block min-w-[3.25rem] rounded-full px-2 py-0.5 text-center font-medium tabular-nums",
                          hasEngagementRate(post)
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                            : "bg-muted text-muted-foreground",
                        )}
                      >
                        {postEngagementRate(post)}
                      </span>
                    </td>
                  ) : null}

                  <td className="px-2 py-3 text-right align-middle">
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <button
                            type="button"
                            aria-label="Post actions"
                            className="rounded-md p-1 text-muted-foreground opacity-0 transition-all hover:bg-muted hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100 data-[popup-open]:opacity-100"
                          >
                            <MoreHorizontal className="size-4" />
                          </button>
                        }
                      />

                      <DropdownMenuContent align="end" className="w-48 text-xs">
                        <DropdownMenuItem
                          className="gap-2"
                          onClick={async () => {
                            await navigator.clipboard.writeText(post.text);

                            toast.success("Post text copied");
                          }}
                        >
                          <Copy className="size-3 text-muted-foreground" />
                          Copy text
                        </DropdownMenuItem>

                        {post.post_id && (
                          <DropdownMenuItem
                            className="gap-2"
                            onClick={() =>
                              router.push(
                                `/dashboard/content?${new URLSearchParams({ post: post.post_id!, variant: post.variant_id })}`,
                              )
                            }
                          >
                            <Sparkles className="size-3 text-muted-foreground" />
                            Open in studio
                          </DropdownMenuItem>
                        )}

                        {externalUrl && (
                          <DropdownMenuItem
                            className="gap-2"
                            onClick={() =>
                              window.open(
                                externalUrl,

                                "_blank",

                                "noopener,noreferrer",
                              )
                            }
                          >
                            <ExternalLink className="size-3 text-muted-foreground" />
                            View on {channelName(post.platform)}
                          </DropdownMenuItem>
                        )}

                        {post.external_post_id && (
                          <DropdownMenuItem
                            className="gap-2"
                            onClick={async () => {
                              await navigator.clipboard.writeText(
                                post.external_post_id!,
                              );

                              toast.success("External ID copied");
                            }}
                          >
                            <Copy className="size-3 text-muted-foreground" />
                            Copy external ID
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
        <span>
          {feedQuery.isFetching
            ? "Fetching live posts…"
            : totalPublishedPosts === undefined ||
                !dashboardData?.dataset_complete
              ? `Showing ${pageStart}–${pageEnd} posts`
              : `Showing ${pageStart}–${pageEnd} of ${formatNumber(totalPublishedPosts)} posts`}

          {feedPosts.length > 0 && sortBy !== "latest"
            ? " · Sorted on this page"
            : ""}
        </span>

        <div className="flex items-center gap-2">
          <Button
            className="rounded-md"
            variant="outline"
            size="sm"
            disabled={feedOffset === 0 || feedQuery.isFetching}
            onClick={() =>
              setPageState({
                scope: feedScope,

                offset: Math.max(0, feedOffset - ANALYTICS_PAGE_SIZE),
              })
            }
          >
            Previous
          </Button>

          <Button
            className="rounded-md"
            variant="outline"
            size="sm"
            disabled={!canGoNext || feedQuery.isFetching}
            onClick={() =>
              setPageState({
                scope: feedScope,

                offset: feedOffset + ANALYTICS_PAGE_SIZE,
              })
            }
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}

function AnalyticsViewContent() {
  const trpc = useTRPC();
  const { setStudioNavigation } = useComposer();
  const accountsQuery = useSuspenseQuery(trpc.studio.accounts.queryOptions());
  const accounts: Account[] = accountsQuery.data ?? EMPTY_ACCOUNTS;

  useEffect(() => {
    if (!accounts.length) {
      setStudioNavigation(null);
    }
  }, [accounts.length, setStudioNavigation]);

  /* ------------------------------- Error state ------------------------------ */

  if (accountsQuery.isError) {
    return (
      <div className="flex h-full min-h-[450px] flex-col items-center justify-center p-8 text-center">
        <AlertCircle className="mb-3 size-6 text-destructive" />
        <h2 className="text-base font-semibold tracking-tight">
          Accounts could not be loaded
        </h2>
        <p className="mt-1.5 max-w-sm text-[13px] text-muted-foreground">
          Check the connection and retry to load analytics.
        </p>
        <Button
          className="mt-5"
          variant="outline"
          onClick={() => void accountsQuery.refetch()}
        >
          Try again
        </Button>
      </div>
    );
  }

  /* ------------------------------- Empty state ------------------------------ */

  if (!accounts.length) {
    return (
      <div className="flex h-full min-h-[450px] flex-col items-center justify-center p-8 text-center">
        <div className="mb-4 flex size-12 items-center justify-center rounded-xl border-[0.5px] border-border bg-card shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
          <TrendingUp className="size-5 text-muted-foreground" />
        </div>
        <h2 className="text-base font-semibold tracking-tight">
          No accounts connected
        </h2>
        <p className="mt-1.5 max-w-sm text-[13px] leading-relaxed text-muted-foreground">
          Connect an account to see post analytics, impression trends and
          audience engagement.
        </p>
        <Link href="/dashboard/channels" className="mt-5">
          <Button size="sm" className="gap-1.5">
            <Plus className="size-4" />
            Connect a channel
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <Suspense fallback={<AnalyticsSkeleton />}>
      <AnalyticsDashboardContent accounts={accounts} />
    </Suspense>
  );
}

export default function AnalyticsView() {
  return (
    <Suspense fallback={<AnalyticsSkeleton />}>
      <AnalyticsViewContent />
    </Suspense>
  );
}
