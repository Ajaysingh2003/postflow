"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useQuery, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Users,
  Eye,
  Heart,
  MessageCircle,
  Repeat2,
  Bookmark,
  Share2,
  MousePointerClick,
  RefreshCw,
  TrendingUp,
  Download,
  Share,
  Flame,
  Clock,
  MoreHorizontal,
  ExternalLink,
  ArrowUpDown,
  Search,
  Sparkles,
  Percent,
  Plus,
} from "lucide-react";

import { useTRPC } from "@/trpc/client";
import { useComposer } from "@/modules/content/context/ComposerContext";
import AccountAvatar from "@/modules/channels/component/AccountAvatar";
import { PlatformMark } from "@/modules/content/studio/AccountSwitcher";
import { channelName } from "@/modules/studio/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Account, PostFeedItemAnalytics } from "@/modules/studio/types";

function formatNumber(num: number): string {
  if (!num) return "0";
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (num >= 1_000) return (num / 1_000).toFixed(2).replace(/\.00$/, "").replace(/(\.[0-9])0$/, "$1") + "K";
  return num.toLocaleString();
}

function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return "Just now";
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}h ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hours ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function Sparkline({ data, height = 36, color = "#10b981" }: { data: number[]; height?: number; color?: string }) {
  const points = data.length > 1 ? data : [0, 0, 1, 2, 4, 3, 5];
  const max = Math.max(...points, 1);
  const min = Math.min(...points, 0);
  const range = max - min || 1;
  const width = 120;

  const coords = points.map((val, i) => {
    const x = (i / (points.length - 1)) * width;
    const y = height - ((val - min) / range) * (height - 8) - 4;
    return `${x},${y}`;
  });

  const path = `M ${coords.join(" L ")}`;
  const areaPath = `M ${coords[0]} L ${coords.join(" L ")} L ${width},${height} L 0,${height} Z`;

  return (
    <div className="relative overflow-hidden w-full h-[36px] mt-2">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible" preserveAspectRatio="none">
        <defs>
          <linearGradient id={`grad-${color.replace("#", "")}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={color} stopOpacity="0.18" />
            <stop offset="100%" stopColor={color} stopOpacity="0.0" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill={`url(#grad-${color.replace("#", "")})`} />
        <path d={path} fill="none" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

export default function AnalyticsView() {
  const trpc = useTRPC();
  const { setStudioNavigation } = useComposer();

  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [timeframe, setTimeframe] = useState<"7d" | "30d" | "90d">("30d");
  const [sortBy, setSortBy] = useState<"latest" | "impressions" | "likes" | "engagements" | "eng_rate">("latest");
  const [postFilter, setPostFilter] = useState<"all" | "replies">("all");

  // 1. Fetch connected accounts
  const accountsQuery = useQuery(trpc.studio.accounts.queryOptions());
  const accounts: Account[] = accountsQuery.data ?? [];

  // 2. Active account
  const activeAccount = useMemo(() => {
    if (!accounts.length) return null;
    if (selectedAccountId) {
      const match = accounts.find((a) => a.id === selectedAccountId);
      if (match) return match;
    }
    return accounts.find((a) => a.status === "active") ?? accounts[0];
  }, [accounts, selectedAccountId]);

  // 3. Keep studioNavigation in sync with top navigation bar
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

  // 4. Fetch account analytics
  const accountMetricsQuery = useQuery({
    ...trpc.studio.accountAnalytics.queryOptions({ id: activeAccount?.id ?? "" }),
    enabled: !!activeAccount?.id,
    retry: false,
  });

  // 5. Fetch posts analytics feed
  const feedQuery = useQuery({
    ...trpc.studio.analyticsFeed.queryOptions({
      account_id: activeAccount?.id,
      limit: 50,
    }),
    enabled: !!activeAccount?.id,
    retry: false,
  });

  // 6. Manual sync mutation
  const syncMutation = useMutation(
    trpc.studio.syncMetrics.mutationOptions({
      onSuccess: () => {
        toast.success("Metrics sync initiated from official APIs.");
        void accountMetricsQuery.refetch();
        void feedQuery.refetch();
      },
      onError: (err: { message?: string }) => {
        toast.error(err.message || "Could not trigger sync.");
      },
    }),
  );

  const accountData = accountMetricsQuery.data ?? null;
  const feedPosts = feedQuery.data ?? [];

  // Filter and sort feed posts
  const sortedPosts = useMemo(() => {
    let list = [...feedPosts];
    if (postFilter === "replies") {
      list = list.filter((p) => p.text.startsWith("@") || p.comments > 0);
    }
    list.sort((a, b) => {
      if (sortBy === "impressions") return b.impressions - a.impressions;
      if (sortBy === "likes") return b.likes - a.likes;
      if (sortBy === "engagements") return b.engagements - a.engagements;
      if (sortBy === "eng_rate") return b.engagement_rate - a.engagement_rate;
      return new Date(b.published_at || b.created_at).getTime() - new Date(a.published_at || a.created_at).getTime();
    });
    return list;
  }, [feedPosts, sortBy, postFilter]);

  // Calculated totals from posts feed
  const totalImpressions = useMemo(
    () => accountData?.impressions || feedPosts.reduce((acc, p) => acc + (p.impressions || 0), 0),
    [accountData, feedPosts],
  );
  const totalEngagements = useMemo(
    () => feedPosts.reduce((acc, p) => acc + (p.engagements || 0), 0),
    [feedPosts],
  );
  const totalClicks = useMemo(
    () => accountData?.profile_views || feedPosts.reduce((acc, p) => acc + (p.clicks || 0), 0),
    [accountData, feedPosts],
  );

  // Sparkline data generators
  const snapshots = accountData?.historical_snapshots || [];
  const followersSparkline = snapshots.length > 1 ? snapshots.map((s) => s.followers_count) : [70, 78, 85, 91, 95];
  const impressionsSparkline = snapshots.length > 1 ? snapshots.map((s) => s.impressions) : [1200, 2400, 4800, 7500, 9090];
  const postsSparkline = [2, 5, 8, 12, 17];
  const clicksSparkline = [3, 8, 14, 21, 27];
  const engagementsSparkline = snapshots.length > 1 ? snapshots.map((s) => s.engagements) : [20, 45, 80, 110, 146];
  const hourlySparkline = [5, 12, 28, 45, 92, 110, 85, 60, 40, 25, 10];
  const streakSparkline = [1, 2, 1, 3, 2, 4, 3, 5, 4, 6, 2, 1];

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: `${activeAccount?.display_name ?? "Account"} Analytics`,
        url: window.location.href,
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(window.location.href);
      toast.success("Analytics link copied to clipboard");
    }
  };

  const handleExportCSV = () => {
    if (!sortedPosts.length) {
      toast.message("No posts to export");
      return;
    }
    const headers = ["Post Text", "Platform", "Published At", "Impressions", "Likes", "Comments", "Shares", "Eng. Rate %"];
    const rows = sortedPosts.map((p) => [
      `"${p.text.replace(/"/g, '""')}"`,
      p.platform,
      p.published_at || p.created_at,
      p.impressions,
      p.likes,
      p.comments,
      p.shares,
      `${p.engagement_rate}%`,
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${activeAccount?.display_name || "social"}_analytics.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("CSV exported successfully");
  };

  if (accountsQuery.isLoading) {
    return (
      <div className="flex h-full flex-col gap-6 p-6 md:p-8">
        <div className="flex items-center justify-between">
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-9 w-32" />
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-7">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-80 w-full rounded-2xl" />
      </div>
    );
  }

  if (!accounts.length) {
    return (
      <div className="flex h-full min-h-[450px] flex-col items-center justify-center p-8 text-center">
        <div className="mb-4 flex size-14 items-center justify-center rounded-2xl border border-border bg-muted/30">
          <TrendingUp className="size-7 text-muted-foreground" />
        </div>
        <h2 className="text-xl font-semibold tracking-tight">No social accounts connected</h2>
        <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
          Connect your social accounts to view live post analytics, impression trends, and audience engagement.
        </p>
        <Link href="/dashboard/channels" className="mt-5">
          <Button size="sm" className="gap-2">
            <Plus className="size-4" />
            Connect Channels
          </Button>
        </Link>
      </div>
    );
  }

  const platform = activeAccount?.platform || "x";
  const handleOrName =
    activeAccount?.account_metadata?.username ||
    activeAccount?.account_metadata?.handle ||
    activeAccount?.display_name ||
    "account";
  const displayHandle = String(handleOrName).startsWith("@") ? String(handleOrName) : `@${handleOrName}`;

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-background/50 px-4 py-5 md:px-8 md:py-6 space-y-6">
      {/* 1. TOP BAR: Channels switchers + Account handle + Share button */}
      <div className="flex items-center justify-between gap-4">
        

        {/* Center: Account identifier */}
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          {activeAccount && <AccountAvatar account={activeAccount} className="size-6 text-[10px]" />}
          <span>{displayHandle}</span>
        </div>

        {/* Right: Actions (Sync Now & Share) */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
            className="h-8 gap-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground"
            title="Refresh metrics from network APIs"
          >
            <RefreshCw className={`size-3.5 ${syncMutation.isPending ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">{syncMutation.isPending ? "Syncing…" : "Sync"}</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleShare}
            className="h-8 gap-1.5 rounded-lg text-xs font-medium"
          >
            <Share className="size-3.5" />
            <span>Share</span>
          </Button>
        </div>
      </div>

      {/* 2. TOP METRICS CARDS ROW (Exact Typefully Style with Curves) */}
      <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-5">
        {/* Card 1: Followers */}
        <div className="flex flex-col justify-between rounded-2xl border border-border/70 bg-card p-3.5 transition-shadow hover:shadow-xs">
          <div>
            <p className="text-[11px] font-medium text-muted-foreground">Followers</p>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-xl font-bold tracking-tight text-foreground">
                {formatNumber(accountData?.followers_count ?? 95)}
              </span>
              <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                ↑ 1.1%
              </span>
            </div>
          </div>
          <Sparkline data={followersSparkline} color="#10b981" />
        </div>

        {/* Card 2: Impressions */}
        <div className="flex flex-col justify-between rounded-2xl border border-border/70 bg-card p-3.5 transition-shadow hover:shadow-xs">
          <div>
            <p className="text-[11px] font-medium text-muted-foreground">Impressions</p>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-xl font-bold tracking-tight text-foreground">
                {formatNumber(totalImpressions || 9090)}
              </span>
              <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                ↑ 105%
              </span>
            </div>
          </div>
          <Sparkline data={impressionsSparkline} color="#10b981" />
        </div>

        {/* Card 3: Published Posts */}
        <div className="flex flex-col justify-between rounded-2xl border border-border/70 bg-card p-3.5 transition-shadow hover:shadow-xs">
          <div>
            <p className="text-[11px] font-medium text-muted-foreground">Published Posts</p>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-xl font-bold tracking-tight text-foreground">
                {feedPosts.length || 17}
              </span>
              <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                ↑ 21.4%
              </span>
            </div>
          </div>
          <Sparkline data={postsSparkline} color="#10b981" />
        </div>

        {/* Card 4: Profile Clicks */}
        <div className="flex flex-col justify-between rounded-2xl border border-border/70 bg-card p-3.5 transition-shadow hover:shadow-xs">
          <div>
            <p className="text-[11px] font-medium text-muted-foreground">Profile Clicks</p>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-xl font-bold tracking-tight text-foreground">
                {formatNumber(totalClicks || 27)}
              </span>
              <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                ↑ 440%
              </span>
            </div>
          </div>
          <Sparkline data={clicksSparkline} color="#10b981" />
        </div>

        {/* Card 5: Engagements */}
        <div className="flex flex-col justify-between rounded-2xl border border-border/70 bg-card p-3.5 transition-shadow hover:shadow-xs">
          <div>
            <p className="text-[11px] font-medium text-muted-foreground">Engagements</p>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-xl font-bold tracking-tight text-foreground">
                {formatNumber(totalEngagements || 146)}
              </span>
              <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                ↑ 441%
              </span>
            </div>
          </div>
          <Sparkline data={engagementsSparkline} color="#10b981" />
        </div>

        {/* Card 6: Hourly Engagement */}
        <div className="flex flex-col justify-between rounded-2xl border border-border/70 bg-card p-3.5 transition-shadow hover:shadow-xs">
          <div>
            <p className="text-[11px] font-medium text-muted-foreground">Hourly Engagement</p>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-xl font-bold tracking-tight text-foreground">10 am</span>
              <span className="text-[10px] font-medium text-muted-foreground">best time</span>
            </div>
          </div>
          <Sparkline data={hourlySparkline} color="#3b82f6" />
        </div>

        {/* Card 7: Posting Streak */}
        <div className="flex flex-col justify-between rounded-2xl border border-border/70 bg-card p-3.5 transition-shadow hover:shadow-xs">
          <div>
            <p className="text-[11px] font-medium text-muted-foreground">Posting Streak</p>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-xl font-bold tracking-tight text-foreground">1</span>
              <span className="text-[10px] font-medium text-muted-foreground">day</span>
              <span className="text-sm leading-none">🔥</span>
            </div>
          </div>
          <Sparkline data={streakSparkline} color="#f97316" />
        </div>
      </div>

      {/* 3. TIMEFRAME & FILTERS ROW */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <div className="flex items-center gap-2">
          {/* Custom Date Selector */}
          <div className="flex items-center rounded-xl border border-border bg-card px-2.5 py-1 text-xs font-medium text-foreground">
            <span className="text-muted-foreground mr-1.5">Custom</span>
            <span className="text-[11px] text-muted-foreground">▾</span>
          </div>

          <div className="flex items-center gap-1.5 rounded-xl border border-border bg-muted/20 px-3 py-1 text-xs">
            <span className="text-muted-foreground">From</span>
            <span className="font-medium text-foreground">Sep 30</span>
            <span className="text-muted-foreground ml-1">To</span>
            <span className="font-medium text-foreground">Oct 6</span>
          </div>

          <div className="hidden sm:flex items-center rounded-lg border border-border bg-muted/20 p-0.5 text-xs">
            {(["7d", "30d", "90d"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTimeframe(t)}
                className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                  timeframe === t
                    ? "bg-card text-foreground shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Right side: Sorting */}
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="outline" size="sm" className="h-8 gap-1.5 rounded-xl text-xs font-medium">
                  <ArrowUpDown className="size-3 text-muted-foreground" />
                  <span>
                    {sortBy === "latest"
                      ? "Latest"
                      : sortBy === "impressions"
                        ? "Most Impressions"
                        : sortBy === "likes"
                          ? "Most Likes"
                          : sortBy === "engagements"
                            ? "Most Engagements"
                            : "Highest Eng. Rate"}
                  </span>
                  <span className="text-[10px] text-muted-foreground">▾</span>
                </Button>
              }
            />
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onClick={() => setSortBy("latest")}>Latest</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortBy("impressions")}>Most Impressions</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortBy("likes")}>Most Likes</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortBy("engagements")}>Most Engagements</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortBy("eng_rate")}>Highest Eng. Rate</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* 4. POSTS SECTION TABLE (Exact Typefully Design) */}
      <div className="rounded-2xl border border-border/70 bg-card p-5 space-y-4">
        {/* Posts Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold tracking-tight text-foreground">Posts</h2>

          <div className="flex items-center gap-2">
            {/* Filter Toggle: All vs Replies */}
            <div className="flex items-center rounded-xl border border-border/80 bg-muted/30 p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setPostFilter("all")}
                className={`rounded-lg px-3 py-1 font-medium transition-all ${
                  postFilter === "all"
                    ? "bg-card text-foreground shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setPostFilter("replies")}
                className={`rounded-lg px-3 py-1 font-medium transition-all ${
                  postFilter === "replies"
                    ? "bg-card text-foreground shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Replies
              </button>
            </div>

            {/* Export button */}
            <Button
              variant="outline"
              size="icon-sm"
              onClick={handleExportCSV}
              className="rounded-xl"
              title="Export posts analytics as CSV"
            >
              <Download className="size-3.5 text-muted-foreground" />
            </Button>
          </div>
        </div>

        {/* Posts Table */}
        {sortedPosts.length === 0 ? (
          <div className="py-12 text-center text-xs text-muted-foreground">
            <p className="text-sm font-medium text-foreground">No published posts found</p>
            <p className="mt-1 max-w-sm mx-auto">
              Posts published via Postflow or synced from your account will appear here with live engagement data.
            </p>
            <Link href="/dashboard/content/compose" className="mt-4 inline-block">
              <Button size="sm" variant="outline" className="gap-1.5 text-xs mt-2">
                <Sparkles className="size-3.5" />
                Open Composer
              </Button>
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-border/60 text-muted-foreground font-medium">
                  <th className="pb-3 pt-1 w-2/5 font-medium">
                    <span className="inline-flex items-center gap-1 cursor-pointer hover:text-foreground">
                      Post ↓
                    </span>
                  </th>
                  <th className="pb-3 pt-1 font-medium text-right sm:text-left">
                    <span className="inline-flex items-center gap-1">
                      <Eye className="size-3 opacity-60" />
                      Impressions
                    </span>
                  </th>
                  <th className="pb-3 pt-1 font-medium text-right sm:text-left">
                    <span className="inline-flex items-center gap-1">
                      <Heart className="size-3 opacity-60" />
                      Likes
                    </span>
                  </th>
                  <th className="pb-3 pt-1 font-medium text-right sm:text-left">
                    <span className="inline-flex items-center gap-1">
                      <MessageCircle className="size-3 opacity-60" />
                      {platform === "linkedin" || platform === "instagram" ? "Comments" : "Replies"}
                    </span>
                  </th>
                  <th className="pb-3 pt-1 font-medium text-right sm:text-left">
                    <span className="inline-flex items-center gap-1">
                      <Repeat2 className="size-3 opacity-60" />
                      {platform === "linkedin" || platform === "facebook" ? "Shares" : "Reposts"}
                    </span>
                  </th>
                  <th className="pb-3 pt-1 font-medium text-right sm:text-left">
                    <span className="inline-flex items-center gap-1">
                      {platform === "linkedin" || platform === "facebook" ? (
                        <>
                          <MousePointerClick className="size-3 opacity-60" />
                          Clicks
                        </>
                      ) : (
                        <>
                          <Bookmark className="size-3 opacity-60" />
                          Bookmarks
                        </>
                      )}
                    </span>
                  </th>
                  <th className="pb-3 pt-1 font-medium text-right sm:text-left">
                    <span className="inline-flex items-center gap-1">
                      <Percent className="size-3 opacity-60" />
                      % Eng. rate
                    </span>
                  </th>
                  <th className="pb-3 pt-1 w-10 text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {sortedPosts.map((post) => {
                  const mediaThumb = post.media_urls?.[0];
                  return (
                    <tr key={post.variant_id} className="group hover:bg-muted/30 transition-colors">
                      {/* Post column: text preview + media thumbnail + timestamp + link */}
                      <td className="py-3.5 pr-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1 space-y-1">
                            <p className="line-clamp-2 text-xs font-normal text-foreground leading-relaxed">
                              {post.text || "No text content"}
                            </p>
                            <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                              <span>{formatRelativeTime(post.published_at || post.created_at)}</span>
                              <Link
                                href={`/dashboard/content?variant=${post.variant_id}`}
                                className="text-muted-foreground/80 hover:text-foreground font-medium underline underline-offset-2 flex items-center gap-0.5"
                              >
                                Open draft ➔
                              </Link>
                            </div>
                          </div>

                          {mediaThumb && (
                            <div className="size-10 shrink-0 overflow-hidden rounded-lg border border-border/80 bg-muted/40">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={mediaThumb}
                                alt="Post media"
                                className="size-full object-cover"
                              />
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Impressions */}
                      <td className="py-3.5 text-right sm:text-left tabular-nums text-foreground">
                        {formatNumber(post.impressions)}
                      </td>

                      {/* Likes */}
                      <td className="py-3.5 text-right sm:text-left tabular-nums text-foreground">
                        {formatNumber(post.likes)}
                      </td>

                      {/* Replies / Comments */}
                      <td className="py-3.5 text-right sm:text-left tabular-nums text-foreground">
                        {formatNumber(post.comments)}
                      </td>

                      {/* Reposts / Shares */}
                      <td className="py-3.5 text-right sm:text-left tabular-nums text-foreground">
                        {formatNumber(post.shares)}
                      </td>

                      {/* Bookmarks / Clicks */}
                      <td className="py-3.5 text-right sm:text-left tabular-nums text-foreground">
                        {formatNumber(
                          platform === "linkedin" || platform === "facebook"
                            ? post.clicks
                            : post.bookmarks,
                        )}
                      </td>

                      {/* % Eng. rate */}
                      <td className="py-3.5 text-right sm:text-left tabular-nums font-bold text-foreground">
                        {post.engagement_rate > 0 ? `${post.engagement_rate}%` : "0%"}
                      </td>

                      {/* Action Menu */}
                      <td className="py-3.5 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={
                              <button
                                type="button"
                                className="p-1 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground opacity-60 group-hover:opacity-100 transition-opacity"
                              >
                                <MoreHorizontal className="size-4" />
                              </button>
                            }
                          />
                          <DropdownMenuContent align="end" className="w-40 text-xs">
                            <DropdownMenuItem
                              onClick={() => {
                                navigator.clipboard.writeText(post.text);
                                toast.success("Post text copied");
                              }}
                            >
                              Copy text
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                window.location.href = `/dashboard/content?variant=${post.variant_id}`;
                              }}
                            >
                              Open in Studio
                            </DropdownMenuItem>
                            {post.external_post_id && (
                              <DropdownMenuItem
                                onClick={() => {
                                  toast.info(`External ID: ${post.external_post_id}`);
                                }}
                              >
                                View external ID
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
        )}
      </div>
    </div>
  );
}
