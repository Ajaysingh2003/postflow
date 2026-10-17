"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import {
  CalendarClock,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

import { BentoCard, BentoHeader, CardBottomFade } from "./FeatureSection";

/* -------------------------------------------------------------------------- */
/* Demo data                                                                  */
/* -------------------------------------------------------------------------- */

type Platform = "linkedin" | "x";

const DAYS = [
  { label: "Mon", date: 12 },
  { label: "Tue", date: 13 },
  { label: "Wed", date: 14 },
  { label: "Thu", date: 15 },
  { label: "Fri", date: 16 },
  { label: "Sat", date: 17 },
  { label: "Sun", date: 18 },
];

const TODAY = 0; // Mon 12
const HOURS = ["9 AM", "10 AM", "11 AM", "12 PM"];

const ROW = 56; // px per hour
const GUTTER = 40; 
const NOW_MINUTES = 37;


const POSTS: {
  day: number;
  row: number;
  time: string;
  platform: Platform;
  title: string;
}[] = [
  { day: 1, row: 0, time: "9:00", platform: "linkedin", title: "Consistency beats viral" },
  { day: 2, row: 1, time: "10:00", platform: "x", title: "3 lessons from shipping" },
  { day: 3, row: 0, time: "9:00", platform: "linkedin", title: "A mistake that helped" },
  { day: 4, row: 2, time: "11:00", platform: "x", title: "Posting daily: a take" },
  { day: 5, row: 1, time: "10:00", platform: "linkedin", title: "Weekend reading list" },
];

const LINKEDIN_PATH =
  "M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z";
const X_PATH =
  "M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z";

function PlatformBadge({ platform }: { platform: Platform }) {
  return (
    <span
      className={`flex size-4 shrink-0 items-center justify-center rounded-[5px] ${
        platform === "linkedin" ? "bg-[#0A66C2]" : "bg-[#111418]"
      }`}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" className="size-2.5  fill-white">
        <path d={platform === "x" ? X_PATH : LINKEDIN_PATH} />
      </svg>
    </span>
  );
}


export function FeatureCardTwo() {
  return (
    <BentoCard className="relative !h-[460px] sm:!h-[540px] flex flex-col overflow-hidden bg-white">
      <BentoHeader
        icon={CalendarClock}
        badge="Smart scheduler"
        title="Post when your audience is online"
        description="Draftva finds the times your followers are most active and fills your queue, so every post goes out at its best time."
        linkText="See the scheduler ↗"
        href="/register"
      />

      <div className="relative mt-auto h-[260px] overflow-hidden sm:h-[280px]">
        <WeekCalendar />
        <CardBottomFade height="h-10" />
      </div>
    </BentoCard>
  );
}


function WeekCalendar() {
  const reduce = useReducedMotion();
  const frameRef = useRef<HTMLDivElement>(null);

  const [inView, setInView] = useState(false);
  const [placed, setPlaced] = useState(0);

  /* Only run the loop while the card is on screen. */
  useEffect(() => {
    const element = frameRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { threshold: 0.3 },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  /* Place posts one by one, hold, then start over. */
  useEffect(() => {
    if (reduce) {
      setPlaced(POSTS.length);
      return;
    }
    if (!inView) return;

    let timeout: ReturnType<typeof setTimeout>;

    const step = (count: number) => {
      setPlaced(count);
      const delay = count >= POSTS.length ? 3400 : count === 0 ? 800 : 950;
      timeout = setTimeout(
        () => step(count >= POSTS.length ? 0 : count + 1),
        delay,
      );
    };

    step(0);
    return () => clearTimeout(timeout);
  }, [inView, reduce]);

  const cols = `grid-cols-[${GUTTER}px_repeat(7,minmax(0,1fr))]`;
  const nowTop = (NOW_MINUTES / 60) * ROW;

  return (
    <div className="absolute inset-x-0 top-1 px-3 sm:px-6">
      <div
        ref={frameRef}
        role="img"
        aria-label="Week calendar: Draftva places posts at the best times for your audience"
        className="mx-auto w-full max-w-[540px] overflow-hidden rounded-xl bg-white shadow-[0_1px_2px_rgba(16,24,40,0.05),0_4px_12px_rgba(16,24,40,0.04),0_0_0_0.5px_rgba(16,24,40,0.12)]"
      >
        <div aria-hidden="true">
          {/* Toolbar */}
          <div className="flex h-9 items-center justify-between gap-2 border-b-[0.5px] border-black/10 px-2.5">
            <div className="flex min-w-0 items-center gap-1.5">
              <span className="rounded-md border border-black/10 px-2 py-0.5 text-[10.5px] font-medium text-[#111418]">
                Today
              </span>
              <span className="flex items-center text-[#6b737d]">
                <ChevronLeft className="size-3.5" />
                <ChevronRight className="size-3.5" />
              </span>
              <span className="flex items-center gap-1 whitespace-nowrap text-[11px] font-medium text-[#111418]">
                <CalendarDays className="hidden size-3 text-[#8a929c] sm:block" />
                12 – 18 Oct 2026
              </span>
            </div>

            <div className="flex shrink-0 items-center gap-1.5">
              <div className="hidden items-center rounded-md bg-[#f3f4f5] p-0.5 text-[10px] font-medium text-[#8a929c] sm:flex">
                <span className="px-1.5 py-0.5">Day</span>
                <span className="rounded bg-white px-1.5 py-0.5 text-[#111418] shadow-sm">
                  Week
                </span>
                <span className="px-1.5 py-0.5">Month</span>
              </div>

              <span className="flex items-center gap-1.5 rounded-md border border-black/10 px-2 py-0.5 text-[10.5px] font-medium tabular-nums text-[#4b525a]">
                <span className="size-1.5 rounded-full bg-[#111418]" />
                {placed} {placed === 1 ? "post" : "posts"}
              </span>
            </div>
          </div>

          {/* Day header */}
          <div
            className={`grid ${cols} border-b-[0.5px] border-black/10`}
            style={{ gridTemplateColumns: `${GUTTER}px repeat(7, minmax(0, 1fr))` }}
          >
            <span />
            {DAYS.map((day, i) => (
              <div
                key={day.label}
                className="flex flex-col items-center gap-0.5 border-l border-black/[0.06] py-1.5"
              >
                <span className="text-[9.5px] font-medium text-[#8a929c]">
                  {day.label}
                </span>
                <span
                  className={`flex size-5 items-center justify-center rounded-full text-[11px] font-semibold tabular-nums ${
                    i === TODAY ? "bg-[#111418] text-white" : "text-[#4b525a]"
                  }`}
                >
                  {day.date}
                </span>
              </div>
            ))}
          </div>

          {/* Body */}
          <div className="relative">
            {HOURS.map((hour, rowIndex) => (
              <div
                key={hour}
                className={`grid ${cols}`}
                style={{
                  height: ROW,
                  gridTemplateColumns: `${GUTTER}px repeat(7, minmax(0, 1fr))`,
                }}
              >
                <span className="pr-1.5 pt-0.5 text-right text-[9px] tabular-nums text-[#a0a6ad]">
                  {hour}
                </span>
                {DAYS.map((day) => (
                  <span
                    key={day.label}
                    className={`border-l border-black/[0.06] bg-[#fcfcfc] ${
                      rowIndex > 0 ? "border-t" : ""
                    }`}
                  />
                ))}
              </div>
            ))}

            {/* Overlay: posts and the now line */}
            <div
              className="pointer-events-none absolute inset-y-0 right-0 grid grid-cols-7"
              style={{ left: GUTTER }}
            >
              {DAYS.map((day, dayIndex) => (
                <div key={day.label} className="relative min-w-0">
                  {POSTS.map((post, postIndex) => {
                    if (post.day !== dayIndex) return null;

                    const visible = postIndex < placed;
                    const latest = postIndex === placed - 1;

                    return (
                      <div
                        key={post.title}
                        className={`absolute inset-x-[3px] flex flex-col gap-1 overflow-hidden rounded-lg border bg-white p-1.5 transition-all duration-300 ease-out ${
                          visible
                            ? "translate-y-0 scale-100 opacity-100"
                            : "-translate-y-1 scale-95 opacity-0"
                        } ${
                          latest
                            ? "border-black/20 shadow-[0_6px_14px_-6px_rgba(16,24,40,0.35)]"
                            : "border-black/[0.07] shadow-[0_1px_3px_rgba(16,24,40,0.1)]"
                        }`}
                        style={{
                          top: post.row * ROW + 3,
                          height: ROW - 6,
                        }}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <PlatformBadge platform={post.platform} />
                          <span className="hidden rounded bg-[#f3f4f5] px-1 py-px text-[9px] tabular-nums text-[#6b737d] sm:inline">
                            {post.time}
                          </span>
                        </div>

                        <p className="hidden line-clamp-2 text-[9.5px] font-medium leading-[1.25] text-[#111418] sm:block">
                          {post.title}
                        </p>

                        <span className="text-[8.5px] tabular-nums text-[#6b737d] sm:hidden">
                          {post.time}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ))}

              {/* now line */}
              <span
                className="absolute inset-x-0 h-px bg-[#e5484d]"
                style={{ top: nowTop }}
              />
              <span
                className="absolute left-0 size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#e5484d]"
                style={{ top: nowTop }}
              />
            </div>

            {/* now badge in the gutter */}
            <span
              className="absolute left-1 rounded bg-[#e5484d] px-1 py-px text-[8px] font-semibold tabular-nums text-white"
              style={{ top: nowTop - 7 }}
            >
              9:37
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}