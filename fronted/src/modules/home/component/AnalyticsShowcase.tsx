"use client";

import React, { useState } from "react";
import {
  BarChart3,
  TrendingUp,
  Clock,
  Sparkles,
  Check,
  Users,
  Repeat,
} from "lucide-react";
import { cn } from "@/lib/utils";

import { PlatformBadge } from "./PlatformBadge";

/* -------------------------------------------------------------------------- */
/*  Types                                                                     */
/* -------------------------------------------------------------------------- */

type ChannelId = "all" | "x" | "linkedin" | "threads" | "facebook";
type PlatformId = "x" | "linkedin" | "threads";

function SectionBadge({
  icon: Icon,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-[#3fda8a]/40 bg-[#3fda8a]/15 px-3 py-1">
      <Icon className="size-3.5 text-[#0f7a47]" />
      <span className="font-subheading text-xs font-semibold text-[#0f7a47]">
        {children}
      </span>
    </div>
  );
}

function Copy({
  badge,
  title,
  body,
  points,
}: {
  badge: React.ReactNode;
  title: string;
  body: string;
  points: string[];
}) {
  return (
    <>
      {badge}
      <h2 className="font-heading mt-4 text-balance text-3xl font-semibold tracking-tight text-[#11120e] sm:text-4xl">
        {title}
      </h2>
      <p className="mt-4 text-base leading-relaxed text-[#6d7066]">{body}</p>
      <ul className="mt-6 space-y-3">
        {points.map((point) => (
          <li key={point} className="flex items-start gap-3">
            <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-[#3fda8a]/20 text-[#0f7a47]">
              <Check className="size-3 stroke-[2.5]" />
            </span>
            <span className="text-sm leading-relaxed text-[#11120e]">{point}</span>
          </li>
        ))}
      </ul>
    </>
  );
}

function WindowChrome({
  url,
  right,
}: {
  url: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-black/[0.06] bg-[#faf9f5] px-4 py-3 sm:px-5 sm:py-3.5">
      <div className="flex min-w-0 items-center gap-2">
        <span className="size-2.5 shrink-0 rounded-full bg-neutral-300" />
        <span className="size-2.5 shrink-0 rounded-full bg-neutral-300" />
        <span className="size-2.5 shrink-0 rounded-full bg-neutral-300" />
        <span className="font-subheading ml-2 truncate text-xs text-[#85887e]">
          {url}
        </span>
      </div>
      {right}
    </div>
  );
}

const Window = ({ children }: { children: React.ReactNode }) => (
  <div className="overflow-hidden rounded-3xl border border-black/[0.08] bg-white shadow-sm">
    {children}
  </div>
);

/* -------------------------------------------------------------------------- */
/*  Section 1 Data: Cross-Channel Benchmarks                                  */
/* -------------------------------------------------------------------------- */

const BENCHMARK_DATA: Record<
  ChannelId,
  {
    name: string;
    impressions: string;
    growth: string;
    er: string;
    clicks: string;
    topFormat: string;
    bars: number[];
  }
> = {
  all: {
    name: "All Channels",
    impressions: "248.6K",
    growth: "+31.4%",
    er: "5.8%",
    clicks: "3,410",
    topFormat: "LinkedIn PDF Carousel",
    bars: [45, 60, 95, 78, 62, 88, 100, 75],
  },
  linkedin: {
    name: "LinkedIn",
    impressions: "118.2K",
    growth: "+36.2%",
    er: "6.4%",
    clicks: "1,890",
    topFormat: "Document Carousel",
    bars: [30, 75, 100, 85, 60, 40, 30, 20],
  },
  x: {
    name: "X (Twitter)",
    impressions: "89.4K",
    growth: "+24.5%",
    er: "4.9%",
    clicks: "980",
    topFormat: "Multi-tweet Thread",
    bars: [40, 55, 90, 70, 50, 75, 95, 60],
  },
  threads: {
    name: "Threads",
    impressions: "41.0K",
    growth: "+48.0%",
    er: "7.2%",
    clicks: "540",
    topFormat: "Conversational Hook",
    bars: [25, 40, 55, 70, 90, 100, 95, 70],
  },
  facebook: {
    name: "Facebook",
    impressions: "26.3K",
    growth: "+18.1%",
    er: "3.8%",
    clicks: "410",
    topFormat: "Visual Post + Link",
    bars: [35, 50, 65, 80, 75, 60, 45, 30],
  },
};

const BAR_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun", "Today"];

/* -------------------------------------------------------------------------- */
/*  Section 2 Data: Post Leaderboard                                          */
/* -------------------------------------------------------------------------- */

interface LeaderboardPost {
  id: string;
  platform: PlatformId;
  title: string;
  format: string;
  views: string;
  er: string;
  bookmarks: string;
  tag: string;
  reasons: string[];
}

const LEADERBOARD_POSTS: LeaderboardPost[] = [
  {
    id: "p1",
    platform: "linkedin",
    title: "Why 90% of content calendars fail (and how we fixed ours)",
    format: "PDF Carousel · 9 slides",
    views: "52.4K",
    er: "6.8%",
    bookmarks: "480",
    tag: "Viral Hit · 3.8x",
    reasons: [
      "Slide 2 retention reached 89% (well above 62% benchmark)",
      "High bookmark density: 1 save per 109 views",
      "Drove 14 direct profile website inquiries",
    ],
  },
  {
    id: "p2",
    platform: "x",
    title: "The technical breakdown of our async queue worker",
    format: "Thread · 7 tweets",
    views: "64.2K",
    er: "5.2%",
    bookmarks: "890",
    tag: "High Velocity · 2.9x",
    reasons: [
      "Quoted by 3 industry founders with >50k followers",
      "Fastest 1st-hour velocity in the last 60 days",
      "68% read-through to the final callout tweet",
    ],
  },
  {
    id: "p3",
    platform: "threads",
    title: "3 quiet habits that doubled our inbound pipeline this quarter",
    format: "Discussion Hook",
    views: "28.6K",
    er: "7.6%",
    bookmarks: "240",
    tag: "Top Resonance",
    reasons: [
      "Reply rate was 4.2x higher than your account baseline",
      "Discussion ran for 36 hours continuously",
      "Attracted 180 new niche followers",
    ],
  },
];

/* -------------------------------------------------------------------------- */
/*  Section 3 Data: Golden Hours Timing                                       */
/* -------------------------------------------------------------------------- */

const TIMING_DATA: Record<
  PlatformId,
  {
    bestDay: string;
    bestHour: string;
    lift: string;
    audienceMatch: string;
    bars: number[];
  }
> = {
  linkedin: {
    bestDay: "Wednesdays",
    bestHour: "10:15 AM EST",
    lift: "2.8x reach boost",
    audienceMatch: "99% active match",
    bars: [20, 60, 100, 85, 55, 35, 25, 15],
  },
  x: {
    bestDay: "Tuesdays",
    bestHour: "08:45 AM EST",
    lift: "3.4x velocity boost",
    audienceMatch: "96% active match",
    bars: [45, 95, 80, 60, 45, 70, 90, 50],
  },
  threads: {
    bestDay: "Thursdays",
    bestHour: "06:30 PM EST",
    lift: "4.1x comment lift",
    audienceMatch: "94% active match",
    bars: [15, 30, 45, 60, 80, 100, 90, 65],
  },
};

const TIMING_HOURS = ["6a", "8a", "10a", "12p", "2p", "4p", "6p", "8p"];

/* -------------------------------------------------------------------------- */
/*  Main Showcase Component                                                   */
/* -------------------------------------------------------------------------- */

export default function AnalyticsShowcase() {
  // Section 1: Active Benchmark Channel
  const [activeBenchmark, setActiveBenchmark] = useState<ChannelId>("all");
  const benchmark = BENCHMARK_DATA[activeBenchmark];

  // Section 2: Active Leaderboard Post Inspection
  const [selectedPost, setSelectedPost] = useState<string>("p1");
  const inspectedPost =
    LEADERBOARD_POSTS.find((p) => p.id === selectedPost) ?? LEADERBOARD_POSTS[0];

  // Section 3: Active Timing Channel & Locked State
  const [timingPlatform, setTimingPlatform] = useState<PlatformId>("linkedin");
  const [slotLocked, setSlotLocked] = useState(false);
  const timing = TIMING_DATA[timingPlatform];

  // Section 4: Brand vs Founder Switcher
  const [workspace, setWorkspace] = useState<"founder" | "brand" | "portfolio">(
    "portfolio",
  );

  return (
    <div className="mx-auto w-full max-w-7xl space-y-20 py-8 lg:space-y-32 lg:py-16">
      {/* ===================================================================
          SECTION 1: Cross-Platform Performance & Benchmark
      =================================================================== */}
      <section className="grid grid-cols-1 items-center gap-10 lg:grid-cols-12 lg:gap-16">
        <div className="lg:col-span-5">
          <Copy
            badge={<SectionBadge icon={BarChart3}>Cross-Platform Benchmarks</SectionBadge>}
            title="See which platform actually builds your pipeline."
            body="A million vanity views on one network might bring zero qualified leads, while a 2,000-view carousel on LinkedIn drives three customer contracts. Draftva unifies your social metrics into a clean, normalized command center with real conversion insight."
            points={[
              "Direct official API connections to X, LinkedIn, Threads, Instagram & Facebook",
              "Normalized engagement rates so you compare threads and carousels fairly",
              "Filter by 7-day sprints, monthly retrospectives, or quarterly growth cohorts",
            ]}
          />
        </div>

        <div className="min-w-0 lg:col-span-7">
          <Window>
            <WindowChrome
              url="app.draftva.com/analytics/benchmarks"
              right={
                <span className="font-subheading shrink-0 rounded-md border border-[#3fda8a]/30 bg-[#3fda8a]/15 px-2 py-0.5 text-[11px] font-semibold text-[#0f7a47]">
                  Live Telemetry
                </span>
              }
            />

            <div className="p-3 sm:p-5">
              {/* Channel Tabs */}
              <div
                role="tablist"
                aria-label="Platform"
                className="-mx-1 flex gap-2 overflow-x-auto px-1 py-1 pb-1 [scrollbar-width:none] sm:flex-wrap sm:overflow-visible"
              >
                {(
                  [
                    { id: "all", label: "All Networks" },
                    { id: "linkedin", label: "LinkedIn" },
                    { id: "x", label: "X" },
                    { id: "threads", label: "Threads" },
                    { id: "facebook", label: "Facebook" },
                  ] as const
                ).map((tab) => {
                  const active = activeBenchmark === tab.id;
                  return (
                    <button
                      key={tab.id}
                      role="tab"
                      aria-selected={active}
                      style={{ minHeight: "28px" }}
                      type="button"
                      onClick={() => setActiveBenchmark(tab.id)}
                      className={cn(
                        active ? "primary-btn" : "secondary-btn",
                        "font-subheading shrink-0 whitespace-nowrap rounded-lg px-3.5 py-1.5 text-xs font-medium transition-all",
                      )}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              {/* Benchmark Summary Container */}
              <div className="mt-5 rounded-2xl border border-black/[0.06] bg-[#faf9f5] p-4 sm:mt-6 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <span className="font-subheading text-xs text-[#85887e]">
                      Verified reach · {benchmark.name}
                    </span>
                    <p className="font-heading mt-1 text-2xl font-bold tracking-tight text-[#11120e] sm:text-3xl">
                      {benchmark.impressions}{" "}
                      <span className="font-subheading text-xs font-semibold text-[#0f7a47]">
                        {benchmark.growth}
                      </span>
                    </p>
                  </div>
                  <span className="font-subheading inline-flex items-center gap-1.5 rounded-full border border-[#3fda8a]/40 bg-[#3fda8a]/20 px-3 py-1 text-xs font-semibold text-[#0f7a47]">
                    <TrendingUp className="size-3.5" />
                    Eng. Rate {benchmark.er}
                  </span>
                </div>

                {/* Daily Impressions Bar Chart */}
                <div className="mt-5 rounded-xl border border-black/[0.04] bg-white px-3 pb-2 pt-4 sm:px-4">
                  <div className="flex h-28 items-end gap-2 sm:gap-2.5">
                    {benchmark.bars.map((val, i) => (
                      <div
                        key={i}
                        title={`${BAR_DAYS[i]} · ${val}% of peak`}
                        style={{ height: `${val}%` }}
                        className={cn(
                          "flex-1 rounded-t-md transition-all duration-300",
                          val >= 90 ? "bg-[#3fda8a]" : "bg-[#3fda8a]/25",
                        )}
                      />
                    ))}
                  </div>
                  <div className="mt-2 flex gap-2 sm:gap-2.5">
                    {BAR_DAYS.map((l) => (
                      <span
                        key={l}
                        className="font-subheading flex-1 text-center text-[10px] tabular-nums text-[#85887e]"
                      >
                        {l}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Footer Metrics */}
                <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-black/[0.06] pt-4">
                  <span className="font-subheading text-xs text-[#6d7066]">
                    Top Converting Format:{" "}
                    <strong className="text-[#11120e]">{benchmark.topFormat}</strong>
                  </span>
                  <span className="font-subheading inline-flex items-center gap-1 text-xs font-medium text-[#0f7a47]">
                    <Repeat className="size-3.5" />
                    Clicks: {benchmark.clicks}
                  </span>
                </div>
              </div>
            </div>
          </Window>
        </div>
      </section>

      {/* ===================================================================
          SECTION 2: Breakout Post Leaderboard & Hook Inspector
      =================================================================== */}
      <section className="grid grid-cols-1 items-center gap-10 lg:grid-cols-12 lg:gap-16">
        <div className="order-2 min-w-0 lg:order-1 lg:col-span-7">
          <Window>
            <WindowChrome
              url="app.draftva.com/analytics/leaderboard"
              right={
                <span className="font-subheading shrink-0 text-xs text-[#6d7066]">
                  Top 1% Velocity
                </span>
              }
            />

            <div className="space-y-3 p-4 sm:p-6">
              {LEADERBOARD_POSTS.map((post) => {
                const isSelected = post.id === selectedPost;
                return (
                  <div
                    key={post.id}
                    onClick={() => setSelectedPost(post.id)}
                    className={cn(
                      "cursor-pointer rounded-2xl border p-4 transition-all",
                      isSelected
                        ? "border-[#3fda8a] bg-[#3fda8a]/[0.08] shadow-xs"
                        : "border-black/[0.06] bg-[#faf9f5] hover:border-black/15",
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-3">
                        <PlatformBadge platform={post.platform} className="mt-0.5 size-5" />
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span className="font-heading text-sm font-semibold text-[#11120e]">
                              {post.title}
                            </span>
                          </div>
                          <p className="mt-0.5 text-xs text-[#6d7066]">
                            {post.format} · {post.views} views · ER {post.er}
                          </p>
                        </div>
                      </div>

                      <span className="font-subheading shrink-0 rounded-full border border-[#3fda8a]/40 bg-[#3fda8a]/20 px-2 py-0.5 text-[10px] font-semibold text-[#0f7a47]">
                        {post.tag}
                      </span>
                    </div>

                    {/* Expandable Reasons on Selected */}
                    {isSelected && (
                      <div className="mt-3.5 border-t border-black/[0.06] pt-3">
                        <span className="font-subheading block text-[10px] uppercase tracking-wider text-[#85887e]">
                          Why this post resonated:
                        </span>
                        <ul className="mt-1.5 space-y-1">
                          {post.reasons.map((r) => (
                            <li
                              key={r}
                              className="flex items-center gap-2 text-xs text-[#11120e]"
                            >
                              <span className="size-1.5 rounded-full bg-[#0f7a47]" />
                              <span>{r}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                );
              })}

              <div className="flex items-center justify-between pt-2">
                <span className="font-subheading text-xs text-[#85887e]">
                  Click any post above to inspect why it won
                </span>
                <span className="font-subheading inline-flex items-center gap-1 text-xs font-semibold text-[#0f7a47]">
                  <Sparkles className="size-3.5" />
                  Auto-Extracted Templates
                </span>
              </div>
            </div>
          </Window>
        </div>

        <div className="order-1 lg:order-2 lg:col-span-5">
          <Copy
            badge={<SectionBadge icon={TrendingUp}>Content Performance Matrix</SectionBadge>}
            title="Unpack why your winners won and turn them into templates."
            body="When a post takes off, Draftva dissects the anatomy of that hit. See whether the hook drove initial retention, which slide readers spent the most time on, and turn high-performing structures into repeatable templates for next week."
            points={[
              "Post leaderboard ranked by true engagement rate, views, or bookmarks",
              "Side-by-side hook analysis to identify recurring high-conversion angles",
              "One-click repurpose: adapt a winning LinkedIn carousel into an X thread",
            ]}
          />
        </div>
      </section>

      {/* ===================================================================
          SECTION 3: Audience Activity & Golden Window Correlation
      =================================================================== */}
      <section className="grid grid-cols-1 items-center gap-10 lg:grid-cols-12 lg:gap-16">
        <div className="lg:col-span-5">
          <Copy
            badge={<SectionBadge icon={Clock}>Audience Timing Intelligence</SectionBadge>}
            title="Stop posting into empty feeds. Align with your golden hours."
            body="Social algorithms heavily penalize posts that sit stagnant in their first 30 minutes. Draftva matches your actual historical engagement velocity with real-time audience activity to pinpoint the highest-converting moments to publish on each network."
            points={[
              "Hourly audience activity matrix tailored to your exact follower demographics",
              "Separate reading peaks from high-intent commenting and sharing windows",
              "Automatic one-click sync into your Draftva scheduling queue slots",
            ]}
          />
        </div>

        <div className="min-w-0 lg:col-span-7">
          <Window>
            <WindowChrome
              url="app.draftva.com/analytics/golden-hours"
              right={
                <span className="font-subheading shrink-0 text-xs text-[#6d7066]">
                  Peak Dispatch Windows
                </span>
              }
            />

            <div className="p-4 sm:p-6">
              {/* Channel Selector */}
              <div className="flex items-center gap-2">
                {(
                  [
                    { id: "linkedin", label: "LinkedIn Peak" },
                    { id: "x", label: "X (Twitter) Peak" },
                    { id: "threads", label: "Threads Peak" },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      setTimingPlatform(tab.id);
                      setSlotLocked(false);
                    }}
                    className={cn(
                      timingPlatform === tab.id ? "primary-btn" : "secondary-btn",
                      "font-subheading rounded-lg px-3 py-1.5 text-xs font-medium transition-all",
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Timing Heatmap Box */}
              <div className="mt-5 rounded-2xl border border-black/[0.06] bg-[#faf9f5] p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <span className="font-subheading text-xs text-[#85887e]">
                      Optimal window · {timing.bestDay}
                    </span>
                    <h4 className="font-heading mt-1 text-xl font-bold text-[#11120e]">
                      {timing.bestHour}
                    </h4>
                  </div>
                  <span className="font-subheading rounded-full border border-[#3fda8a]/40 bg-[#3fda8a]/20 px-3 py-1 text-xs font-semibold text-[#0f7a47]">
                    {timing.lift}
                  </span>
                </div>

                {/* Activity Density Bars */}
                <div className="mt-5 rounded-xl border border-black/[0.04] bg-white px-3 pb-2 pt-4 sm:px-4">
                  <div className="flex h-24 items-end gap-2 sm:gap-2.5">
                    {timing.bars.map((val, i) => (
                      <div
                        key={i}
                        title={`${TIMING_HOURS[i]} · ${val}% follower density`}
                        style={{ height: `${val}%` }}
                        className={cn(
                          "flex-1 rounded-t-md transition-all duration-300",
                          val >= 90 ? "bg-[#3fda8a]" : "bg-[#3fda8a]/25",
                        )}
                      />
                    ))}
                  </div>
                  <div className="mt-2 flex gap-2 sm:gap-2.5">
                    {TIMING_HOURS.map((h) => (
                      <span
                        key={h}
                        className="font-subheading flex-1 text-center text-[10px] tabular-nums text-[#85887e]"
                      >
                        {h}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Queue Lock Confirmation Banner */}
                <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-black/[0.06] pt-4">
                  <span className="font-subheading text-xs text-[#6d7066]">
                    Audience status:{" "}
                    <strong className="text-[#11120e]">{timing.audienceMatch}</strong>
                  </span>
                  <button
                    type="button"
                    onClick={() => setSlotLocked(!slotLocked)}
                    className={cn(
                      slotLocked ? "secondary-btn" : "primary-btn",
                      "font-subheading rounded-lg px-3.5 py-1.5 text-xs font-medium transition-all",
                    )}
                  >
                    {slotLocked ? (
                      <span className="flex items-center gap-1.5 text-[#0f7a47]">
                        <Check className="size-3.5" />
                        Slot Locked in Queue
                      </span>
                    ) : (
                      "Lock into Schedule Queue"
                    )}
                  </button>
                </div>
              </div>
            </div>
          </Window>
        </div>
      </section>

      {/* ===================================================================
          SECTION 4: Brand vs. Founder Portfolio Analytics
      =================================================================== */}
      <section className="grid grid-cols-1 items-center gap-10 lg:grid-cols-12 lg:gap-16">
        <div className="order-2 min-w-0 lg:order-1 lg:col-span-5">
          <Window>
            <WindowChrome
              url="app.draftva.com/analytics/portfolio"
              right={
                <span className="font-subheading shrink-0 text-xs text-[#6d7066]">
                  Portfolio Synergy
                </span>
              }
            />

            <div className="p-4 sm:p-6">
              <span className="font-subheading text-xs font-semibold text-[#85887e]">
                Workspace Identity Filter
              </span>

              <div className="mt-2.5 grid grid-cols-3 gap-2">
                {(
                  [
                    { id: "founder", label: "Founder (@alex)" },
                    { id: "brand", label: "Brand (Draftva)" },
                    { id: "portfolio", label: "Combined" },
                  ] as const
                ).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setWorkspace(item.id)}
                    className={cn(
                      workspace === item.id ? "primary-btn" : "secondary-btn",
                      "font-subheading rounded-lg px-2 py-2 text-center text-xs font-medium transition-all truncate",
                    )}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              {/* Dynamic Identity Stats Box */}
              <div className="mt-5 rounded-2xl border border-black/[0.06] bg-[#faf9f5] p-4 sm:p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="font-heading flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#3fda8a]/25 text-sm font-bold text-[#0f7a47]">
                      {workspace === "founder"
                        ? "AX"
                        : workspace === "brand"
                          ? "DV"
                          : "ALL"}
                    </div>
                    <div>
                      <h4 className="font-heading text-sm font-semibold text-[#11120e]">
                        {workspace === "founder"
                          ? "Alex Rivera (Founder)"
                          : workspace === "brand"
                            ? "Draftva Official Page"
                            : "Draftva Combined Ecosystem"}
                      </h4>
                      <span className="font-subheading block text-xs text-[#6d7066]">
                        {workspace === "founder"
                          ? "22,400 followers · Personal accounts"
                          : workspace === "brand"
                            ? "46,800 followers · Company pages"
                            : "69,200 unified audience reach"}
                      </span>
                    </div>
                  </div>
                  <span className="font-subheading rounded-full border border-[#3fda8a]/40 bg-[#3fda8a]/20 px-2 py-0.5 text-[10px] font-semibold text-[#0f7a47]">
                    +38% Growth
                  </span>
                </div>

                {/* Synergy Insight Box */}
                <div className="mt-4 rounded-xl border border-black/[0.05] bg-white p-3.5">
                  <span className="font-subheading block text-[10px] uppercase tracking-wider text-[#85887e]">
                    Attribution Insight:
                  </span>
                  <p className="mt-1 text-xs leading-relaxed text-[#11120e]">
                    {workspace === "founder"
                      ? "Founder stories drive 3.6x more profile clicks and convert into newsletter subscribers at 8.2%."
                      : workspace === "brand"
                        ? "Company announcements convert best when reposted with founder commentary within 15 minutes."
                        : "42% of company page followers originally discovered Draftva through Alex’s personal tech teardowns."}
                  </p>
                </div>

                {/* Conversion Mini Progress Bars */}
                <div className="mt-4 grid grid-cols-3 gap-2 border-t border-black/[0.06] pt-3 text-center">
                  <div>
                    <span className="font-subheading text-[10px] text-[#85887e]">
                      Reach Lift
                    </span>
                    <span className="font-heading block text-sm font-semibold text-[#11120e]">
                      +34.2%
                    </span>
                  </div>
                  <div>
                    <span className="font-subheading text-[10px] text-[#85887e]">
                      Halo Rate
                    </span>
                    <span className="font-heading block text-sm font-semibold text-[#0f7a47]">
                      42%
                    </span>
                  </div>
                  <div>
                    <span className="font-subheading text-[10px] text-[#85887e]">
                      Inbound Leads
                    </span>
                    <span className="font-heading block text-sm font-semibold text-[#11120e]">
                      128
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </Window>
        </div>

        <div className="order-1 lg:order-2 lg:col-span-7">
          <Copy
            badge={<SectionBadge icon={Users}>Brand & Founder Synergy</SectionBadge>}
            title="Track executive personal brands and company handles side by side."
            body="Modern growth happens at the intersection of founder credibility and brand authority. Draftva lets you measure both in one workspace, understand the halo effect of personal posts on company pipeline, and report clear ROI to stakeholders."
            points={[
              "Side-by-side growth analytics for founders, team members, and company pages",
              "Measure direct referral traffic and follower overlap between personal and corporate accounts",
              "Export polished weekly PDF summaries and stakeholder reports in one click",
            ]}
          />
        </div>
      </section>
    </div>
  );
}
