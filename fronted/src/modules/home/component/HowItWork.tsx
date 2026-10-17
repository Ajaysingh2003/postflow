"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  AnimatePresence,
  animate,
  motion,
  useInView,
  useMotionValue,
  useReducedMotion,
} from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock3,
  Mic2,
  Pause,
  PenLine,
  Play,
  Send,
  Sparkles,
  WandSparkles,
  type LucideIcon,
} from "lucide-react";
import { PlatformBadge } from "./PlatformBadge";

const ACCENT = "#3fda8a";
const STEP_DURATION = 8;

type Step = {
  number: string;
  title: string;
  description: string;
  label: string;
  icon: LucideIcon;
};

const steps: Step[] = [
  {
    number: "01",
    title: "Shape your voice",
    description:
      "Teach Draftva how you write. Your tone, personality, and style become part of every post you create.",
    label: "Personalize",
    icon: Mic2,
  },
  {
    number: "02",
    title: "Plan your content",
    description:
      "Capture ideas, organize your calendar, and plan what goes out across your social channels.",
    label: "Organize",
    icon: CalendarDays,
  },
  {
    number: "03",
    title: "Create with AI",
    description:
      "Turn rough ideas into compelling posts. Write, refine, and improve your content with your AI copilot.",
    label: "Create",
    icon: WandSparkles,
  },
  {
    number: "04",
    title: "Publish everywhere",
    description:
      "Schedule and share across X, LinkedIn, Threads, and your other connected channels from one place.",
    label: "Publish",
    icon: Send,
  },
];

/* -------------------------------------------------------------------------- */
/*                                COMMON UI                                   */
/* -------------------------------------------------------------------------- */

function MiniLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-subheading text-[10px] font-semibold uppercase tracking-[0.13em] text-neutral-400">
      {children}
    </span>
  );
}

function GreenBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-[#ccebd8] bg-[#edfaf2] px-2.5 py-1 font-subheading text-[10px] font-medium text-[#28794a]">
      <span className="size-1.5 rounded-full bg-[#3fda8a]" />
      {children}
    </span>
  );
}


/* -------------------------------------------------------------------------- */
/*                           PREVIEW 01 — VOICE                               */
/* -------------------------------------------------------------------------- */

type Tone = "Natural" | "Professional" | "Bold";

const voiceExamples: Record<Tone, string> = {
  Natural:
    "The more I build, the more I realize something: simple ideas, executed well, beat complicated plans every time.",
  Professional:
    "Building consistently has taught me an important lesson: thoughtful execution often creates more value than unnecessary complexity.",
  Bold:
    "Stop overthinking your next big idea. Build something useful, ship it, learn from it, and keep moving.",
};

function VoicePreview() {
  const [tone, setTone] = useState<Tone>("Natural");
  const reducedMotion = useReducedMotion();

  return (
    <div className="p-4 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <MiniLabel>WRITING PROFILE</MiniLabel>

          <h3 className="mt-1.5 font-heading text-lg font-semibold tracking-tight text-neutral-900">
            Your writing voice
          </h3>
        </div>

        <GreenBadge>Personalized</GreenBadge>
      </div>

      <div className="mt-6 flex items-center gap-3 rounded-xl border border-neutral-200 bg-white p-3.5 shadow-sm">
        <div className="flex size-10 items-center justify-center rounded-xl bg-[#e0f7e9] font-heading text-sm font-bold text-[#247348]">
          JD
        </div>

        <div className="flex-1">
          <p className="font-heading text-xs font-semibold text-neutral-900">
            Your personal brand
          </p>
          <p className="mt-0.5 font-subheading text-[11px] text-neutral-500">
            Writing profile
          </p>
        </div>

        <CheckCircle2 size={16} className="text-[#2fba6e]" />
      </div>

      <div className="mt-6">
        <MiniLabel>HOW SHOULD IT SOUND?</MiniLabel>

        <div className="mt-3 flex flex-wrap gap-2">
          {(["Natural", "Professional", "Bold"] as Tone[]).map(
            (item) => (
              <button
                key={item}
                type="button"
                onClick={() => setTone(item)}
                aria-pressed={tone === item}
                className={`rounded-lg border px-3 py-2 font-subheading text-xs font-medium transition-colors ${
                  tone === item
                    ? "border-[#92e2b3] bg-[#e9faef] text-[#207548]"
                    : "border-neutral-200 bg-white text-neutral-500 hover:border-neutral-300"
                }`}
              >
                {item}
              </button>
            ),
          )}
        </div>
      </div>

      <div className="mt-5 overflow-hidden rounded-xl border border-[#d9ebdf] bg-[#f3faf5] p-4">
        <div className="flex items-center gap-2">
          <Sparkles size={14} className="text-[#269653]" />

          <span className="font-heading text-[11px] font-semibold text-[#267347]">
            Your voice in action
          </span>
        </div>

        <AnimatePresence mode="wait" initial={false}>
          <motion.p
            key={tone}
            initial={
              reducedMotion
                ? false
                : { opacity: 0, y: 6, filter: "blur(4px)" }
            }
            animate={{
              opacity: 1,
              y: 0,
              filter: "blur(0px)",
            }}
            exit={
              reducedMotion
                ? undefined
                : { opacity: 0, y: -6, filter: "blur(4px)" }
            }
            transition={{ duration: reducedMotion ? 0 : 0.25 }}
            className="mt-3 min-h-[100px] font-subheading text-[13px] leading-[1.8] text-[#304c39]"
          >
            “{voiceExamples[tone]}”
          </motion.p>
        </AnimatePresence>
      </div>

      <div className="mt-5 flex items-center justify-between border-t border-neutral-100 pt-4">
        <span className="font-subheading text-[11px] text-neutral-500">
          Voice profile
        </span>

        <span className="inline-flex items-center gap-1.5 font-heading text-[11px] font-semibold text-[#2e8651]">
          <Check size={13} />
          Ready to use
        </span>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                          PREVIEW 02 — PLANNING                              */
/* -------------------------------------------------------------------------- */

const calendarItems = [
  { day: "Mon", date: "12", title: "Founder story", platform: "LinkedIn" },
  { day: "Tue", date: "13", title: "Quick thought", platform: "X" },
  { day: "Wed", date: "14", title: "Build in public", platform: "Threads" },
  { day: "Thu", date: "15", title: "Growth lesson", platform: "LinkedIn" },
  { day: "Fri", date: "16", title: "Weekly recap", platform: "X" },
] as const;

function CalendarPreview() {
  const [selected, setSelected] = useState(2);

  const item = calendarItems[selected];

  return (
    <div className="p-4 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <MiniLabel>CONTENT CALENDAR</MiniLabel>

          <h3 className="mt-1.5 font-heading text-lg font-semibold tracking-tight text-neutral-900">
            A week of great content
          </h3>
        </div>

        <GreenBadge>5 planned</GreenBadge>
      </div>

      <div className="mt-6 flex items-center justify-between border-b border-neutral-100 pb-4">
        <div>
          <p className="font-heading text-sm font-semibold text-neutral-900">
            October 2026
          </p>

          <p className="mt-1 font-subheading text-[11px] text-neutral-400">
            Your publishing schedule
          </p>
        </div>

        <CalendarDays size={17} className="text-neutral-400" />
      </div>

      <div className="mt-5 grid grid-cols-5 gap-1.5 sm:gap-2">
        {calendarItems.map((day, index) => {
          const active = selected === index;

          return (
            <button
              key={day.day}
              type="button"
              aria-pressed={active}
              onClick={() => setSelected(index)}
              className={`flex min-h-[150px] min-w-0 flex-col items-center rounded-xl border p-1.5 transition-all sm:p-2 ${
                active
                  ? "border-[#82dda7] bg-[#effaf3]"
                  : "border-neutral-200 bg-white hover:border-[#bce8ce]"
              }`}
            >
              <span className="mt-1 font-subheading text-[10px] text-neutral-400">
                {day.day}
              </span>

              <span className="mt-1 font-heading text-base font-semibold text-neutral-900">
                {day.date}
              </span>

              <div
                className={`mt-3 flex w-full flex-1 flex-col items-start rounded-md p-1.5 text-left sm:p-2 ${
                  active ? "bg-[#d9f6e5]" : "bg-neutral-100"
                }`}
              >
                <span
                  className={`mb-2 size-1.5 rounded-full ${
                    active ? "bg-[#259d58]" : "bg-neutral-400"
                  }`}
                />

                <span className="break-words font-subheading text-[9px] font-medium leading-[1.4] text-neutral-700 sm:text-[10px]">
                  {day.title}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-5 rounded-xl border border-neutral-200 bg-white p-4">
        <MiniLabel>SELECTED POST</MiniLabel>

        <div className="mt-3 flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-lg bg-[#eef8f1]">
            <PenLine size={16} className="text-[#269856]" />
          </div>

          <div className="flex-1">
            <p className="font-heading text-xs font-semibold text-neutral-900">
              {item.title}
            </p>

            <p className="mt-1 font-subheading text-[11px] text-neutral-500">
              {item.platform} · October {item.date}
            </p>
          </div>

          <span className="rounded-md bg-[#e9f8ee] px-2 py-1 font-subheading text-[10px] text-[#287448]">
            Planned
          </span>
        </div>
      </div>

      <p className="mt-5 flex items-center gap-2 font-subheading text-[11px] text-neutral-400">
        <CheckCircle2 size={13} className="text-[#36b86f]" />
        Your content, organized in one place
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                           PREVIEW 03 — EDITOR                               */
/* -------------------------------------------------------------------------- */

function EditorPreview() {
  const [improved, setImproved] = useState(false);
  const reducedMotion = useReducedMotion();

  return (
    <div className="p-4 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <MiniLabel>AI WRITING STUDIO</MiniLabel>

          <h3 className="mt-1.5 font-heading text-lg font-semibold tracking-tight text-neutral-900">
            Make every word count
          </h3>
        </div>

        <GreenBadge>Copilot active</GreenBadge>
      </div>

      <div className="mt-5 overflow-hidden rounded-xl border border-neutral-200 bg-white">
        <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-3">
          <div className="flex items-center gap-2">
            <PlatformBadge platform="X" size="lg" />

            <span className="font-heading text-xs font-semibold text-neutral-800">
              New post
            </span>
          </div>

          <span className="font-subheading text-[10px] text-neutral-400">
            Draft
          </span>
        </div>

        <div className="min-h-[150px] p-4">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={improved ? "improved" : "original"}
              initial={
                reducedMotion
                  ? false
                  : { opacity: 0, y: 6, filter: "blur(4px)" }
              }
              animate={{
                opacity: 1,
                y: 0,
                filter: "blur(0px)",
              }}
              exit={
                reducedMotion
                  ? undefined
                  : { opacity: 0, y: -6, filter: "blur(4px)" }
              }
              transition={{ duration: reducedMotion ? 0 : 0.25 }}
              className="font-subheading text-[13px] leading-[1.85] text-neutral-700"
            >
              {improved ? (
                <>
                  <p>You don't need more ideas.</p>

                  <p>You need a better way to share them.</p>

                  <p className="mt-3">
                    The secret to growing online isn't posting more.
                    It's consistently saying something worth reading.
                  </p>
                </>
              ) : (
                <>
                  <p>
                    I think building a personal brand is important.
                    People should post content regularly.
                  </p>

                  <p className="mt-3">
                    Having good ideas and sharing them can help
                    you grow your audience.
                  </p>
                </>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="flex items-center justify-between border-t border-neutral-100 px-4 py-3">
          <span className="font-subheading text-[10px] text-neutral-400">
            Writing in your voice
          </span>

          <Check size={13} className="text-[#31ab63]" />
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-[#c7ead4] bg-[#f0faf4] p-4">
        <div className="flex items-start gap-3">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-white text-[#259452]">
            <Sparkles size={15} />
          </div>

          <div className="flex-1">
            <p className="font-heading text-xs font-semibold text-[#235b36]">
              Draftva Copilot
            </p>

            <p className="mt-2 font-subheading text-[11px] leading-relaxed text-[#5a7964]">
              {improved
                ? "Your opening is sharper and the message is clearer."
                : "Your idea is good. Let's make the opening more engaging."}
            </p>

            <button
              type="button"
              onClick={() => setImproved((value) => !value)}
              className="mt-3 inline-flex items-center gap-2 rounded-lg bg-[#183c27] px-3 py-2 font-heading text-[11px] font-semibold text-white transition-colors hover:bg-[#28563a]"
            >
              {improved ? (
                <>
                  <ArrowLeft size={12} />
                  Undo change
                </>
              ) : (
                <>
                  <WandSparkles size={12} />
                  Improve writing
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                          PREVIEW 04 — PUBLISH                               */
/* -------------------------------------------------------------------------- */

type Platform = "X" | "LinkedIn" | "Threads";

function PublishPreview() {
  const [selected, setSelected] = useState<Platform[]>([
    "X",
    "LinkedIn",
    "Threads",
  ]);

  const [scheduled, setScheduled] = useState(false);

  const platforms: Platform[] = ["X", "LinkedIn", "Threads"];

  function toggle(platform: Platform) {
    setScheduled(false);

    setSelected((current) =>
      current.includes(platform)
        ? current.filter((value) => value !== platform)
        : [...current, platform],
    );
  }

  return (
    <div className="p-4 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <MiniLabel>PUBLISHING WORKSPACE</MiniLabel>

          <h3 className="mt-1.5 font-heading text-lg font-semibold tracking-tight text-neutral-900">
            One post. Every channel.
          </h3>
        </div>

        <GreenBadge>{scheduled ? "Scheduled" : "Ready"}</GreenBadge>
      </div>

      <div className="mt-6 rounded-xl border border-neutral-200 bg-white p-4">
        <div className="flex items-center justify-between">
          <MiniLabel>YOUR CHANNELS</MiniLabel>

          <span className="font-subheading text-[10px] text-neutral-400">
            {selected.length} selected
          </span>
        </div>

        <div className="mt-4 space-y-2">
          {platforms.map((platform) => {
            const active = selected.includes(platform);

            return (
              <button
                key={platform}
                type="button"
                aria-pressed={active}
                onClick={() => toggle(platform)}
                className={`flex w-full items-center gap-3 rounded-lg border p-2.5 text-left transition-colors ${
                  active
                    ? "border-[#d7ebde] bg-[#f5fbf7]"
                    : "border-neutral-100 bg-white hover:bg-neutral-50"
                }`}
              >
                <PlatformBadge platform={platform} size="lg" />

                <span className="flex-1 font-heading text-xs font-semibold text-neutral-800">
                  {platform}
                </span>

                <span
                  className={`flex size-[18px] items-center justify-center rounded-[5px] border ${
                    active
                      ? "border-[#3fda8a] bg-[#3fda8a] text-[#123d24]"
                      : "border-neutral-300 bg-white"
                  }`}
                >
                  {active && <Check size={12} strokeWidth={2.5} />}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-4 flex items-center gap-3 rounded-xl border border-neutral-200 bg-white p-3.5">
        <div className="flex size-9 items-center justify-center rounded-lg bg-neutral-100">
          <CalendarDays size={16} className="text-neutral-600" />
        </div>

        <div className="flex-1">
          <p className="font-heading text-xs font-semibold text-neutral-900">
            Tomorrow
          </p>

          <p className="mt-1 font-subheading text-[11px] text-neutral-500">
            9:30 AM · Your timezone
          </p>
        </div>

        <Clock3 size={15} className="text-neutral-400" />
      </div>

      <button
        type="button"
        disabled={selected.length === 0}
        onClick={() => setScheduled((value) => !value)}
        className={`mt-4 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 font-heading text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
          scheduled
            ? "bg-[#e8f8ee] text-[#277a48]"
            : "bg-[#3fda8a] text-[#12351f] hover:bg-[#68e7a1]"
        }`}
      >
        {scheduled ? (
          <>
            <CheckCircle2 size={15} />
            Scheduled in demo
          </>
        ) : (
          <>
            <Send size={14} />
            Schedule {selected.length}{" "}
            {selected.length === 1 ? "channel" : "channels"}
          </>
        )}
      </button>

      <p className="mt-3 text-center font-subheading text-[10px] text-neutral-400">
        Interactive preview — no actual post is scheduled
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                            PREVIEW CONTAINER                               */
/* -------------------------------------------------------------------------- */

const previewComponents = [
  VoicePreview,
  CalendarPreview,
  EditorPreview,
  PublishPreview,
];

function PreviewStage({
  activeStep,
  onNext,
  onPrevious,
}: {
  activeStep: number;
  onNext: () => void;
  onPrevious: () => void;
}) {
  const reducedMotion = useReducedMotion();

  const ActivePreview = previewComponents[activeStep];

  return (
    <div className="relative flex h-full min-w-0 flex-col overflow-hidden rounded-[24px] border border-[#1c3425] bg-[#111d16] p-3 shadow-[0_24px_65px_-34px_rgba(18,63,35,0.45)] sm:p-5">
      {/* Subtle background glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-28 -top-28 size-80 rounded-full bg-[#3fda8a]/10 blur-[85px]"
      />

      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-24 -left-28 size-72 rounded-full bg-[#3fda8a]/10 blur-[80px]"
      />

      {/* Heading */}
      <div className="relative z-10 mb-4 flex items-center justify-between px-1">
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-lg bg-[#3fda8a] font-heading text-lg font-bold text-[#12351f]">
            d
          </div>

          <div>
            <p className="font-heading text-xs font-semibold text-white">
              draftva
            </p>

            <p className="font-subheading text-[10px] text-white/40">
              Interactive walkthrough
            </p>
          </div>
        </div>

        <span className="flex items-center gap-2 font-subheading text-[10px] text-white/50">
          <span className="size-1.5 rounded-full bg-[#3fda8a]" />
          Live preview
        </span>
      </div>

      {/* Main application window */}
      <div
        id="draftva-preview"
        role="region"
        aria-label={`${steps[activeStep].title} demonstration`}
        className="relative z-10 flex min-h-[485px] min-w-0 flex-1 flex-col overflow-hidden rounded-[17px] border border-white/10 bg-[#fcfdfb] shadow-xl"
      >
        {/* Browser header */}
        <div className="flex h-11 shrink-0 items-center justify-between border-b border-neutral-200/80 bg-white px-4">
          <div className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-neutral-200" />
            <span className="size-2 rounded-full bg-neutral-200" />
            <span className="size-2 rounded-full bg-neutral-200" />
          </div>

          <div className="flex items-center gap-2 rounded-md bg-[#f5f7f5] px-3 py-1">
            <span className="size-1.5 rounded-full bg-[#3fda8a]" />

            <span className="font-subheading text-[10px] text-neutral-500">
              app.draftva.com
            </span>
          </div>

          <span className="size-4" />
        </div>

        {/* Animated preview content */}
        <div className="relative min-h-[440px] flex-1">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={activeStep}
              initial={
                reducedMotion
                  ? false
                  : {
                      opacity: 0,
                      y: 12,
                      scale: 0.985,
                      filter: "blur(6px)",
                    }
              }
              animate={{
                opacity: 1,
                y: 0,
                scale: 1,
                filter: "blur(0px)",
              }}
              exit={
                reducedMotion
                  ? undefined
                  : {
                      opacity: 0,
                      y: -8,
                      scale: 0.99,
                      filter: "blur(5px)",
                    }
              }
              transition={{
                duration: reducedMotion ? 0 : 0.4,
                ease: [0.22, 1, 0.36, 1],
              }}
              className="absolute inset-0 overflow-y-auto"
            >
              <ActivePreview />
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Footer navigation */}
      <div className="relative z-10 flex items-center justify-between gap-3 px-1 pt-4">
        <div>
          <p className="font-heading text-xs font-semibold text-white">
            {steps[activeStep].title}
          </p>

          <p className="mt-1 font-subheading text-[10px] text-white/40">
            Step {steps[activeStep].number} of 04
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onPrevious}
            aria-label="Previous step"
            className="flex size-9 items-center justify-center rounded-full border border-white/15 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
          >
            <ArrowLeft size={15} />
          </button>

          <button
            type="button"
            onClick={onNext}
            aria-label="Next step"
            className="flex size-9 items-center justify-center rounded-full bg-[#3fda8a] text-[#133720] transition-colors hover:bg-[#6ae6a0]"
          >
            <ArrowRight size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                            HOW IT WORKS                                    */
/* -------------------------------------------------------------------------- */

export default function HowItWork() {
  const [activeStep, setActiveStep] = useState(0);

  // Used to restart the timer when clicking an already-active step.
  const [cycleKey, setCycleKey] = useState(0);

  const [isHovered, setIsHovered] = useState(false);
  const [isKeyboardFocused, setIsKeyboardFocused] = useState(false);
  const [isManuallyPaused, setIsManuallyPaused] = useState(false);
  const [isPageHidden, setIsPageHidden] = useState(false);

  const sectionRef = useRef<HTMLElement>(null);

  const animationRef = useRef<{
    pause: () => void;
    play: () => void;
    stop: () => void;
  } | null>(null);

  const progress = useMotionValue(0);

  const reducedMotion = useReducedMotion();

  const isInView = useInView(sectionRef, {
    amount: 0.25,
    once: false,
  });

  const isPaused =
    isHovered ||
    isKeyboardFocused ||
    isManuallyPaused ||
    isPageHidden ||
    !isInView;

  /* ---------------------------------------------------------------------- */
  /*                         PAGE VISIBILITY                                */
  /* ---------------------------------------------------------------------- */

  useEffect(() => {
    const updateVisibility = () => {
      setIsPageHidden(document.hidden);
    };

    updateVisibility();

    document.addEventListener("visibilitychange", updateVisibility);

    return () => {
      document.removeEventListener(
        "visibilitychange",
        updateVisibility,
      );
    };
  }, []);

  /* ---------------------------------------------------------------------- */
  /*                        AUTO ADVANCE TIMER                              */
  /* ---------------------------------------------------------------------- */

  useEffect(() => {
    progress.set(0);

    // Respect accessibility preferences.
    // Users requesting reduced motion can navigate manually.
    if (reducedMotion) {
      progress.set(1);
      return;
    }

    const controls = animate(progress, 1, {
      duration: STEP_DURATION,
      ease: "linear",

      onComplete: () => {
        setActiveStep((current) => (current + 1) % steps.length);
      },
    });

    animationRef.current = controls;

    if (isPaused) {
      controls.pause();
    }

    return () => {
      controls.stop();

      if (animationRef.current === controls) {
        animationRef.current = null;
      }
    };

    // Restart only on step changes or explicit cycle resets.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeStep, cycleKey, reducedMotion, progress]);

  /* ---------------------------------------------------------------------- */
  /*                     PAUSE / RESUME PROGRESS                            */
  /* ---------------------------------------------------------------------- */

  useEffect(() => {
    const controls = animationRef.current;

    if (!controls || reducedMotion) return;

    if (isPaused) {
      controls.pause();
    } else {
      controls.play();
    }
  }, [isPaused, activeStep, cycleKey, reducedMotion]);

  /* ---------------------------------------------------------------------- */
  /*                           NAVIGATION                                   */
  /* ---------------------------------------------------------------------- */

  const selectStep = (index: number) => {
    setActiveStep(index);
    setCycleKey((current) => current + 1);
  };

  const nextStep = () => {
    selectStep((activeStep + 1) % steps.length);
  };

  const previousStep = () => {
    selectStep(
      (activeStep - 1 + steps.length) % steps.length,
    );
  };

  /* ---------------------------------------------------------------------- */
  /*                               RENDER                                   */
  /* ---------------------------------------------------------------------- */

  return (
    <section
      ref={sectionRef}
      id="how-it-works"
      className="relative w-full overflow-hidden py-20 sm:py-24 lg:py-28"
    >
      <div className="mx-auto max-w-[1240px] px-5 sm:px-8 lg:px-10">
        {/* ================================================================ */}
        {/* HEADER                                                           */}
        {/* ================================================================ */}

        <div className="mb-12 flex flex-col items-center text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-3.5 py-1.5 shadow-sm">
            <span className="size-1.5 rounded-full bg-[#3fda8a]" />

            <span className="font-heading text-xs font-semibold text-neutral-800">
              How it works
            </span>

            <span className="text-neutral-300">·</span>

            <span className="font-subheading text-xs text-neutral-500">
              Four simple steps
            </span>
          </div>

          <h2 className="mt-5 max-w-[780px] font-heading text-3xl font-semibold leading-[1.12] tracking-[-0.045em] text-[#152019] sm:text-4xl lg:text-[52px]">
            From your first idea to
            <br className="hidden sm:block" /> your{" "}
            <span className="relative inline-block whitespace-nowrap">
              <span className="relative z-10">next big post.</span>

              <span
                aria-hidden="true"
                className="absolute bottom-1 left-0 right-0 h-3 rounded bg-[#3fda8a]/30"
              />
            </span>
          </h2>

          <p className="mt-5 max-w-[560px] font-subheading text-sm leading-[1.8] text-neutral-500 sm:text-[15px]">
            One connected workflow to find your voice, create better
            content, and grow your presence across every channel.
          </p>
        </div>

        {/* ================================================================ */}
        {/* WORKFLOW                                                         */}
        {/* ================================================================ */}

        <div
          className="grid grid-cols-1 items-stretch gap-5 lg:grid-cols-[0.85fr_1.15fr] lg:gap-7"
          onPointerEnter={(event) => {
            if (event.pointerType === "mouse") {
              setIsHovered(true);
            }
          }}
          onPointerLeave={(event) => {
            if (event.pointerType === "mouse") {
              setIsHovered(false);
            }
          }}
          onFocusCapture={(event) => {
            // Pause for keyboard navigation, not ordinary touch taps.
            if (
              event.target instanceof HTMLElement &&
              event.target.matches(":focus-visible")
            ) {
              setIsKeyboardFocused(true);
            }
          }}
          onBlurCapture={(event) => {
            if (
              !event.currentTarget.contains(
                event.relatedTarget as Node | null,
              )
            ) {
              setIsKeyboardFocused(false);
            }
          }}
        >
          {/* ============================================================ */}
          {/* LEFT: AUTO-ADVANCING ACCORDION                                */}
          {/* ============================================================ */}

          <div className="flex min-w-0 flex-col overflow-hidden rounded-[22px] border border-neutral-200 bg-white shadow-[0_8px_35px_-20px_rgba(0,0,0,0.12)]">
            {/* Accordion header */}
            <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-4 sm:px-6">
              <span className="font-heading text-xs font-semibold text-[#25362a]">
                Your creative workflow
              </span>

              <button
                type="button"
                onClick={() => {
                  setIsManuallyPaused((value) => !value);
                }}
                aria-label={
                  isManuallyPaused
                    ? "Resume automatic walkthrough"
                    : "Pause automatic walkthrough"
                }
                aria-pressed={isManuallyPaused}
                disabled={!!reducedMotion}
                className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 font-subheading text-[11px] text-neutral-400 transition-colors hover:bg-neutral-50 hover:text-neutral-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isManuallyPaused || reducedMotion ? (
                  <Play size={12} />
                ) : (
                  <Pause size={12} />
                )}

                {reducedMotion
                  ? "Manual"
                  : isManuallyPaused
                    ? "Resume"
                    : "Pause"}
              </button>
            </div>

            {/* Steps */}
            <div className="flex flex-1 flex-col">
              {steps.map((step, index) => {
                const active = activeStep === index;
                const Icon = step.icon;

                return (
                  <div
                    key={step.number}
                    className={`relative flex flex-1 flex-col border-b border-neutral-100 last:border-b-0 transition-colors duration-300 ${
                      active
                        ? "bg-[#f7fcf8]"
                        : "bg-white hover:bg-neutral-50/70"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => selectStep(index)}
                      aria-expanded={active}
                      aria-controls={`draftva-step-details-${index}`}
                      className="group flex w-full items-start gap-3.5 px-4 py-4 text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#3fda8a] sm:gap-4 sm:px-5 sm:py-5"
                    >
                      {/* Icon */}
                      <div
                        className={`flex size-10 shrink-0 items-center justify-center rounded-xl border transition-all duration-300 ${
                          active
                            ? "border-[#97e5b6] bg-[#3fda8a] text-[#143d25]"
                            : "border-neutral-200 bg-[#f9faf9] text-neutral-400 group-hover:border-neutral-300 group-hover:text-neutral-700"
                        }`}
                      >
                        <Icon size={18} strokeWidth={1.8} />
                      </div>

                      {/* Title */}
                      <div className="min-w-0 flex-1 pt-0.5">
                        <span
                          className={`font-subheading text-[10px] font-semibold uppercase tracking-[0.12em] ${
                            active
                              ? "text-[#28844a]"
                              : "text-neutral-400"
                          }`}
                        >
                          {step.label}
                        </span>

                        <h3
                          className={`mt-1 font-heading text-[15px] font-semibold tracking-[-0.02em] transition-colors sm:text-base ${
                            active
                              ? "text-[#17321f]"
                              : "text-neutral-700"
                          }`}
                        >
                          {step.title}
                        </h3>
                      </div>

                      {/* Step number */}
                      <span
                        className={`pt-1 font-heading text-xs font-semibold tabular-nums ${
                          active
                            ? "text-[#28884d]"
                            : "text-neutral-300"
                        }`}
                      >
                        {step.number}
                      </span>
                    </button>

                    {/* Animated description */}
                    <AnimatePresence initial={false}>
                      {active && (
                        <motion.div
                          id={`draftva-step-details-${index}`}
                          key={`description-${index}`}
                          initial={
                            reducedMotion
                              ? false
                              : {
                                  height: 0,
                                  opacity: 0,
                                }
                          }
                          animate={{
                            height: "auto",
                            opacity: 1,
                          }}
                          exit={{
                            height: 0,
                            opacity: 0,
                          }}
                          transition={{
                            height: {
                              duration: reducedMotion ? 0 : 0.38,
                              ease: [0.22, 1, 0.36, 1],
                            },
                            opacity: {
                              duration: reducedMotion ? 0 : 0.22,
                            },
                          }}
                          className="overflow-hidden"
                        >
                          <motion.div
                            initial={
                              reducedMotion
                                ? false
                                : { y: 8, opacity: 0 }
                            }
                            animate={{ y: 0, opacity: 1 }}
                            exit={
                              reducedMotion
                                ? undefined
                                : { y: -4, opacity: 0 }
                            }
                            transition={{
                              duration: reducedMotion ? 0 : 0.3,
                              delay: reducedMotion ? 0 : 0.05,
                            }}
                            className="pb-5 pl-[72px] pr-5 sm:pl-[80px]"
                          >
                            <p className="max-w-[345px] font-subheading text-[13px] leading-[1.75] text-neutral-500">
                              {step.description}
                            </p>

                            <div className="mt-3 inline-flex items-center gap-1.5 font-heading text-[11px] font-semibold text-[#2c9958]">
                              Explore this step
                              <ArrowUpRight size={13} />
                            </div>
                          </motion.div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Animated progress line */}
                    <div className="absolute bottom-0 left-0 right-0 h-[2px] overflow-hidden bg-transparent">
                      <motion.div
                        style={{
                          scaleX: active ? progress : 0,
                          transformOrigin: "left center",
                          backgroundColor: ACCENT,
                        }}
                        className="h-full w-full"
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Accordion footer */}
            <div className="flex items-center justify-between gap-3 border-t border-neutral-100 bg-[#fcfdfc] px-5 py-3.5">
              <div className="flex items-center gap-2">
                <span
                  className={`size-1.5 rounded-full ${
                    isPaused ? "bg-amber-400" : "bg-[#3fda8a]"
                  }`}
                />

                <span className="font-subheading text-[11px] text-neutral-500">
                  {reducedMotion
                    ? "Manual walkthrough"
                    : isPaused
                      ? "Preview paused"
                      : "Auto-playing preview"}
                </span>
              </div>

              <span className="font-heading text-[11px] font-semibold tabular-nums text-neutral-400">
                {String(activeStep + 1).padStart(2, "0")} / 04
              </span>
            </div>
          </div>

          {/* ============================================================ */}
          {/* RIGHT: ANIMATED PRODUCT PREVIEW                               */}
          {/* ============================================================ */}

          <div className="min-w-0">
            <PreviewStage
              activeStep={activeStep}
              onNext={nextStep}
              onPrevious={previousStep}
            />
          </div>
        </div>

        {/* ================================================================ */}
        {/* CTA                                                              */}
        {/* ================================================================ */}

        <div className="mt-12 flex flex-col items-center justify-between gap-5 border-t border-neutral-200 pt-7 text-center sm:mt-14 sm:flex-row sm:text-left">
          <div>
            <p className="font-heading text-[15px] font-semibold text-[#192b20]">
              Your next great post starts here.
            </p>

            <p className="mt-1 font-subheading text-xs text-neutral-500">
              One workspace for everything you create and share.
            </p>
          </div>

          <a
            href="#pricing"
            className="group inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#3fda8a] px-5 font-heading text-xs font-semibold text-[#12351f] transition-all hover:-translate-y-0.5 hover:bg-[#69e8a2]"
          >
            Get started with Draftva

            <ArrowUpRight
              size={15}
              className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
            />
          </a>
        </div>
      </div>
    </section>
  );
}