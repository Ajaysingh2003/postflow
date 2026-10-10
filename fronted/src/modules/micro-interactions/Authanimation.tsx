"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check } from "lucide-react";

/* ============================================================
   Timing
============================================================ */

const TYPE_SPEED = 24;
const PAUSE_BEFORE_SCHEDULE = 800;
const PAUSE_AFTER_SCHEDULE = 1500;

/* ============================================================
   Content
   One thread per weekday. Each thread is two posts.
============================================================ */

const WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri"];

const threads = [
  {
    time: "9:00",
    posts: [
      "Consistency beats frequency. We cut our posting in half and impressions went up.",
      "The reason: every post got more time, and every reply got an answer.",
    ],
  },
  {
    time: "8:30",
    posts: [
      "Your profile is a landing page. Most people still treat it like a résumé.",
      "Lead with who you help, not where you worked.",
    ],
  },
  {
    time: "10:15",
    posts: [
      "The best hook I wrote this year was a line I almost deleted.",
      "If a sentence feels too direct, it is probably the one to keep.",
    ],
  },
  {
    time: "9:45",
    posts: [
      "Nobody replies to a pitch. Everybody replies to a good question.",
      "Ask one thing you genuinely want to know.",
    ],
  },
  {
    time: "8:00",
    posts: [
      "Three months of showing up beat a year of sporadic launches.",
      "Pick a day, pick a time, and let the queue do the rest.",
    ],
  },
];

/* ============================================================
   Panel
============================================================ */

export default function AuthVisualPanel() {
  const reducedMotion = useReducedMotion();

  const [round, setRound] = useState(0);
  const [typed, setTyped] = useState(0);
  const [scheduled, setScheduled] = useState(false);

  const dayIndex = round % threads.length;
  const thread = threads[dayIndex];
  const [first, second] = thread.posts;
  const total = first.length + second.length;

  /* A single timer drives the loop: type, pause, schedule, pause, next. */
  useEffect(() => {
    if (reducedMotion) return;

    let delay = TYPE_SPEED;
    let next: () => void = () => setTyped((count) => count + 1);

    if (typed >= total && !scheduled) {
      delay = PAUSE_BEFORE_SCHEDULE;
      next = () => setScheduled(true);
    } else if (scheduled) {
      delay = PAUSE_AFTER_SCHEDULE;
      next = () => {
        setScheduled(false);
        setTyped(0);
        setRound((value) => value + 1);
      };
    }

    const timer = window.setTimeout(next, delay);
    return () => window.clearTimeout(timer);
  }, [typed, total, scheduled, reducedMotion]);

  /* With reduced motion, show one finished thread and stop. */
  const shownTyped = reducedMotion ? total : typed;

  const firstText = first.slice(0, shownTyped);
  const secondText = second.slice(0, Math.max(shownTyped - first.length, 0));
  const activePost = shownTyped < first.length ? 0 : 1;
  const isTyping = !reducedMotion && shownTyped < total;

  const scheduledCount = dayIndex + (scheduled ? 1 : 0);

  return (
    <section className="relative hidden min-h-screen w-full bg-[#f5f5f5] md:flex md:flex-col">
      <div className="flex min-h-screen w-full flex-col justify-between px-8 py-10 lg:px-12 xl:px-16">
        {/* Brand */}
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-[15px] font-semibold text-white">
            D
          </span>

          <span className="font-heading text-[17px] font-semibold tracking-[-0.02em] text-slate-900">
            Draftva
          </span>
        </div>

        {/* Stage */}
        <div aria-hidden className="py-10">
          <div className="w-full max-w-[460px]">
            <Editor
              firstText={firstText}
              secondText={secondText}
              activePost={activePost}
              isTyping={isTyping}
              scheduled={reducedMotion ? false : scheduled}
              day={WEEK[dayIndex]}
              time={thread.time}
            />

            <Week
              scheduledCount={scheduledCount}
              activeDay={dayIndex}
              reducedMotion={Boolean(reducedMotion)}
            />
          </div>
        </div>

        {/* Copy */}
        <div>
          <h2 className="font-heading max-w-[520px] text-[38px] font-medium leading-[1.1] tracking-[-0.035em] text-slate-900 xl:text-[44px]">
            Write once. Publish everywhere.
          </h2>

          <p className="mt-4 max-w-[460px] text-[16px] leading-7 text-slate-500">
            Draft threads, schedule them for the week, and publish to X,
            LinkedIn and Bluesky from one quiet editor.
          </p>
        </div>
      </div>
    </section>
  );
}

/* ============================================================
   Editor
============================================================ */

function Editor({
  firstText,
  secondText,
  activePost,
  isTyping,
  scheduled,
  day,
  time,
}: {
  firstText: string;
  secondText: string;
  activePost: number;
  isTyping: boolean;
  scheduled: boolean;
  day: string;
  time: string;
}) {
  return (
    <div className="rounded-2xl border-[0.5px] border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_12px_32px_-12px_rgba(15,23,42,0.12)]">
      <div className="px-5 pt-5">
        <ThreadPost
          text={firstText}
          showCursor={isTyping && activePost === 0}
          connected
        />

        <ThreadPost
          text={secondText}
          showCursor={isTyping && activePost === 1}
        />
      </div>

      <div className="mt-2 flex items-center justify-between gap-3 border-t-[0.5px] border-slate-200 px-4 py-3">
        <span className="text-xs text-slate-400">2 posts</span>

        <div className="relative h-9 w-[170px]">
          <AnimatePresence initial={false} mode="wait">
            {scheduled ? (
              <motion.div
                key="scheduled"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2 }}
                className="absolute inset-0 flex items-center justify-end gap-2"
              >
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white">
                  <Check size={12} strokeWidth={3} />
                </span>

                <span className="font-subheading text-sm font-medium text-slate-700">
                  Scheduled, {day} {time}
                </span>
              </motion.div>
            ) : (
              <motion.span
                key="schedule"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2 }}
                className="font-subheading absolute inset-0 flex items-center justify-center rounded-lg bg-[#38bdf8] text-sm font-medium text-white shadow-[0_0_0_1px_rgba(14,116,170,0.25),inset_0_1px_0_rgba(255,255,255,0.4),0_1px_2px_rgba(8,60,105,0.25)]"
              >
                Schedule thread
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

function ThreadPost({
  text,
  showCursor,
  connected = false,
}: {
  text: string;
  showCursor: boolean;
  connected?: boolean;
}) {
  return (
    <div className="flex gap-3">
      {/* Avatar column, with a line down to the next post */}
      <div className="flex w-9 shrink-0 flex-col items-center">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-[13px] font-semibold text-white">
          AS
        </span>

        {connected && <span className="mt-1 w-px flex-1 bg-slate-200" />}
      </div>

      {/* Fixed height so nothing shifts while typing */}
      <div className="min-w-0 flex-1 pb-4">
        <p className="font-subheading text-[15px] font-semibold leading-9 text-slate-900">
          Ajay Singh
        </p>

        <p className="min-h-[72px] text-[15px] leading-6 text-slate-800">
          {text}

          {showCursor && (
            <motion.span
              className="ml-0.5 inline-block h-[16px] w-[2px] translate-y-[3px] rounded-full bg-slate-900"
              animate={{ opacity: [1, 1, 0, 0] }}
              transition={{
                duration: 1,
                repeat: Infinity,
                times: [0, 0.5, 0.5, 1],
              }}
            />
          )}
        </p>
      </div>
    </div>
  );
}

/* ============================================================
   Week
   Five slots. A slot fills when its thread is scheduled.
============================================================ */

function Week({
  scheduledCount,
  activeDay,
  reducedMotion,
}: {
  scheduledCount: number;
  activeDay: number;
  reducedMotion: boolean;
}) {
  return (
    <div className="mt-3 grid grid-cols-5 gap-2">
      {WEEK.map((label, index) => {
        const filled = !reducedMotion && index < scheduledCount;
        const current = !reducedMotion && index === activeDay && !filled;

        return (
          <div
            key={label}
            className={
              current
                ? "flex items-center justify-between rounded-xl border-[0.5px] border-slate-300 bg-white px-3 py-2.5"
                : "flex items-center justify-between rounded-xl border-[0.5px] border-slate-200 bg-white/60 px-3 py-2.5"
            }
          >
            <span
              className={
                filled || current
                  ? "text-xs font-medium text-slate-700"
                  : "text-xs text-slate-400"
              }
            >
              {label}
            </span>

            <span className="relative flex h-4 w-4 items-center justify-center">
              <span className="absolute inset-0 rounded-full border-[0.5px] border-slate-300" />

              <motion.span
                className="h-2 w-2 rounded-full bg-[#38bdf8]"
                initial={false}
                animate={{ scale: filled ? 1 : 0, opacity: filled ? 1 : 0 }}
                transition={{ type: "spring", stiffness: 380, damping: 24 }}
              />
            </span>
          </div>
        );
      })}
    </div>
  );
}