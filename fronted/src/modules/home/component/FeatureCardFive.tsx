"use client";

import React, { useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  AnimatePresence,
  motion,
  useInView,
  useReducedMotion,
} from "framer-motion";
import {
  AlignLeft,
  Check,
  CheckCheck,
  CornerDownRight,
  FilePenLine,
  Flame,
  Globe2,
  ListChecks,
  LoaderCircle,
  MessageSquare,
  MousePointer2,
  Pen,
  Send,
  Share2,
  Sparkles,
  User,
} from "lucide-react";

import { BentoCard, BentoHeader, CardBottomFade } from "./FeatureSection";

const BRAND = "#ff8e4d";
const ease = [0.16, 1, 0.3, 1] as const;

/* -------------------------------------------------------------------------- */
/* Platform Badges (Real Asset Files from /public/channels)                   */
/* -------------------------------------------------------------------------- */

type Platform = "linkedin" | "x" | "threads";

const PLATFORM_ASSETS: Record<Platform, { src: string; alt: string }> = {
  linkedin: { src: "/channels/linkedin.svg", alt: "LinkedIn" },
  x: { src: "/channels/x.jpeg", alt: "X" },
  threads: { src: "/channels/threads.svg", alt: "Threads" },
};

function PlatformBadge({
  platform,
  size = "sm",
}: {
  platform: Platform;
  size?: "sm" | "md";
}) {
  const isMd = size === "md";
  const asset = PLATFORM_ASSETS[platform];

  return (
    <span
      className={`relative flex  shrink-0 items-center justify-center overflow-hidden border border-black/5 shadow-2xs ${
        isMd ? "size-6  rounded-lg" : "size-4.5 rounded-md"
      } ${platform === "linkedin" ? "" : "bg-black"}`}
    >
      <Image
        src={asset.src}
        alt={asset.alt}
        // width={100}
        // height={100}
        width={isMd ? 24 : 18}
        height={isMd ? 24 : 18}
        className="size-full object-cover rounded-lg  z-10"
      />
    </span>
  );
}

function useSteps(delays: number[], run: boolean, rest: number) {
  const [step, setStep] = useState(rest);
  useEffect(() => {
    if (!run) return;
    let timeout: ReturnType<typeof setTimeout>;
    const tick = (s: number) => {
      setStep(s);
      timeout = setTimeout(() => tick((s + 1) % delays.length), delays[s]);
    };
    tick(0);
    return () => clearTimeout(timeout);
  }, [run, delays]);
  return step;
}

function CardContainer({
  icon,
  badge,
  title,
  description,
  children,
}: {
  icon: React.ElementType;
  badge: string;
  title: string;
  description: string;
  children: (ctx: { run: boolean; reduced: boolean }) => React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const seen = useInView(ref, { once: true, margin: "-80px" });
  const live = useInView(ref, { margin: "-40px" });
  const reduced = !!useReducedMotion();
  const show = seen || reduced;

  return (
    <BentoCard className="relative flex !h-[490px] flex-col overflow-hidden border-zinc-200/80 bg-white sm:!h-[510px]">
      <BentoHeader
        icon={icon}
        badge={badge}
        title={title}
        description={description}
      />
      <div
        ref={ref}
        className="relative min-h-0 flex-1 select-none overflow-hidden px-3.5 pb-6 sm:px-6"
      >
        <motion.div
          initial={reduced ? false : { opacity: 0, y: 16 }}
          animate={show ? { opacity: 1, y: 0 } : undefined}
          transition={{ duration: 0.65, ease }}
          className="relative z-10 mx-auto w-full max-w-[420px]"
        >
          {children({ run: live && !reduced, reduced })}
        </motion.div>
        <CardBottomFade height="h-6" />
      </div>
    </BentoCard>
  );
}

/* ========================================================================== */
/* 1. FeatureCardChannels: Publish to multiple channels                       */
/* ========================================================================== */

const CHANNELS: {
  id: Platform;
  name: string;
  tag: string;
  formatColor: string;
}[] = [
  { id: "linkedin", name: "LinkedIn", tag: "Feed post", formatColor: "bg-[#0A66C2]/10 text-[#0A66C2]" },
  { id: "x", name: "X", tag: "Post", formatColor: "bg-zinc-900/10 text-zinc-800" },
  { id: "threads", name: "Threads", tag: "Thread", formatColor: "bg-emerald-500/10 text-emerald-700" },
];

const CHANNEL_DELAYS = [1200, 950, 500, 500, 3600];

export function FeatureCardChannels() {
  return (
    <CardContainer
      icon={Share2}
      badge="Publishing"
      title="One draft, three platforms"
      description="Prepare and publish posts to LinkedIn, X, and Threads from one place."
    >
      {({ run }) => <ChannelsEngine run={run} />}
    </CardContainer>
  );
}

function ChannelsEngine({ run }: { run: boolean }) {
  const step = useSteps(CHANNEL_DELAYS, run, CHANNEL_DELAYS.length - 1);
  const isTransmitting = step >= 1 && step < 4;
  const isDone = step >= 4;

  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200/90 bg-white shadow-[0_6px_18px_-12px_rgba(15,23,42,0.13)]">
      {/* Active Composition Box */}
      <div className="border-b border-zinc-100 bg-zinc-50/70 p-3.5">
        <div className="flex items-center justify-between pb-2">
          <div className="flex items-center gap-2">
            <span className="flex size-5.5 items-center justify-center rounded-md bg-violet-500 text-white">
              <User className="size-3" />
            </span>
            <span className="text-xs font-semibold text-zinc-900">Ready to publish</span>
          </div>
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold transition-colors ${
              isDone
                ? "bg-emerald-50 text-emerald-700 border border-emerald-200/60"
                : isTransmitting
                ? "bg-amber-50 text-amber-700 border border-amber-200/60"
                : "bg-zinc-100 text-zinc-600"
            }`}
          >
            {isDone ? (
              <>
                <Check className="size-2.5 stroke-[3] text-emerald-600" />
                Published to 3 platforms
              </>
            ) : isTransmitting ? (
              <>
                <LoaderCircle className="size-2.5 animate-spin text-amber-600" />
                Publishing…
              </>
            ) : (
              <>
                <Globe2 className="size-2.5 text-zinc-400" />
                Ready
              </>
            )}
          </span>
        </div>
        <p className="line-clamp-2 text-xs font-medium leading-relaxed text-zinc-800">
          “Three changes we made to improve the performance of our app this week.”
        </p>
        <div className="mt-3 flex items-center justify-between pt-2 border-t border-zinc-200/60">
          <span className="font-mono text-[10px] text-zinc-400">248 characters</span>
          <button
            style={{ minHeight: "16px" }}
            type="button"
            className="primary-btn inline-flex h-7 items-center justify-center gap-1.5 rounded-lg px-3 text-[11px] font-semibold"
          >
            {isDone ? (
              <>
                <Check className="size-3 stroke-[3]" />
                <span>Published</span>
              </>
            ) : isTransmitting ? (
              <>
                <LoaderCircle className="size-3 animate-spin" />
                <span>Publishing…</span>
              </>
            ) : (
              <>
                <Send className="size-3" />
                <span>Publish</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Synchronized Routing Bus */}
      <div className="relative h-7 bg-zinc-50/30">
        <svg
          viewBox="0 0 300 28"
          preserveAspectRatio="none"
          className="absolute inset-0 size-full overflow-visible"
        >
          {["M150 0 C150 14 50 14 50 28", "M150 0 L150 28", "M150 0 C150 14 250 14 250 28"].map(
            (path, i) => (
              <g key={path}>
                <path
                  d={path}
                  fill="none"
                  stroke="#e4e4e7"
                  strokeWidth="1.5"
                  strokeDasharray="3 3"
                />
                <motion.path
                  d={path}
                  fill="none"
                  stroke={BRAND}
                  strokeWidth="2"
                  strokeLinecap="round"
                  initial={false}
                  animate={{
                    pathLength: step >= 1 ? 1 : 0,
                    opacity: step >= 1 ? 1 : 0,
                  }}
                  transition={{
                    duration: 0.5,
                    delay: step >= 1 ? i * 0.1 : 0,
                    ease,
                  }}
                />
              </g>
            )
          )}
        </svg>
      </div>

      {/* Target Destination Grid */}
      <div className="grid grid-cols-3 gap-2 p-3 bg-white">
        {CHANNELS.map((channel, i) => {
          const live = step >= 2 + i;
          const syncing = step >= 1 && !live;
          return (
            <div
              key={channel.id}
              className={`flex flex-col items-center justify-between rounded-xl border p-2.5 text-center transition-all duration-300 ${
                live
                  ? "border-emerald-500/40 bg-emerald-50/30 shadow-xs"
                  : syncing
                  ? "border-zinc-300 bg-zinc-50"
                  : "border-zinc-200/70 bg-zinc-50/50"
              }`}
            >
              <PlatformBadge platform={channel.id} size="md" />
              <span className="mt-1.5 text-xs font-semibold text-zinc-900">
                {channel.name}
              </span>
              <span className={`mt-0.5 rounded px-1.5 py-0.2 font-mono text-[9px] font-medium ${channel.formatColor}`}>
                {channel.tag}
              </span>
              <div className="mt-2 flex items-center gap-1 text-[10px]">
                {live ? (
                  <span className="flex items-center gap-1 font-semibold text-emerald-600">
                    <Check className="size-2.5 stroke-[3]" /> Live
                  </span>
                ) : syncing ? (
                  <span className="flex items-center gap-1 text-zinc-500">
                    <LoaderCircle className="size-2.5 animate-spin" /> Ingest
                  </span>
                ) : (
                  <span className="text-zinc-400">Ready</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ========================================================================== */
/* 2. FeatureCardEditor: Inline writing tools and revisions                   */
/* ========================================================================== */

const EDIT_ACTIONS = [
  { label: "Make it more direct", icon: AlignLeft, color: "text-zinc-600" },
  { label: "Improve grammar", icon: CheckCheck, color: "text-zinc-600" },
  { label: "Summarize key points", icon: ListChecks, color: "text-zinc-600" },
];

const EDITOR_DELAYS = [1000, 700, 800, 900, 1800, 650, 450, 3200];

const CURSOR_COORDS = [
  { left: "58%", top: 110, show: false },              // 0. Idle over draft
  { left: "calc(100% - 34px)", top: 22, show: true },  // 1. Move to editor action button
  { left: "calc(100% - 34px)", top: 22, show: true },  // 2. Click action button (opens palette)
  { left: 140, top: 118, show: true },                 // 3. Hover first action
  { left: 140, top: 118, show: true },                 // 4. Select action
  { left: "calc(100% - 68px)", top: 228, show: true }, // 5. Move down to "Apply"
  { left: "calc(100% - 68px)", top: 228, show: true }, // 6. Click "Apply"
  { left: "calc(100% - 68px)", top: 228, show: false },// 7. Fade out
];

export function FeatureCardEditor() {
  return (
    <CardContainer
      icon={FilePenLine}
      badge="Writing tools"
      title="Edit without losing your voice"
      description="Use quick edits, compare changes, and keep what works for your post."
    >
      {({ run }) => <EditorDiffEngine run={run} />}
    </CardContainer>
  );
}

function EditorDiffEngine({ run }: { run: boolean }) {
  const step = useSteps(EDITOR_DELAYS, run, EDITOR_DELAYS.length - 1);

  const showMenu = step === 2 || step === 3;
  const showResult = step >= 4 && step <= 6;
  const isAccepted = step >= 7;

  const cursor = CURSOR_COORDS[step];
  const isClicking = step === 2 || step === 3 || step === 6;

  return (
    <div className="relative isolate overflow-hidden rounded-2xl border border-zinc-200/90 bg-white shadow-[0_16px_40px_-20px_rgba(15,23,42,0.14)]">
      {/* Top Document Header */}
      <div className="flex h-11 items-center justify-between border-b border-zinc-100 bg-zinc-50/70 px-4">
        <div className="flex items-center gap-2.5">
          <PlatformBadge platform="x" />
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold tracking-tight text-zinc-900">
              Thread Draft #04
            </span>
            <span className="h-3 w-px bg-zinc-200" />
            <span className="font-mono text-[10px] text-zinc-400">X / 280</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <AnimatePresence mode="wait">
            {isAccepted ? (
              <motion.span
                key="saved"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="inline-flex items-center gap-1 rounded-full border border-emerald-200/60 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700"
              >
                <Check className="size-2.5 stroke-[3]" />
                Saved
              </motion.span>
            ) : (
              <motion.span
                key="draft"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="rounded-full bg-zinc-100 px-2 py-0.5 font-mono text-[10px] font-medium text-zinc-500"
              >
                Drafting
              </motion.span>
            )}
          </AnimatePresence>

          <span
            className={`flex size-7 items-center justify-center rounded-lg border transition-all ${
              showMenu || showResult
                ? "border-emerald-500/40 bg-emerald-50 text-emerald-700 shadow-2xs"
                : "border-zinc-200/80 bg-white text-zinc-600 shadow-2xs"
            }`}
          >
            <Pen className="size-3.5" />
          </span>
        </div>
      </div>

      {/* Editor Canvas Area */}
      <div className="min-h-[195px] p-4 sm:p-5">
        <div className="flex items-center justify-between pb-3 text-[10.5px]">
          <span className="font-mono font-medium uppercase tracking-wider text-zinc-400">
            Post Canvas
          </span>
          <span className="font-mono text-zinc-400">
            <strong className={isAccepted ? "text-emerald-600" : "text-zinc-700"}>
              {isAccepted ? "88" : "96"}
            </strong>
            /280 chars
          </span>
        </div>

        <div className="text-[13px] leading-[1.8] text-zinc-800">
          <AnimatePresence mode="wait" initial={false}>
            {isAccepted ? (
              <motion.div
                key="updated-content"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
              >
                One post brings quick attention.{" "}
                <mark className="rounded-md border border-emerald-200/80 bg-emerald-50 px-1.5 py-0.5 font-medium text-emerald-950">
                  Regular updates give people a reason to return.
                </mark>
              </motion.div>
            ) : (
              <motion.div
                key="original-content"
                initial={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                I think that{" "}
                <span className="rounded-md border border-rose-200/70 bg-rose-50 px-1 py-0.5 text-zinc-500 line-through decoration-rose-400 decoration-1">
                  one good post can help
                </span>
                , but posting regularly makes a bigger difference.
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Modern ⌘K Command Palette Overlay */}
      <AnimatePresence>
        {(showMenu || showResult) && (
          <motion.div
            key={showMenu ? "command-menu" : "command-result"}
            initial={{ opacity: 0, y: 6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.98 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="absolute inset-x-3 bottom-3 top-[48px] z-20 flex flex-col justify-between overflow-hidden rounded-xl border border-zinc-200 bg-white/95 p-3.5 shadow-[0_16px_36px_-12px_rgba(15,23,42,0.18)] backdrop-blur-md"
          >
            {/* View A: Action Picker */}
            {showMenu && (
              <div className="flex h-full flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between border-b border-zinc-100 pb-2 text-[11px]">
                    <span className="font-semibold text-zinc-800">Quick AI Actions</span>
                    <kbd className="flex h-5 items-center rounded border border-zinc-200 bg-zinc-50 px-1.5 font-mono text-[9.5px] font-medium text-zinc-500">
                      ⌘ K
                    </kbd>
                  </div>

                  <div className="mt-2 space-y-1">
                    {EDIT_ACTIONS.map((action, i) => {
                      const isSelected = step === 3 && i === 0;

                      return (
                        <div
                          key={action.label}
                          className={`flex h-9 items-center justify-between rounded-lg px-2.5 transition-all ${
                            isSelected
                              ? "bg-stone-100 shadow-2xs"
                              : "text-zinc-600 hover:bg-zinc-50"
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <action.icon
                              className={`size-3.5 ${
                                isSelected ? "text-[#3fda8a]" : action.color
                              }`}
                            />
                            <span className="text-xs font-medium">
                              {action.label}
                            </span>
                          </div>

                          {isSelected && (
                            <span className="font-mono text-[10px] text-zinc-400">
                              ↵
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-zinc-100 pt-2 text-[10px] text-zinc-400">
                  <span>Type a prompt or choose an action</span>
                  <span className="font-mono">ESC to dismiss</span>
                </div>
              </div>
            )}

            {/* View B: Inline Suggested Diff */}
            {showResult && (
              <div className="flex h-full flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between border-b border-zinc-100 pb-2 text-[11px]">
                    <div className="flex items-center gap-1.5 font-semibold text-zinc-900">
                      <Flame className="size-3 text-amber-500" />
                      <span>Suggested Polish</span>
                    </div>
                    <span className="rounded bg-emerald-50 px-1.5 py-0.5 font-mono text-[9.5px] font-semibold text-emerald-700">
                      +34% Retention
                    </span>
                  </div>

                  <div className="mt-2 rounded-lg border border-zinc-200/80 bg-zinc-50/70 p-2.5">
                    <p className="text-xs font-medium leading-relaxed text-zinc-900">
                      “One post can bring attention. Regular updates give people a reason to return.”
                    </p>
                  </div>
                </div>

                {/* Footer Controls */}
                <div className="flex items-center justify-between border-t border-zinc-100 pt-2.5">
                  <span className="text-[10px] text-zinc-400">
                    Original draft preserved
                  </span>

                  <div className="flex items-center gap-2">
                    <span
                      style={{ minHeight: "16px" }}
                      className="rounded-lg h-7 border secondary-btn border-zinc-200 bg-white px-2.5 py-1 text-xs font-medium text-zinc-600"
                    >
                      Dismiss
                    </span>

                    <button
                      style={{ minHeight: "16px" }}
                      type="button"
                      className={`inline-flex h-7 primary-btn !rounded-lg items-center gap-1.5 !text-xs font-semibold text-white shadow-xs transition-transform ${
                        step === 6 ? "scale-95" : ""
                      }`}
                    >
                      <Check className="size-3 stroke-[3]" />
                      <span>Apply</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Animated Pointer with Click Indicator */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute z-30 transition-[left,top,opacity] duration-500 ease-out"
        style={{
          left: cursor.left,
          top: cursor.top,
          opacity: cursor.show ? 1 : 0,
        }}
      >
        {isClicking && (
          <span className="absolute -left-1.5 -top-1.5 size-4 animate-ping rounded-full bg-emerald-400/60" />
        )}
        <MousePointer2
          className={`size-4.5 fill-zinc-900 stroke-white drop-shadow-md transition-transform duration-150 ${
            isClicking ? "scale-90" : "scale-100"
          }`}
        />
      </span>

      {/* Bottom Status Ticker */}
      <div className="flex h-10 items-center justify-between border-t border-zinc-100 bg-zinc-50/70 px-4">
        <div className="flex min-w-0 items-center gap-2">
          <CornerDownRight className="size-3 text-emerald-600 shrink-0" />
          <span className="truncate text-[11px] text-zinc-500">
            Action: <strong className="text-zinc-700 font-medium">Strip filler words</strong>
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="size-1.5 rounded-full bg-emerald-500" />
          <span className="text-[10px] font-medium text-zinc-500">
            {isAccepted ? "Version 2 ready" : "Autosave active"}
          </span>
        </div>
      </div>
    </div>
  );
}

/* ========================================================================== */
/* 3. FeatureCardReview: Review and approvals                                 */
/* ========================================================================== */

const STAGES = [
  { label: "Drafted", time: "10:15 AM" },
  { label: "In Review", time: "10:24 AM" },
  { label: "Approved", time: "10:31 AM" },
  { label: "Scheduled", time: "Tomorrow" },
];

const REVIEW_DELAYS = [1200, 2200, 2200, 1400, 3400];
const PROGRESS_COUNTS = [1, 2, 2, 3, 4];

export function FeatureCardReview() {
  return (
    <CardContainer
      icon={MessageSquare}
      badge="Team review"
      title="Keep reviews in one place"
      description="Collect comments, approve changes, and schedule posts with your team."
    >
      {({ run }) => <ReviewWorkflowEngine run={run} />}
    </CardContainer>
  );
}

function ReviewWorkflowEngine({ run }: { run: boolean }) {
  const step = useSteps(REVIEW_DELAYS, run, REVIEW_DELAYS.length - 1);
  const currentCount = PROGRESS_COUNTS[step];
  const hasFeedback = step >= 1;
  const isResolved = step >= 2;
  const isApproved = step >= 3;

  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200/90 bg-white shadow-[0_6px_18px_-12px_rgba(15,23,42,0.13)]">
      {/* Document Topbar */}
      <div className="flex h-10 items-center justify-between border-b border-zinc-100 bg-zinc-50/70 px-3.5">
        <div className="flex items-center gap-2">
          <PlatformBadge platform="linkedin" />
          <span className="text-xs font-semibold text-zinc-900">LinkedIn post</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex -space-x-1.5 overflow-hidden">
            <span className="flex size-5.5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white ring-2 ring-white">
              SM
            </span>
            <span className="flex size-5.5 items-center justify-center rounded-full bg-blue-500 text-[10px] font-bold text-white ring-2 ring-white">
              AJ
            </span>
          </div>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold transition-colors ${
              isApproved
                ? "bg-emerald-50 text-emerald-700"
                : "bg-amber-50 text-amber-700"
            }`}
          >
            {isApproved ? "Approved" : "In review"}
          </span>
        </div>
      </div>

      {/* Review Snippet with Live Highlight */}
      <div className="p-3.5">
        <p className="text-xs leading-relaxed text-zinc-800">
          <span
            className={`rounded px-1 py-0.5 transition-colors duration-300 ${
              isResolved
                ? "bg-emerald-50 text-emerald-950 font-semibold"
                : hasFeedback
                ? "bg-amber-100/80 text-amber-950 font-semibold"
                : "bg-transparent font-medium"
            }`}
          >
            {isResolved
              ? "Regular updates help your audience understand what you are building."
              : "Post more often so people can follow your progress."}
          </span>
        </p>

        {/* Inline Thread Card */}
        <div
          className={`mt-3 rounded-xl border p-2.5 transition-all duration-300 ${
            hasFeedback
              ? "border-amber-200/80 bg-amber-50/40 opacity-100"
              : "border-transparent opacity-0 pointer-events-none"
          }`}
        >
          <div className="flex items-center justify-between text-[10px]">
            <div className="flex items-center gap-1.5 font-semibold text-zinc-800">
              <span className="size-1.5 rounded-full bg-amber-500" />
              Sarah M. · Editor
            </div>
            <span className="text-zinc-400">10:24 AM</span>
          </div>
          <p className="mt-1 text-xs text-zinc-700">
            “Can we sharpen the first line for LinkedIn's mobile preview?”
          </p>
          {isResolved && (
            <div className="mt-2 flex items-center justify-between border-t border-amber-200/50 pt-1.5 text-[10.5px]">
              <span className="flex items-center gap-1 font-medium text-emerald-700">
                <CornerDownRight className="size-3 text-emerald-600" />
                Revision accepted
              </span>
              <span className="font-semibold text-emerald-700">Resolved</span>
            </div>
          )}
        </div>
      </div>

      {/* Audit Pipeline Progress Stepper */}
      <div className="border-t border-zinc-100 bg-zinc-50/60 p-3">
        <div className="flex items-center justify-between">
          {STAGES.map((stage, i) => {
            const isDone = i < currentCount;
            const isCurrent = i === currentCount - 1;
            return (
              <React.Fragment key={stage.label}>
                <div className="flex flex-col items-center gap-1">
                  <span
                    style={{ maxWidth: "20px", minHeight: "20px" }}
                    className={`flex !size-5 items-center justify-center rounded-full text-[10px] font-semibold transition-all ${
                      isDone
                        ? "bg-[#3fda8a] !size-5 text-white"
                        : "border border-zinc-300 bg-white text-zinc-400"
                    }`}
                  >
                    {isDone ? <Check className="size-3 stroke-[3]" /> : i + 1}
                  </span>
                  <span
                    className={`text-[9.5px] font-medium ${
                      isCurrent || isDone ? "text-zinc-900 font-semibold" : "text-zinc-400"
                    }`}
                  >
                    {stage.label}
                  </span>
                </div>
                {i < STAGES.length - 1 && (
                  <div className="h-0.5 flex-1 bg-zinc-200 mx-1">
                    <div
                      className="h-full bg-emerald-500 transition-all duration-300"
                      style={{ width: i < currentCount - 1 ? "100%" : "0%" }}
                    />
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
}