"use client";

import React, { useState } from "react";
import {
  Plus,
  Check,
  Clock,
  Sparkles,
  ArrowUpRight,
  Layers,
} from "lucide-react";
import { cn } from "@/lib/utils";

const INITIAL_QUEUE = [
  {
    id: 1,
    title: "Why most content calendars fail",
    day: "Mon",
    time: "09:00 AM",
  },
  {
    id: 2,
    title: "Product velocity update — v2.4",
    day: "Tue",
    time: "12:30 PM",
  },
];

const WINDOWS = [
  {
    id: "tue",
    day: "Tue",
    time: "08:45 AM",
    score: "94% match",
    bars: [35, 55, 95, 65, 40],
  },
  {
    id: "wed",
    day: "Wed",
    time: "12:15 PM",
    score: "99% match",
    bars: [45, 75, 60, 100, 50],
  },
  {
    id: "thu",
    day: "Thu",
    time: "05:10 PM",
    score: "89% match",
    bars: [30, 45, 70, 90, 60],
  },
];

export default function ScheduleFeatureSection() {
  // Card 1 State: Interactive Queue
  const [queue, setQueue] = useState(INITIAL_QUEUE);
  const [added, setAdded] = useState(false);

  // Card 2 State: Active Heatmap Window
  const [selectedId, setSelectedId] = useState("wed");
  const activeWindow = WINDOWS.find((w) => w.id === selectedId) ?? WINDOWS[1];

  const handleAddSlot = () => {
    if (queue.length < 3) {
      setQueue([
        ...queue,
        {
          id: 3,
          title: "Founder notes: Q4 roadmap",
          day: "Thu",
          time: "04:15 PM",
        },
      ]);
      setAdded(true);
    } else {
      setQueue(INITIAL_QUEUE);
      setAdded(false);
    }
  };

  return (
    <section className="mx-auto w-full max-w-7xl px-z4 py-16 szm:px-6 lzg:px-8 lg:py-24">
      {/* Editorial Header */}
      <div className="max-w-2xl">
        <div className="inline-flex items-center gap-2 rounded-full border border-[#3fda8a]/40 bg-[#3fda8a]/10 px-3 py-1">
          <span className="size-2 rounded-full bg-[#3fda8a]" />
          <span className="font-subheading text-xs font-medium tracking-wide text-[#11120e]">
            Draftva Autopilot
          </span>
        </div>

        <h2 className="font-heading mt-4 text-3xl font-semibold tracking-tight text-[#11120e] sm:text-5xl">
          Batch once.{" "}
          <span className="underline decoration-[#3fda8a] decoration-[3px] underline-offset-8">
            Show up all week.
          </span>
        </h2>

        <p className="mt-4 text-base leading-relaxed text-[#6d7066] sm:text-lg">
          Consistency is the whole game, and the hardest part to keep up.
          Scheduling your posts in advance with Draftva makes it automatic.
        </p>
      </div>

      {/* Unified Architectural 3-Column Grid */}
      <div className="mt-12 grid grid-cols-1 divide-y divide-black/[0.07] overflow-hidden rounded-3xl border border-black/[0.08] bg-white shadow-[0_24px_60px_-20px_rgba(17,18,14,0.07)] lg:mt-16 lg:grid-cols-3 lg:divide-x lg:divide-y-0">
        {/* =========================================================
            01: FILL YOUR WEEK IN MINUTES
        ========================================================= */}
        <div className="flex flex-col justify-between p-6 sm:p-8 lg:p-10">
          <div>
            <div className="flex items-center justify-between">
              <span className="font-subheading inline-flex size-7 items-center justify-center rounded-lg bg-[#3fda8a] text-xs font-bold text-[#11120e]">
                01
              </span>
              <span className="font-subheading text-xs text-[#85887e]">
                Batch Pipeline
              </span>
            </div>

            <h3 className="font-heading mt-6 text-xl font-semibold tracking-tight text-[#11120e]">
              Fill your week in minutes
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-[#6d7066]">
              Draft a batch of posts, review them for publishing, and drop them
              into your queue. No copy-pasting into social tabs ever again.
            </p>
          </div>

          {/* Visual: Connected Queue Timeline */}
          <div className="mt-8 pt-6 border-t border-black/[0.05]">
            <div className="relative space-y-2.5 before:absolute before:top-3 before:bottom-3 before:left-[15px] before:w-px before:bg-black/[0.08]">
              {queue.map((item) => (
                <div
                  key={item.id}
                  className="relative flex items-center justify-between rounded-xl border border-black/[0.06] bg-[#faf9f5] py-2.5 pr-3 pl-3 shadow-2xs transition-all"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="relative z-10 size-2 shrink-0 rounded-full bg-[#3fda8a] ring-4 ring-[#faf9f5]" />
                    <span className="truncate text-xs font-medium text-[#11120e]">
                      {item.title}
                    </span>
                  </div>
                  <span className="font-subheading ml-2 shrink-0 rounded-md bg-white px-2 py-0.5 text-[11px] text-[#6d7066] border border-black/[0.05]">
                    {item.day} · {item.time}
                  </span>
                </div>
              ))}
            </div>

            {/* Action Bar */}
            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={handleAddSlot}
                className="font-subheading secondary-btn flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#11120e] px-3.5 py-2.5 text-xs font-medium text-white transition-all hover:bg-[#11120e]/90 active:scale-[0.99]"
              >
                {added ? (
                  <>
                    <Check className="size-3.5 text-[#3fda8a]" />
                    <span>Added to Thursday slot</span>
                  </>
                ) : (
                  <>
                    <Plus className="size-3.5 text-[#3fda8a]" />
                    <span>Add to queue</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={handleAddSlot}
                className="font-subheading flex items-center gap-1.5 rounded-xl border border-black/[0.08] bg-white px-3 py-2.5 text-xs font-medium text-[#11120e] transition-colors hover:bg-[#faf9f5]"
              >
                <Layers className="size-3.5 text-[#6d7066]" />
                Duplicate
              </button>
            </div>
          </div>
        </div>

        {/* =========================================================
            02: DRAFTVA COACH PICKS THE TIME
        ========================================================= */}
        <div className="flex flex-col justify-between bg-[#faf9f5]/50 p-6 sm:p-8 lg:p-10">
          <div>
            <div className="flex items-center justify-between">
              <span className="font-subheading inline-flex size-7 items-center justify-center rounded-lg bg-[#3fda8a] text-xs font-bold text-[#11120e]">
                02
              </span>
              <span className="font-subheading inline-flex items-center gap-1 text-xs text-[#11120e]">
                <Sparkles className="size-3 text-[#3fda8a] fill-[#3fda8a]" />
                Smart Timing
              </span>
            </div>

            <h3 className="font-heading mt-6 text-xl font-semibold tracking-tight text-[#11120e]">
              Draftva picks the time
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-[#6d7066]">
              Draftva analyzes audience activity patterns to pinpoint the exact
              window when your followers are actually online and engaging.
            </p>
          </div>

          {/* Visual: Dark Telemetry Heatmap & Slot Picker */}
          <div className="mt-8 pt-6 border-t border-black/[0.05]">
            <div className="rounded-2xl bg-[#11120e] p-4 text-white shadow-md">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Clock className="size-3.5 text-[#3fda8a]" />
                  <span className="font-subheading text-[11px] uppercase tracking-wider text-neutral-400">
                    Suggested Slots
                  </span>
                </div>
                <span className="font-subheading rounded-full bg-[#3fda8a]/15 px-2 py-0.5 text-[11px] font-medium text-[#3fda8a]">
                  {activeWindow.score}
                </span>
              </div>

              {/* Mini Activity Bar Chart */}
              <div className="mt-4 flex h-12 items-end gap-2 px-1">
                {activeWindow.bars.map((height, idx) => {
                  const isPeak = height >= 90;
                  return (
                    <div
                      key={idx}
                      className="flex flex-1 flex-col items-center gap-1 h-full justify-end"
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

              {/* Interactive Slot Pills */}
              <div className="mt-4 grid grid-cols-3 gap-1.5">
                {WINDOWS.map((slot) => {
                  const isSelected = slot.id === selectedId;
                  return (
                    <button
                      key={slot.id}
                      type="button"
                      onClick={() => setSelectedId(slot.id)}
                      className={cn(
                        "font-subheading rounded-lg py-2 px-2 text-center text-[11px] font-medium transition-all",
                        isSelected
                          ? "bg-[#3fda8a] text-[#11120e] font-semibold shadow-sm"
                          : "bg-white/[0.07] text-neutral-300 hover:bg-white/[0.12]",
                      )}
                    >
                      {slot.day} {slot.time.split(" ")[0]}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* =========================================================
            03: IT POSTS FOR YOU
        ========================================================= */}
        <div className="flex flex-col justify-between p-6 sm:p-8 lg:p-10">
          <div>
            <div className="flex items-center justify-between">
              <span className="font-subheading inline-flex size-7 items-center justify-center rounded-lg bg-[#3fda8a] text-xs font-bold text-[#11120e]">
                03
              </span>
              <span className="font-subheading inline-flex items-center gap-1.5 text-xs text-[#11120e]">
                <span className="size-2 rounded-full bg-[#3fda8a] animate-pulse" />
                Auto-Dispatch
              </span>
            </div>

            <h3 className="font-heading mt-6 text-xl font-semibold tracking-tight text-[#11120e]">
              It posts for you
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-[#6d7066]">
              Your queue publishes on time, every time. You stay top-of-feed all
              week without ever needing to open the app.
            </p>
          </div>

          {/* Visual: Live Dispatch Notification Card */}
          <div className="mt-8 pt-6 border-t border-black/[0.05]">
            <div className="relative overflow-hidden rounded-2xl border border-[#3fda8a]/40 bg-gradient-to-br from-[#3fda8a]/[0.12] via-[#3fda8a]/[0.04] to-white p-4">
              <div className="flex items-start gap-3.5">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-[#3fda8a] text-[#11120e] shadow-xs">
                  <Check className="size-4 stroke-[2.5]" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-heading text-xs font-semibold text-[#11120e]">
                      Published 8:12 AM
                    </span>
                    <span className="font-subheading inline-flex items-center gap-0.5 text-[11px] font-medium text-[#11120e]">
                      Live
                      <ArrowUpRight className="size-3 text-[#11120e]" />
                    </span>
                  </div>

                  <p className="mt-1 text-xs leading-relaxed text-[#6d7066]">
                    Next post goes out Wednesday — your queue is full for 7
                    days.
                  </p>
                </div>
              </div>

              {/* 7-Day Queue Progress Bar */}
              <div className="mt-4 pt-3 border-t border-black/[0.06] flex items-center justify-between gap-2">
                <span className="font-subheading text-[10px] uppercase tracking-wider text-[#6d7066]">
                  7-Day Queue Health
                </span>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5, 6, 7].map((day) => (
                    <span
                      key={day}
                      className="h-1.5 w-3.5 rounded-full bg-[#3fda8a]"
                    />
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
