"use client";

import React, { useMemo, useState } from "react";
import {
  Clock,
  Check,
  Repeat,
  Calendar as CalendarIcon,
  Building2,
  User,
  TrendingUp,
  Globe,
  Sparkles,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PlatformBadge } from "./PlatformBadge";

/* -------------------------------------------------------------------------- */
/*  Data                                                                       */
/* -------------------------------------------------------------------------- */

type ChannelId = "x" | "linkedin" | "threads" | "facebook";

const CHANNEL_METRICS: Record<
  ChannelId,
  {
    name: string;
    handle: string;
    peakWindow: string;
    boost: string;
    bars: number[];
    format: string;
  }
> = {
  x: {
    name: "X (Twitter)",
    handle: "@draftva",
    peakWindow: "Tue · 08:45 AM EST",
    boost: "3.2x thread velocity",
    bars: [35, 50, 95, 75, 45, 60, 85, 40],
    format: "Multi-tweet Thread",
  },
  linkedin: {
    name: "LinkedIn",
    handle: "Draftva HQ",
    peakWindow: "Wed · 10:15 AM EST",
    boost: "2.8x carousel reach",
    bars: [25, 80, 100, 70, 50, 30, 20, 15],
    format: "PDF Carousel",
  },
  threads: {
    name: "Threads",
    handle: "@draftva.app",
    peakWindow: "Thu · 06:30 PM EST",
    boost: "4.1x reply rate",
    bars: [20, 35, 45, 60, 85, 100, 90, 55],
    format: "Conversational Hook",
  },
  facebook: {
    name: "Facebook",
    handle: "Draftva",
    peakWindow: "Fri · 01:20 PM EST",
    boost: "2.4x share lift",
    bars: [40, 55, 70, 95, 80, 60, 45, 30],
    format: "Visual Post + Link",
  },
};

const BAR_LABELS = ["6a", "8a", "10a", "12p", "2p", "4p", "6p", "8p"];

type PlatformId = "x" | "linkedin" | "threads";

interface CalendarPost {
  day: number; // 0 = Mon … 6 = Sun
  time: number; // 24h decimal, e.g. 10.25 = 10:15
  platform: PlatformId;
  title: string;
}

const PLATFORM_LABEL: Record<PlatformId, string> = {
  x: "X",
  linkedin: "LinkedIn",
  threads: "Threads",
};

// Two weeks of mock data so the arrows actually do something.
const WEEKS: CalendarPost[][] = [
  [
    {
      day: 0,
      time: 9,
      platform: "linkedin",
      title: "Consistency beats viral reach",
    },
    { day: 1, time: 10.25, platform: "x", title: "3 lessons from shipping v2" },
    {
      day: 2,
      time: 9.5,
      platform: "linkedin",
      title: "The backend stack breakdown",
    },
    { day: 2, time: 12.5, platform: "x", title: "Async founder stack" },
    {
      day: 3,
      time: 11,
      platform: "x",
      title: "Posting daily: metrics unpacked",
    },
    {
      day: 4,
      time: 10,
      platform: "linkedin",
      title: "Weekly founder reading list",
    },
    { day: 4, time: 13, platform: "threads", title: "Weekly growth recap" },
  ],
  [
    { day: 0, time: 11, platform: "linkedin", title: "Q4 pipeline teardown" },
    { day: 1, time: 9, platform: "x", title: "Zero-click content" },
    { day: 2, time: 13, platform: "x", title: "Auto-Plug Engine is live" },
    {
      day: 3,
      time: 10.5,
      platform: "threads",
      title: "The cold start problem",
    },
    { day: 4, time: 9.5, platform: "x", title: "Open API beta is live" },
  ],
];

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const FIRST_MONDAY = Date.UTC(2026, 9, 12); // Mon 12 Oct 2026
const TODAY_WEEK = 0;
const TODAY_DAY = 4; // Fri 16 Oct

const HOURS = [9, 10, 11, 12, 13, 14];
const ROW_H = 56;

const CALENDAR_FILTERS: { id: "all" | PlatformId; label: string }[] = [
  { id: "all", label: "All" },
  { id: "linkedin", label: "LinkedIn" },
  { id: "x", label: "X" },
  { id: "threads", label: "Threads" },
];

/* -------------------------------------------------------------------------- */
/*  Small helpers / shared pieces                                              */
/* -------------------------------------------------------------------------- */

function formatTime(t: number) {
  const h = Math.floor(t);
  const m = Math.round((t - h) * 60);
  const suffix = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m.toString().padStart(2, "0")} ${suffix}`;
}

function formatHour(h: number) {
  const suffix = h >= 12 ? "PM" : "AM";
  return `${h % 12 === 0 ? 12 : h % 12} ${suffix}`;
}

function dateFor(week: number, day: number) {
  return new Date(FIRST_MONDAY + (week * 7 + day) * 86_400_000);
}

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
            <span className="text-sm leading-relaxed text-[#11120e]">
              {point}
            </span>
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
/*  Main                                                                       */
/* -------------------------------------------------------------------------- */

export default function MultiChannelScheduleShowcase() {
  // Section 1
  const [activeChannel, setActiveChannel] = useState<ChannelId>("x");
  const currentMetric = CHANNEL_METRICS[activeChannel];

  // Section 2
  const [fridayFilled, setFridayFilled] = useState(false);

  // Section 3
  const [filter, setFilter] = useState<"all" | PlatformId>("all");
  const [week, setWeek] = useState(TODAY_WEEK);

  // Section 4
  const [workspace, setWorkspace] = useState<"founder" | "brand">("brand");

  const visiblePosts = useMemo(
    () => WEEKS[week].filter((p) => filter === "all" || p.platform === filter),
    [week, filter],
  );

  const weekLabel = useMemo(() => {
    const fmt = (d: Date, withMonth: boolean) =>
      d.toLocaleDateString("en-GB", {
        day: "numeric",
        month: withMonth ? "short" : undefined,
        timeZone: "UTC",
      });
    return `${fmt(dateFor(week, 0), false)} – ${fmt(dateFor(week, 6), true)} 2026`;
  }, [week]);

  const isPast = (day: number) =>
    week < TODAY_WEEK || (week === TODAY_WEEK && day < TODAY_DAY);
  const isToday = (day: number) => week === TODAY_WEEK && day === TODAY_DAY;

  return (
    <div className="mx-auto w-full max-w-7xl space-y-20  py-8  lg:space-y-32  lg:py-16">
      {/* ===================================================================
          SECTION 1: Best-time scheduling
      =================================================================== */}
      <section className="grid grid-cols-1 items-center gap-10 lg:grid-cols-12 lg:gap-16">
        <div className="lg:col-span-5">
          <Copy
            badge={
              <SectionBadge icon={Clock}>Cross-Platform Timing</SectionBadge>
            }
            title="Post when each platform’s audience is actually watching."
            body="Your X followers scroll at breakfast, LinkedIn peaks mid-morning, and Threads heats up at night. Draftva analyzes activity across every connected network and staggers your post for each algorithm’s prime window."
            points={[
              "Per-network best-time slots tuned to X, LinkedIn, Threads & Facebook",
              "One-click stagger: publish now on X, queue for peak hour on LinkedIn",
              "Time-zone aware delivery so you hit global audiences while you sleep",
            ]}
          />
        </div>

        <div className="min-w-0 lg:col-span-7">
          <Window>
            <WindowChrome
              url="app.draftva.com/best-time"
              right={
                <span className="font-subheading shrink-0 rounded-md border border-[#3fda8a]/30 bg-[#3fda8a]/15 px-2 py-0.5 text-[11px] font-semibold text-[#0f7a47]">
                  Live Telemetry
                </span>
              }
            />

            <div className="p-2 sm:p-4">
              <div
                role="tablist"
                aria-label="Platform"
                className="-mx-1 flex gap-2 overflow-x-auto px-1 py-1 pb-1 [scrollbar-width:none] sm:flex-wrap sm:overflow-visible"
              >
                {(Object.keys(CHANNEL_METRICS) as ChannelId[]).map((id) => {
                  const active = activeChannel === id;
                  return (
                    <button
                      key={id}
                      role="tab"
                      aria-selected={active}
                      style={{ minHeight: "28px" }}
                      type="button"
                      onClick={() => setActiveChannel(id)}
                      className={cn(
                        active ? "primary-btn" : "secondary-btn",
                        "font-subheading shrink-0 whitespace-nowrap rounded-lg px-3.5 py-2 text-xs font-medium transition-all",
                      )}
                    >
                      {CHANNEL_METRICS[id].name}
                    </button>
                  );
                })}
              </div>

              <div className="mt-5 rounded-2xl border border-black/[0.06] bg-[#faf9f5] p-4 sm:mt-6 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <span className="font-subheading text-xs text-[#85887e]">
                      Audience activity · {currentMetric.handle}
                    </span>
                    <p className="font-heading mt-1 text-lg font-semibold text-[#11120e]">
                      {currentMetric.peakWindow}
                    </p>
                  </div>
                  <span className="font-subheading inline-flex items-center gap-1.5 rounded-full border border-[#3fda8a]/40 bg-[#3fda8a]/20 px-3 py-1 text-xs font-semibold text-[#0f7a47]">
                    <TrendingUp className="size-3.5" />
                    {currentMetric.boost}
                  </span>
                </div>

                <div className="mt-5 rounded-xl border border-black/[0.04] bg-white px-3 pb-2 pt-4 sm:px-4">
                  <div className="flex h-28 items-end gap-2 sm:gap-2.5">
                    {currentMetric.bars.map((val, i) => (
                      <div
                        key={i}
                        title={`${BAR_LABELS[i]} · ${val}% activity`}
                        style={{ height: `${val}%` }}
                        className={cn(
                          "flex-1 rounded-t-md transition-all duration-300",
                          val >= 90 ? "bg-[#3fda8a]" : "bg-[#3fda8a]/25",
                        )}
                      />
                    ))}
                  </div>
                  <div className="mt-2 flex gap-2 sm:gap-2.5">
                    {BAR_LABELS.map((l) => (
                      <span
                        key={l}
                        className="font-subheading flex-1 text-center text-[10px] tabular-nums text-[#85887e]"
                      >
                        {l}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-black/[0.06] pt-4">
                  <span className="font-subheading text-xs text-[#6d7066]">
                    Recommended format:{" "}
                    <strong className="text-[#11120e]">
                      {currentMetric.format}
                    </strong>
                  </span>
                  <span className="font-subheading inline-flex items-center gap-1 text-xs font-medium text-[#0f7a47]">
                    <Repeat className="size-3.5" />
                    Auto-adapted for 4 channels
                  </span>
                </div>
              </div>
            </div>
          </Window>
        </div>
      </section>

      {/* ===================================================================
          SECTION 2: Evergreen queue
      =================================================================== */}
      <section className="grid grid-cols-1 items-center gap-10 lg:grid-cols-12 lg:gap-16">
        <div className="order-2 min-w-0 lg:order-1 lg:col-span-7">
          <Window>
            <WindowChrome
              url="app.draftva.com/queue"
              right={
                <span className="font-subheading shrink-0 text-xs text-[#6d7066]">
                  Auto-Recycle Active
                </span>
              }
            />

            <div className="space-y-3 p-4 sm:p-8">
              {/* Item 1 */}
              <div className="flex items-center justify-between gap-3 rounded-2xl border border-black/[0.06] bg-[#faf9f5] p-3.5 sm:p-4">
                <div className="flex min-w-0 items-center gap-3.5">
                  <div className="font-subheading flex size-9 shrink-0 items-center justify-center rounded-xl border border-black/[0.06] bg-white text-xs font-bold text-[#0f7a47] shadow-2xs">
                    X
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="font-heading text-sm font-semibold text-[#11120e]">
                        Mon 8:12 AM
                      </span>
                      <span className="font-subheading rounded bg-[#3fda8a]/20 px-2 py-0.5 text-[10px] font-semibold text-[#0f7a47]">
                        X + Threads
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-[#6d7066]">
                      The engineering mistake that cost us 3 weeks of
                      velocity...
                    </p>
                  </div>
                </div>
                <span className="font-subheading hidden shrink-0 text-xs text-[#85887e] sm:inline">
                  Scheduled
                </span>
              </div>

              {/* Item 2 */}
              <div className="flex items-center justify-between gap-3 rounded-2xl border border-black/[0.06] bg-[#faf9f5] p-3.5 sm:p-4">
                <div className="flex min-w-0 items-center gap-3.5">
                  <div className="font-subheading flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#3fda8a]/20 text-xs font-bold text-[#0f7a47]">
                    in
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="font-heading text-sm font-semibold text-[#11120e]">
                        Wed 12:40 PM
                      </span>
                      <span className="font-subheading rounded border border-black/[0.06] bg-white px-2 py-0.5 text-[10px] font-medium text-[#6d7066]">
                        LinkedIn Carousel · 8 slides
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-[#6d7066]">
                      3 distribution hooks that doubled our inbound pipeline...
                    </p>
                  </div>
                </div>
                <span className="font-subheading hidden shrink-0 text-xs text-[#85887e] sm:inline">
                  Scheduled
                </span>
              </div>

              {/* Interactive slot */}
              <div
                className={cn(
                  "flex flex-col gap-3 rounded-2xl border p-3.5 transition-all sm:flex-row sm:items-center sm:justify-between sm:p-4",
                  fridayFilled
                    ? "border-[#3fda8a] bg-[#3fda8a]/10"
                    : "border-dashed border-neutral-300 bg-white",
                )}
              >
                <div className="flex min-w-0 items-center gap-3.5">
                  <div
                    className={cn(
                      "flex size-9 shrink-0 items-center justify-center rounded-lg",
                      fridayFilled
                        ? "bg-[#3fda8a] text-[#11120e]"
                        : "border border-black/[0.05] bg-[#faf9f5] text-[#85887e]",
                    )}
                  >
                    <Repeat className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <span className="font-heading text-sm font-semibold text-[#11120e]">
                      {fridayFilled
                        ? "Fri 9:30 AM · Auto-filled from Evergreen"
                        : "Fri · Empty cross-channel slot"}
                    </span>
                    <p className="mt-0.5 text-xs leading-relaxed text-[#6d7066]">
                      {fridayFilled
                        ? "Top X thread recycled and reformatted for Threads & LinkedIn"
                        : "Fill it with your top-performing evergreen post"}
                    </p>
                  </div>
                </div>

                <button
                  style={{ minHeight: "28px" }}
                  type="button"
                  onClick={() => setFridayFilled(!fridayFilled)}
                  className={cn(
                    fridayFilled ? "secondary-btn" : "primary-btn",
                    "font-subheading shrink-0 max-w-30 rounded-lg px-3.5 py-2 text-xs font-medium",
                  )}
                >
                  {fridayFilled ? "Undo" : "Auto-fill slot"}
                </button>
              </div>
            </div>
          </Window>
        </div>

        <div className="order-1 lg:order-2 lg:col-span-5">
          <Copy
            badge={
              <SectionBadge icon={Repeat}>Evergreen Queue Engine</SectionBadge>
            }
            title="Never miss a day, even when launches get crazy."
            body="When your queue runs low, Draftva nudges you and automatically recycles your highest-performing X threads into LinkedIn posts or Threads updates. Your reach keeps compounding while you stay heads-down."
            points={[
              "Visual multi-channel queue you can drag, reorder, and refill in seconds",
              "Cross-recycle top winners from X straight onto LinkedIn & Threads",
              "Schedule threads, carousels, short video, and rich media from one place",
            ]}
          />
        </div>
      </section>

      {/* ===================================================================
          SECTION 3: Calendar
      =================================================================== */}
      <section className="grid grid-cols-1 items-center gap-10 lg:grid-cols-12 lg:gap-16">
        <div className="lg:col-span-5">
          <Copy
            badge={
              <SectionBadge icon={CalendarIcon}>
                Unified Command Calendar
              </SectionBadge>
            }
            title="Plan a full month across every network in one afternoon."
            body="See your entire multi-channel content calendar at a glance, filter drafts by network, and batch-fill weeks ahead. Draftva turns chaotic daily posting into a calm, repeatable operating system."
            points={[
              "Bird’s-eye calendar covering every social channel at once",
              "Filter by network so you can balance threads, carousels & launches",
              "Batch-schedule weeks ahead and never scramble for a post again",
            ]}
          />
        </div>

        <div className="min-w-0 lg:col-span-7">
          <Window>
            {/* Toolbar */}
            <div className="flex flex-col gap-3 border-b border-black/[0.06] bg-[#faf9f5] px-4 py-3.5 sm:px-6 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setWeek(TODAY_WEEK)}
                  className="rounded-md border border-black/10 bg-white px-2.5 py-1 text-xs font-medium text-[#11120e] shadow-2xs transition-colors hover:bg-[#faf9f5]"
                >
                  Today
                </button>
                <div className="flex items-center text-[#6b737d]">
                  <button
                    type="button"
                    aria-label="Previous week"
                    disabled={week === 0}
                    onClick={() => setWeek((w) => Math.max(0, w - 1))}
                    className="rounded-md p-1.5 transition-colors hover:bg-black/5 hover:text-[#11120e] disabled:opacity-30 disabled:hover:bg-transparent"
                  >
                    <ChevronLeft className="size-4" />
                  </button>
                  <button
                    type="button"
                    aria-label="Next week"
                    disabled={week === WEEKS.length - 1}
                    onClick={() =>
                      setWeek((w) => Math.min(WEEKS.length - 1, w + 1))
                    }
                    className="rounded-md p-1.5 transition-colors hover:bg-black/5 hover:text-[#11120e] disabled:opacity-30 disabled:hover:bg-transparent"
                  >
                    <ChevronRight className="size-4" />
                  </button>
                </div>
                <span className="font-heading text-xs font-semibold tabular-nums text-[#11120e] sm:text-sm">
                  {weekLabel}
                </span>
              </div>

              <div
                role="group"
                aria-label="Filter by network"
                className="-mx-1 flex items-center gap-1.5 overflow-x-auto px-1 [scrollbar-width:none]"
              >
                {CALENDAR_FILTERS.map((f) => (
                  <button
                    key={f.id}
                    style={{ minHeight: "28px" }}
                    type="button"
                    aria-pressed={filter === f.id}
                    onClick={() => setFilter(f.id)}
                    className={cn(
                      filter === f.id ? "primary-btn" : "secondary-btn",
                      "font-subheading shrink-0 whitespace-nowrap rounded-lg px-2.5 py-1 text-xs font-medium",
                    )}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* ---------- Mobile: agenda list ---------- */}
            <div className="sm:hidden">
              <ul className="divide-y divide-black/[0.06]">
                {DAY_NAMES.map((name, day) => {
                  const posts = visiblePosts
                    .filter((p) => p.day === day)
                    .sort((a, b) => a.time - b.time);
                  const date = dateFor(week, day);
                  return (
                    <li key={name} className="flex gap-4 px-4 py-3.5">
                      <div className="flex w-10 shrink-0 flex-col items-center gap-1 pt-0.5">
                        <span className="font-subheading text-[11px] font-semibold text-[#85887e]">
                          {name}
                        </span>
                        <span
                          className={cn(
                            "flex size-7 items-center justify-center rounded-full text-xs font-semibold tabular-nums",
                            isToday(day)
                              ? "bg-[#11120e] text-white"
                              : "text-[#11120e]",
                          )}
                        >
                          {date.getUTCDate()}
                        </span>
                      </div>

                      <div className="min-w-0 flex-1 space-y-2">
                        {posts.length === 0 ? (
                          <p className="py-2 text-xs text-[#85887e]">
                            Nothing scheduled
                          </p>
                        ) : (
                          posts.map((post) => (
                            <div
                              key={post.title}
                              className={cn(
                                "rounded-xl border border-black/[0.08] bg-white p-3 shadow-2xs",
                                isPast(post.day) && "opacity-60",
                              )}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="flex items-center gap-2">
                                  <PlatformBadge platform={post.platform} />
                                  <span className="font-subheading text-[11px] tabular-nums text-[#6d7066]">
                                    {formatTime(post.time)}
                                  </span>
                                </span>
                                <span className="font-subheading text-[10px] text-[#85887e]">
                                  {isPast(post.day) ? "Published" : "Scheduled"}
                                </span>
                              </div>
                              <p className="mt-1.5 text-sm font-medium leading-snug text-[#11120e]">
                                {post.title}
                              </p>
                            </div>
                          ))
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* ---------- sm and up: week grid ---------- */}
            <div className="hidden sm:block">
              {/* Day header */}
              <div
                className="grid border-b border-black/[0.06] bg-white"
                style={{
                  gridTemplateColumns: "52px repeat(7, minmax(0, 1fr))",
                }}
              >
                <span />
                {DAY_NAMES.map((name, day) => (
                  <div
                    key={name}
                    className="flex flex-col items-center gap-1 border-l border-black/[0.06] py-2.5"
                  >
                    <span className="font-subheading text-[11px] font-semibold text-[#85887e]">
                      {name}
                    </span>
                    <span
                      className={cn(
                        "flex size-6 items-center justify-center rounded-full text-xs font-semibold tabular-nums",
                        isToday(day)
                          ? "bg-[#11120e] text-white"
                          : "text-[#11120e]",
                      )}
                    >
                      {dateFor(week, day).getUTCDate()}
                    </span>
                  </div>
                ))}
              </div>

              {/* Body */}
              <div
                className="grid"
                style={{
                  gridTemplateColumns: "52px repeat(7, minmax(0, 1fr))",
                }}
              >
                {/* Hour gutter */}
                <div
                  className="relative"
                  style={{ height: HOURS.length * ROW_H }}
                >
                  {HOURS.map((h, i) => (
                    <span
                      key={h}
                      className="font-subheading absolute right-2 -translate-y-1/2 text-[10px] tabular-nums text-[#85887e]"
                      style={{
                        top: i * ROW_H,
                        display: i === 0 ? "none" : undefined,
                      }}
                    >
                      {formatHour(h)}
                    </span>
                  ))}
                </div>

                {/* Day columns */}
                {DAY_NAMES.map((name, day) => (
                  <div
                    key={name}
                    className={cn(
                      "relative border-l border-black/[0.06]",
                      isToday(day) && "bg-[#3fda8a]/[0.06]",
                      (day === 5 || day === 6) && "bg-[#faf9f5]/70",
                    )}
                    style={{ height: HOURS.length * ROW_H }}
                  >
                    {HOURS.slice(1).map((h, i) => (
                      <div
                        key={h}
                        className="absolute inset-x-0 border-t border-black/[0.05]"
                        style={{ top: (i + 1) * ROW_H }}
                      />
                    ))}

                    {visiblePosts
                      .filter((p) => p.day === day)
                      .map((post) => (
                        <div
                          key={post.title}
                          title={`${post.title} · ${formatTime(post.time)} · ${PLATFORM_LABEL[post.platform]}`}
                          className={cn(
                            "absolute inset-x-1 flex flex-col gap-1 overflow-hidden rounded-lg border border-black/[0.08] bg-white p-1.5 shadow-2xs transition-opacity",
                            isPast(post.day) && "opacity-60",
                          )}
                          style={{
                            top: (post.time - HOURS[0]) * ROW_H + 2,
                            height: ROW_H - 6,
                          }}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <PlatformBadge
                              platform={post.platform}
                              className="size-3.5"
                            />
                            <span className="font-subheading truncate text-[9px] tabular-nums text-[#85887e]">
                              {formatTime(post.time).replace(" ", "")}
                            </span>
                          </div>
                          <p className="line-clamp-2 text-[10px] font-medium leading-tight text-[#11120e]">
                            {post.title}
                          </p>
                        </div>
                      ))}
                  </div>
                ))}
              </div>

              {visiblePosts.length === 0 && (
                <p className="border-t border-black/[0.06] py-3 text-center text-xs text-[#85887e]">
                  No posts for this network this week
                </p>
              )}
            </div>

            {/* Footer */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-black/[0.06] bg-[#faf9f5] px-4 py-3 sm:px-6">
              <span className="font-subheading text-xs text-[#6d7066]">
                {visiblePosts.length} scheduled this week
              </span>
              <span className="font-subheading inline-flex items-center gap-1 text-xs font-medium text-[#0f7a47]">
                <Sparkles className="size-3.5" />
                Auto-synced
              </span>
            </div>
          </Window>
        </div>
      </section>

      {/* ===================================================================
          SECTION 4: Founder + brand workspaces
      =================================================================== */}
      <section className="grid grid-cols-1 items-center gap-10 lg:grid-cols-12 lg:gap-16">
        <div className="order-2 min-w-0 lg:order-1 lg:col-span-5">
          <Window>
            <WindowChrome
              url="app.draftva.com/workspaces"
              right={
                <span className="font-subheading shrink-0 text-xs text-[#6d7066]">
                  Multi-Account Sync
                </span>
              }
            />

            <div className="p-4 sm:p-8">
              <span className="font-subheading text-xs font-semibold text-[#85887e]">
                Publishing identity
              </span>

              <div className="mt-2.5 grid grid-cols-2 gap-2.5">
                {(
                  [
                    {
                      id: "founder",
                      icon: User,
                      title: "Founder Personal",
                      sub: "@alex · X, LinkedIn, Threads",
                    },
                    {
                      id: "brand",
                      icon: Building2,
                      title: "Draftva Official",
                      sub: "Company Page + Brand Handles",
                    },
                  ] as const
                ).map(({ id, icon: Icon, title, sub }) => (
                  <button
                    key={id}
                    // style={{minHeight:"28px"}}
                    type="button"
                    aria-pressed={workspace === id}
                    onClick={() => setWorkspace(id)}
                    className={cn(
                      workspace === id ? "primary-btn" : "secondary-btn",
                      "font-subheading flex items-center gap-2.5 rounded-lg p-3.5 text-left transition-all",
                    )}
                  >
                    <Icon className="size-4 shrink-0" />
                    <div className="min-w-0">
                      <div className="text-xs font-semibold">{title}</div>
                      <div className="truncate text-[10px] opacity-75">
                        {sub}
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              <div className="mt-5 rounded-2xl border border-black/[0.06] bg-[#faf9f5] p-4 sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="font-heading flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#3fda8a]/25 text-sm font-bold text-[#0f7a47]">
                      {workspace === "brand" ? "DV" : "AX"}
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-heading text-sm font-semibold text-[#11120e]">
                        {workspace === "brand"
                          ? "Draftva Inc. · 42,800 followers"
                          : "Alex Rivera · 19,400 followers"}
                      </h3>
                      <span className="font-subheading block text-xs leading-relaxed text-[#6d7066]">
                        {workspace === "brand"
                          ? "Posts to X, LinkedIn Page & Threads at once"
                          : "Founder queue · Tags the brand handle on viral hits"}
                      </span>
                    </div>
                  </div>
                  <span className="font-subheading rounded-full border border-[#3fda8a]/40 bg-[#3fda8a]/20 px-2.5 py-1 text-[11px] font-semibold text-[#0f7a47]">
                    Best time · 9:00 AM
                  </span>
                </div>

                <p className="mt-4 text-sm leading-relaxed text-[#11120e]">
                  {workspace === "brand"
                    ? "Big release from the team: Multi-channel thread & carousel synchronization is now live for all workspaces..."
                    : "We spent 6 months rebuilding our scheduling engine from scratch. Here is what we learned about cross-network velocity..."}
                </p>

                <div className="mt-5 grid grid-cols-5 gap-2 border-t border-black/[0.06] pt-4">
                  {["Mon", "Tue", "Wed", "Thu", "Fri"].map((d, i) => (
                    <div key={d} className="text-center">
                      <span className="font-subheading text-[10px] text-[#85887e]">
                        {d}
                      </span>
                      <div
                        className={cn(
                          "mt-1 h-2 rounded-full",
                          i % 2 === 0 ? "bg-[#3fda8a]" : "bg-[#3fda8a]/30",
                        )}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Window>
        </div>

        <div className="order-1 lg:order-2 lg:col-span-7">
          <Copy
            badge={
              <SectionBadge icon={Globe}>Brand & Founder Profiles</SectionBadge>
            }
            title="Schedule for your brand handles and founder profiles side by side."
            body="Grow your company’s official presence across X, LinkedIn, and Threads right alongside your personal founder accounts. Switch workspaces in one click, or coordinate launches where your personal account quotes your brand page automatically."
            points={[
              "Publish directly to X, LinkedIn Company Pages, Threads, and Facebook",
              "Switch between personal profiles, brand accounts, or client rosters in one click",
              "Coordinate founder quote-reposts right when your company announcement drops",
            ]}
          />
        </div>
      </section>
    </div>
  );
}
