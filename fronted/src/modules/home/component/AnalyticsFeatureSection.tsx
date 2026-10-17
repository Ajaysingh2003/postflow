"use client";

import React, { useState } from "react";
import {
  BarChart3,
  TrendingUp,
  Sparkles,
  Zap,
  Check,
  ArrowUpRight,
  RefreshCw,
  Eye,
  MessageSquare,
  Repeat,
  Bookmark,
  Share2,
  SlidersHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/*  Mock Data                                                                 */
/* -------------------------------------------------------------------------- */

type ChannelTab = "all" | "linkedin" | "x" | "threads";

interface ChannelStat {
  name: string;
  views: string;
  growth: string;
  er: string;
  interactions: string;
  badge: string;
}

const CHANNEL_STATS: Record<ChannelTab, ChannelStat> = {
  all: {
    name: "All Connected Networks",
    views: "248.6K",
    growth: "+28.4%",
    er: "5.6%",
    interactions: "4,820",
    badge: "Combined Velocity",
  },
  linkedin: {
    name: "LinkedIn (Personal + Page)",
    views: "118.2K",
    growth: "+34.1%",
    er: "6.2%",
    interactions: "2,340",
    badge: "Top Conversion",
  },
  x: {
    name: "X (Twitter)",
    views: "89.4K",
    growth: "+22.8%",
    er: "4.8%",
    interactions: "1,680",
    badge: "Fastest Reach",
  },
  threads: {
    name: "Threads",
    views: "41.0K",
    growth: "+46.5%",
    er: "7.1%",
    interactions: "800",
    badge: "Highest ER",
  },
};

const BREAKOUT_POSTS = [
  {
    id: "post-1",
    title: "Why 90% of content strategies fail in month 2",
    format: "LinkedIn Carousel",
    velocityIndex: "98.4",
    multiplier: "3.8x above median",
    bars: [30, 48, 82, 100, 92, 85],
    stat: "1,420 interactions in first 60m",
  },
  {
    id: "post-2",
    title: "Our complete async tech stack teardown",
    format: "Multi-tweet Thread",
    velocityIndex: "92.1",
    multiplier: "2.9x above median",
    bars: [25, 40, 68, 88, 95, 78],
    stat: "890 reposts & bookmarks",
  },
  {
    id: "post-3",
    title: "The zero-click content formula for B2B",
    format: "Conversational Hook",
    velocityIndex: "86.5",
    multiplier: "2.2x above median",
    bars: [20, 35, 55, 76, 84, 70],
    stat: "340 profile visits",
  },
];

const FORMAT_INSIGHTS = [
  {
    name: "PDF Carousels",
    retention: 94,
    er: "6.4%",
    highlight: "2.8x higher inbound leads vs text",
  },
  {
    name: "Multi-tweet Threads",
    retention: 86,
    er: "4.9%",
    highlight: "Highest bookmark-to-view ratio",
  },
  {
    name: "Short-form Hooks",
    retention: 68,
    er: "3.2%",
    highlight: "Fastest algorithmic initial pickup",
  },
];

export default function AnalyticsFeatureSection() {
  // Card 1 State: Active Channel Filter & Sync Simulation
  const [activeChannel, setActiveChannel] = useState<ChannelTab>("all");
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncText, setLastSyncText] = useState("Live · Updated 12s ago");

  const currentStat = CHANNEL_STATS[activeChannel];

  const handleSimulateSync = () => {
    setIsSyncing(true);
    setTimeout(() => {
      setIsSyncing(false);
      setLastSyncText("Just updated · Official API");
    }, 600);
  };

  // Card 2 State: Breakout Post Selector
  const [selectedPostId, setSelectedPostId] = useState("post-1");
  const activePost =
    BREAKOUT_POSTS.find((p) => p.id === selectedPostId) ?? BREAKOUT_POSTS[0];

  // Card 3 State: Format Insight Highlight
  const [activeFormatIdx, setActiveFormatIdx] = useState(0);
  const activeFormat = FORMAT_INSIGHTS[activeFormatIdx];

  return (
    <section className="mx-auto w-full max-w-7xl  py-16   lg:py-24">
      {/* Editorial Header */}
      <div className="max-w-2xl">
        <div className="inline-flex items-center gap-2 rounded-full border border-[#3fda8a]/40 bg-[#3fda8a]/10 px-3 py-1">
          <span className="size-2 rounded-full bg-[#3fda8a]" />
          <span className="font-subheading text-xs font-medium tracking-wide text-[#11120e]">
            Draftva Intelligence
          </span>
        </div>

        <h2 className="font-heading mt-4 text-3xl font-semibold tracking-tight text-[#11120e] sm:text-5xl">
          Measure true reach.{" "}
          <span className="underline decoration-[#3fda8a] decoration-[3px] underline-offset-8">
            Double down on winners.
          </span>
        </h2>

        <p className="mt-4 text-base leading-relaxed text-[#6d7066] sm:text-lg">
          Stop jumping between four confusing platform dashboards. Draftva pulls
          official, live API telemetry across X, LinkedIn, Threads, and Meta into
          one real-time performance stream.
        </p>
      </div>

      {/* Unified Architectural 3-Column Grid */}
      <div className="mt-12 grid grid-cols-1 divide-y divide-black/[0.07] overflow-hidden rounded-3xl border border-black/[0.08] bg-white shadow-[0_24px_60px_-20px_rgba(17,18,14,0.07)] lg:mt-16 lg:grid-cols-3 lg:divide-x lg:divide-y-0">
        {/* =========================================================
            01: UNIFIED CROSS-CHANNEL STREAM
        ========================================================= */}
        <div className="flex flex-col justify-between p-6 sm:p-8 lg:p-10">
          <div>
            <div className="flex items-center justify-between">
              <span className="font-subheading inline-flex size-7 items-center justify-center rounded-lg bg-[#3fda8a] text-xs font-bold text-[#11120e]">
                01
              </span>
              <span className="font-subheading text-xs text-[#85887e]">
                Unified Telemetry
              </span>
            </div>

            <h3 className="font-heading mt-6 text-xl font-semibold tracking-tight text-[#11120e]">
              All channels in one live view
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-[#6d7066]">
              Consolidate verified impressions, true engagement rates, and
              audience conversion from every connected account in real time.
            </p>
          </div>

          {/* Visual: Interactive Live Telemetry Feed */}
          <div className="mt-8 border-t border-black/[0.05] pt-6">
            {/* Channel Switcher */}
            <div className="flex items-center gap-1 overflow-x-auto rounded-xl bg-[#faf9f5] p-1 border border-black/[0.06] [scrollbar-width:none]">
              {(
                [
                  { id: "all", label: "All" },
                  { id: "linkedin", label: "LinkedIn" },
                  { id: "x", label: "X" },
                  { id: "threads", label: "Threads" },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveChannel(tab.id)}
                  className={cn(
                    "font-subheading flex-1 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-center text-xs font-medium transition-all",
                    activeChannel === tab.id
                      ? "bg-white text-[#11120e] shadow-2xs font-semibold"
                      : "text-[#6d7066] hover:text-[#11120e]",
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Telemetry Metric Card */}
            <div className="mt-3 rounded-2xl border border-black/[0.06] bg-[#faf9f5] p-4">
              <div className="flex items-center justify-between">
                <span className="font-subheading text-[11px] text-[#85887e]">
                  {currentStat.name}
                </span>
                <span className="font-subheading rounded-full bg-[#3fda8a]/20 px-2 py-0.5 text-[10px] font-semibold text-[#0f7a47]">
                  {currentStat.badge}
                </span>
              </div>

              <div className="mt-2 flex items-baseline justify-between">
                <div>
                  <span className="font-heading text-2xl font-bold tracking-tight text-[#11120e]">
                    {currentStat.views}
                  </span>
                  <span className="font-subheading ml-1.5 text-xs font-semibold text-[#0f7a47]">
                    {currentStat.growth}
                  </span>
                </div>
                <div className="text-right">
                  <span className="font-subheading block text-[10px] uppercase tracking-wider text-[#85887e]">
                    Eng. Rate
                  </span>
                  <span className="font-heading text-sm font-semibold text-[#11120e]">
                    {currentStat.er}
                  </span>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between border-t border-black/[0.05] pt-2.5 text-xs text-[#6d7066]">
                <span>Interactions: {currentStat.interactions}</span>
                <span className="font-subheading text-[11px] text-[#85887e]">
                  {lastSyncText}
                </span>
              </div>
            </div>

            {/* Action Bar */}
            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={handleSimulateSync}
                disabled={isSyncing}
                className="font-subheading secondary-btn flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#11120e] px-3.5 py-2.5 text-xs font-medium text-white transition-all hover:bg-[#11120e]/90 active:scale-[0.99] disabled:opacity-75"
              >
                <RefreshCw
                  className={cn("size-3.5 text-[#3fda8a]", isSyncing && "animate-spin")}
                />
                <span>{isSyncing ? "Syncing APIs..." : "Fetch Live Data"}</span>
              </button>
            </div>
          </div>
        </div>

        {/* =========================================================
            02: BREAKOUT VELOCITY DETECTOR (Dark Telemetry)
        ========================================================= */}
        <div className="flex flex-col justify-between bg-[#faf9f5]/50 p-6 sm:p-8 lg:p-10">
          <div>
            <div className="flex items-center justify-between">
              <span className="font-subheading inline-flex size-7 items-center justify-center rounded-lg bg-[#3fda8a] text-xs font-bold text-[#11120e]">
                02
              </span>
              <span className="font-subheading inline-flex items-center gap-1 text-xs text-[#11120e]">
                <Sparkles className="size-3 fill-[#3fda8a] text-[#3fda8a]" />
                Early Traction
              </span>
            </div>

            <h3 className="font-heading mt-6 text-xl font-semibold tracking-tight text-[#11120e]">
              Detect breakout posts in 60m
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-[#6d7066]">
              Draftva benchmarks early engagement against your historical median
              to spot viral pickup early so you can engage, quote, or plug.
            </p>
          </div>

          {/* Visual: Dark Telemetry Velocity Box */}
          <div className="mt-8 border-t border-black/[0.05] pt-6">
            <div className="rounded-2xl bg-[#11120e] p-4 text-white shadow-md">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Zap className="size-3.5 text-[#3fda8a]" />
                  <span className="font-subheading text-[11px] uppercase tracking-wider text-neutral-400">
                    Velocity Score: {activePost.velocityIndex}
                  </span>
                </div>
                <span className="font-subheading rounded-full bg-[#3fda8a]/15 px-2 py-0.5 text-[11px] font-medium text-[#3fda8a]">
                  {activePost.multiplier}
                </span>
              </div>

              {/* Mini Velocity Hourly Spike Chart */}
              <div className="mt-4 flex h-12 items-end gap-2 px-1">
                {activePost.bars.map((height, idx) => {
                  const isPeak = height >= 90;
                  return (
                    <div
                      key={idx}
                      className="flex h-full flex-1 flex-col items-center justify-end gap-1"
                    >
                      <div
                        style={{ height: `${height}%` }}
                        className={cn(
                          "w-full rounded-t-md transition-all duration-300",
                          isPeak ? "bg-[#3fda8a]" : "bg-white/15",
                        )}
                      />
                    </div>
                  );
                })}
              </div>

              {/* Active Post Title Snippet */}
              <div className="mt-3 truncate text-xs text-neutral-300">
                <span className="font-semibold text-white">Trigger: </span>
                {activePost.title}
              </div>

              {/* Interactive Post Pills */}
              <div className="mt-3 grid grid-cols-3 gap-1.5">
                {BREAKOUT_POSTS.map((post, idx) => {
                  const isSelected = post.id === selectedPostId;
                  return (
                    <button
                      key={post.id}
                      type="button"
                      onClick={() => setSelectedPostId(post.id)}
                      className={cn(
                        "font-subheading rounded-lg px-2 py-1.5 text-center text-[10px] font-medium transition-all truncate",
                        isSelected
                          ? "bg-[#3fda8a] font-semibold text-[#11120e] shadow-xs"
                          : "bg-white/[0.07] text-neutral-300 hover:bg-white/[0.12]",
                      )}
                    >
                      Post #{idx + 1}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* =========================================================
            03: FORMAT INTELLIGENCE & ACTIONABLE TAKEAWAYS
        ========================================================= */}
        <div className="flex flex-col justify-between p-6 sm:p-8 lg:p-10">
          <div>
            <div className="flex items-center justify-between">
              <span className="font-subheading inline-flex size-7 items-center justify-center rounded-lg bg-[#3fda8a] text-xs font-bold text-[#11120e]">
                03
              </span>
              <span className="font-subheading inline-flex items-center gap-1.5 text-xs text-[#11120e]">
                <span className="size-2 rounded-full bg-[#3fda8a] animate-pulse" />
                Actionable Insights
              </span>
            </div>

            <h3 className="font-heading mt-6 text-xl font-semibold tracking-tight text-[#11120e]">
              Insights you can act on today
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-[#6d7066]">
              Learn exactly which formats, hook styles, and publishing windows
              produce inbound opportunities — not just empty vanity clicks.
            </p>
          </div>

          {/* Visual: Live Insight Recommendation Card */}
          <div className="mt-8 border-t border-black/[0.05] pt-6">
            <div className="relative overflow-hidden rounded-2xl border border-[#3fda8a]/40 bg-gradient-to-br from-[#3fda8a]/[0.12] via-[#3fda8a]/[0.04] to-white p-4">
              <div className="flex items-start gap-3.5">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-[#3fda8a] text-[#11120e] shadow-xs">
                  <Check className="size-4 stroke-[2.5]" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-heading text-xs font-semibold text-[#11120e]">
                      {activeFormat.name}
                    </span>
                    <span className="font-subheading inline-flex items-center gap-0.5 text-[11px] font-medium text-[#11120e]">
                      ER {activeFormat.er}
                      <ArrowUpRight className="size-3 text-[#11120e]" />
                    </span>
                  </div>

                  <p className="mt-1 text-xs leading-relaxed text-[#6d7066]">
                    {activeFormat.highlight}
                  </p>
                </div>
              </div>

              {/* Format Retention Comparison Bars */}
              <div className="mt-4 space-y-2 border-t border-black/[0.06] pt-3">
                <div className="flex items-center justify-between text-[10px] text-[#6d7066]">
                  <span className="font-subheading uppercase tracking-wider">
                    Format Completion Rate
                  </span>
                  <span className="font-semibold text-[#11120e]">
                    {activeFormat.retention}%
                  </span>
                </div>
                <div className="flex gap-1.5">
                  {FORMAT_INSIGHTS.map((item, idx) => (
                    <button
                      key={item.name}
                      type="button"
                      onClick={() => setActiveFormatIdx(idx)}
                      className="group relative flex-1"
                    >
                      <div
                        className={cn(
                          "h-2 w-full rounded-full transition-all",
                          idx === activeFormatIdx
                            ? "bg-[#3fda8a]"
                            : "bg-black/[0.08] hover:bg-black/[0.15]",
                        )}
                      />
                      <span className="mt-1 block truncate text-[9px] text-[#85887e]">
                        {item.name.split(" ")[0]}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
