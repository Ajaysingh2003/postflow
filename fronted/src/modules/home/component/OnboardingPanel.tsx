"use client";

import { useEffect, useState } from "react";
import {
  AnimatePresence,
  MotionConfig,
  motion,
  useReducedMotion,
  type Variants,
} from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronDown,
  Hash,
  Image as ImageIcon,
  Loader2,
  ShieldCheck,
  Smile,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  CHANNELS,
  type ChannelConfig,
} from "@/modules/channels/channel-config";
import ChannelIcon from "@/modules/channels/component/ChannelIcon";
import type { Account } from "@/modules/studio/types";
import OnboardingShell from "./OnboardingShell";

export type OnboardingStep = "welcome" | "connect";
export const ONBOARDING_CHANNELS = CHANNELS.filter(
  (channel) => !channel.comingSoon,
);

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

/* ---------- motion ---------- */

const sequence: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.04 } },
};
const fadeUp: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: EASE } },
};
const frame: Variants = {
  hidden: { opacity: 0, scale: 0.96 },
  show: { opacity: 1, scale: 1, transition: { duration: 0.65, ease: EASE } },
};
const tileGroup: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.045, delayChildren: 0.18 } },
};
const pop: Variants = {
  hidden: { opacity: 0, scale: 0.8 },
  show: {
    opacity: 1,
    scale: 1,
    transition: { type: "spring", stiffness: 420, damping: 24 },
  },
};

/* ---------- decorative draft preview ---------- */

const SAMPLE = "Turning ideas into momentum.";

function useTypewriter(text: string, startDelay = 850) {
  const reduce = useReducedMotion();
  const [count, setCount] = useState(reduce ? text.length : 0);

  useEffect(() => {
    if (reduce) {
      setCount(text.length);
      return;
    }
    let interval: ReturnType<typeof setInterval> | undefined;
    const start = setTimeout(() => {
      interval = setInterval(() => {
        setCount((c) => {
          if (c >= text.length) {
            if (interval) clearInterval(interval);
            return c;
          }
          return c + 1;
        });
      }, 42);
    }, startDelay);
    return () => {
      clearTimeout(start);
      if (interval) clearInterval(interval);
    };
  }, [reduce, text, startDelay]);

  return count;
}

/**
 * Responsive miniature composer preview:
 * Adapts tile sizes, paddings, and toolbar spacing down to 320px phones.
 */
function DraftPreview({ accounts }: { accounts: Account[] }) {
  const connected = new Set<string>(
    accounts
      .filter((account) => account.status === "active")
      .map((account) => account.platform),
  );
  const fallbackId = ONBOARDING_CHANNELS[0]?.id;
  const typed = useTypewriter(SAMPLE);
  const done = typed >= SAMPLE.length;

  return (
    <motion.div
      aria-hidden="true"
      variants={fadeUp}
      className="relative mx-auto mt-9 w-full max-w-[480px] select-none text-left sm:mt-14"
    >
      {/* Offset stacked green backplates (tablet/desktop only so mobile never overflows horizontally) */}
      <motion.span
        variants={frame}
        className="pointer-events-none absolute -right-4 -top-4 bottom-4 left-5 hidden rounded-[26px] border border-brand-primary/25 bg-brand-primary/[0.04] sm:block"
      />
      <motion.span
        variants={frame}
        className="pointer-events-none absolute -right-2 -top-2 bottom-2 left-2.5 hidden rounded-[26px] border border-brand-primary/40 bg-brand-primary/[0.07] sm:block"
      />

      {/* Outer translucent board */}
      <div className="relative rounded-2xl border border-brand-primary/45 bg-[#f3fbf6] p-2.5 shadow-[0_16px_40px_-15px_rgba(16,40,28,0.08)] sm:rounded-[24px] sm:p-4 dark:border-border dark:bg-card/90">
        {/* Channel tiles strip */}
        <motion.div
          variants={tileGroup}
          className="flex flex-wrap items-center gap-1.5 sm:gap-2"
        >
          {ONBOARDING_CHANNELS.map((channel) => {
            const isConnected = connected.has(channel.id);
            const selected = connected.size
              ? isConnected
              : channel.id === fallbackId;
            return (
              <motion.span
                key={channel.id}
                variants={pop}
                className="relative flex size-9 items-center justify-center rounded-lg border border-black/[0.06] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.03)] sm:size-11 sm:rounded-xl dark:border-border dark:bg-background"
              >
                <ChannelIcon channel={channel} small />
                <AnimatePresence>
                  {selected && (
                    <motion.span
                      key="ring"
                      initial={{ opacity: 0, scale: 0.85 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.85 }}
                      transition={{
                        type: "spring",
                        stiffness: 400,
                        damping: 24,
                      }}
                      className="pointer-events-none absolute -inset-0.5 rounded-[10px] border-2 border-brand-primary bg-brand-primary/[0.05] sm:-inset-1 sm:rounded-[14px]"
                    />
                  )}
                </AnimatePresence>
                <AnimatePresence>
                  {isConnected && (
                    <motion.span
                      key="badge"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      exit={{ scale: 0 }}
                      transition={{
                        type: "spring",
                        stiffness: 500,
                        damping: 20,
                      }}
                      className="absolute -right-1 -top-1 flex size-3.5 items-center justify-center rounded-full bg-brand-primary text-black shadow-2xs sm:-right-1.5 sm:-top-1.5 sm:size-4"
                    >
                      <Check className="size-2 sm:size-2.5" strokeWidth={3} />
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.span>
            );
          })}
        </motion.div>

        {/* Inner white composer card */}
        <div className="relative mt-2.5 rounded-xl border border-black/[0.06] bg-white p-3.5 shadow-[0_4px_16px_rgba(0,0,0,0.03)] sm:mt-3 sm:rounded-2xl sm:p-5 dark:border-border dark:bg-card">
          <div className="flex flex-wrap items-center justify-between gap-1.5">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#eef5f0] px-2 py-0.5 text-[10px] font-medium text-neutral-600 sm:px-2.5 sm:py-1 sm:text-[11px] dark:bg-muted dark:text-muted-foreground">
              <span className="size-1.5 rounded-full bg-brand-primary" />
              Post draft
            </span>

            {/* Status badge */}
            <AnimatePresence mode="wait" initial={false}>
              {done ? (
                <motion.span
                  key="scheduled"
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  transition={{ duration: 0.2 }}
                  className="inline-flex items-center gap-1 rounded-full border border-black/[0.06] bg-white px-2 py-0.5 text-[10px] font-medium text-emerald-700 shadow-2xs sm:gap-1.5 sm:px-2.5 sm:py-1 sm:text-[11px] dark:border-border dark:bg-background dark:text-emerald-400"
                >
                  <Check className="size-3 shrink-0" strokeWidth={2.5} />
                  <span>
                    Scheduled{" "}
                    <span className="hidden min-[380px]:inline">
                      · Tue, 9:00 AM
                    </span>
                  </span>
                </motion.span>
              ) : (
                <motion.span
                  key="writing"
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  transition={{ duration: 0.2 }}
                  className="inline-flex items-center gap-1 rounded-full border border-black/[0.06] bg-white px-2 py-0.5 text-[10px] font-medium text-neutral-600 shadow-2xs sm:gap-1.5 sm:px-2.5 sm:py-1 sm:text-[11px] dark:border-border dark:bg-background dark:text-muted-foreground"
                >
                  <motion.span
                    animate={{ rotate: 360 }}
                    transition={{
                      repeat: Infinity,
                      duration: 3,
                      ease: "linear",
                    }}
                    className="flex"
                  >
                    <Sparkles className="size-3 text-brand-primary" />
                  </motion.span>
                  AI is writing…
                </motion.span>
              )}
            </AnimatePresence>
          </div>

          <p className="mt-3.5 min-h-[2.5rem] font-heading text-lg leading-snug tracking-tight text-neutral-900 sm:mt-4 sm:min-h-[2.75rem] sm:text-[22px] dark:text-foreground">
            {SAMPLE.slice(0, typed)}
            <span className="ml-0.5 inline-block h-4 w-0.5 translate-y-0.5 bg-brand-primary motion-safe:animate-pulse sm:h-5 sm:translate-y-1" />
          </p>

          {/* Composer toolbar + split Schedule button */}
          <div className="mt-4 flex items-center justify-between gap-2 border-t border-black/[0.06] pt-3 sm:mt-5 sm:pt-3.5 dark:border-border">
            <div className="flex items-center gap-1 sm:gap-1.5">
              {[ImageIcon, Smile, Hash, Sparkles].map((Icon, idx) => (
                <span
                  key={idx}
                  className="flex size-6.5 items-center justify-center rounded-md border border-black/[0.06] bg-neutral-50 text-neutral-500 sm:size-7 sm:rounded-lg dark:border-border dark:bg-muted dark:text-muted-foreground"
                >
                  <Icon className="size-3 sm:size-3.5" strokeWidth={1.75} />
                </span>
              ))}
            </div>

            <motion.span
            style={{minHeight:"12px",padding:"5px"}}
              animate={done ? { scale: [1, 1.04, 1] } : { scale: 1 }}
              transition={{ duration: 0.45, ease: EASE }}
              className="inline-flex secondary-btn h-7.5 shrink-0 items-center rounded-full bg-brand-primary text-[11px] font-semibold text-black shadow-[0_2px_8px_rgba(63,218,138,0.35)] sm:h-8 sm:text-xs"
            >
              <span className="pl-3 pr-2 sm:pl-3.5 sm:pr-2.5">Schedule</span>
              <span className="flex h-3.5 items-center border-l border-black/15 pr-2 pl-1 sm:h-4 sm:pr-2.5 sm:pl-1.5">
                <ChevronDown className="size-3" strokeWidth={2.2} />
              </span>
            </motion.span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/* ---------- helpers ---------- */

function hintFor(channel: ChannelConfig) {
  if (channel.id === "instagram") return "Business or Creator";
  if (channel.id === "facebook") return "Pages";
  return "Connect";
}

type Props = {
  name: string;
  step: OnboardingStep;
  accounts: Account[];
  canConnect: boolean;
  connectingPlatform: string | null;
  finishing: boolean;
  error?: string;
  onStep: (step: OnboardingStep) => void;
  onConnect: (channel: ChannelConfig) => void;
  onFinish: () => void;
};

export default function OnboardingPanel({
  name,
  step,
  accounts,
  canConnect,
  connectingPlatform,
  finishing,
  error,
  onStep,
  onConnect,
  onFinish,
}: Props) {
  const busy = finishing || !!connectingPlatform;
  const activeCount = accounts.filter(
    (account) => account.status === "active",
  ).length;
  const firstName = name.trim().split(/\s+/)[0] || "there";
  const ready = activeCount > 0 || !canConnect;

  return (
    <MotionConfig reducedMotion="user">
      <OnboardingShell
        action={
          <button
            type="button"
            onClick={onFinish}
            disabled={busy}
            className="rounded-lg px-2 py-1 text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50"
          >
            Skip setup{" "}
            <ArrowUpRight aria-hidden="true" className="ml-1 inline size-3" />
          </button>
        }
      >
        <section
          aria-labelledby="onboarding-heading"
          className="mx-auto w-full max-w-2xl px-1 text-center sm:px-0"
        >
          {/* Progress */}
          <div className="mb-6 flex items-center justify-center gap-3 sm:mb-10">
            <div aria-hidden="true" className="flex gap-1.5">
              <span className="h-1 w-7 rounded-full bg-brand-primary sm:w-8" />
              <span className="relative h-1 w-7 overflow-hidden rounded-full bg-border sm:w-8">
                <motion.span
                  initial={false}
                  animate={{ scaleX: step === "connect" ? 1 : 0 }}
                  transition={{ duration: 0.4, ease: EASE }}
                  className="absolute inset-0 origin-left rounded-full bg-brand-primary"
                />
              </span>
            </div>
            <span className="text-xs text-muted-foreground">
              Step {step === "welcome" ? 1 : 2} of 2
            </span>
          </div>

          <motion.div
            key={step}
            variants={sequence}
            initial="hidden"
            animate="show"
          >
            {step === "welcome" ? (
              <>
                <motion.h1
                  variants={fadeUp}
                  id="onboarding-heading"
                  tabIndex={-1}
                  className="mx-auto max-w-xl font-heading text-[clamp(1.85rem,6vw,3.1rem)] leading-[1.08] tracking-tight text-balance outline-none"
                >
                  Hi {firstName}, let’s get your first post scheduled.
                </motion.h1>
                <motion.p
                  variants={fadeUp}
                  className="mx-auto mt-3.5 max-w-md text-sm leading-relaxed text-muted-foreground text-pretty sm:mt-5 sm:text-base"
                >
                  Connect an account and you can write, schedule and publish
                  from one place. It takes about a minute.
                </motion.p>
                <motion.div
                  variants={fadeUp}
                  whileTap={{ scale: 0.98 }}
                  className="mt-6 inline-block w-full sm:mt-8 sm:w-auto"
                >
                  <Button
                  style={{minHeight:"10px"}}
                    onClick={() => onStep("connect")}
                    disabled={busy}
                    className="primary-btn h-10 w-full gap-2 rounded-lg px-7 text-sm sm:h-10 sm:w-auto"
                  >
                    Connect an account
                    <ArrowRight aria-hidden="true" className="size-4" />
                  </Button>
                </motion.div>
                <DraftPreview accounts={accounts} />
              </>
            ) : (
              <>
                <motion.h1
                  variants={fadeUp}
                  id="onboarding-heading"
                  tabIndex={-1}
                  className="font-heading text-[clamp(1.75rem,5.5vw,2.75rem)] leading-[1.1] tracking-tight text-balance outline-none"
                >
                  Where do you post?
                </motion.h1>
                <motion.p
                  variants={fadeUp}
                  className="mx-auto mt-2.5 max-w-sm text-xs leading-relaxed text-muted-foreground sm:mt-3 sm:text-sm"
                >
                  Connect one to start. You can add more anytime in Channels.
                </motion.p>

                {canConnect ? (
                  <ul className="mt-6 grid grid-cols-1 gap-2.5 text-left min-[420px]:grid-cols-2 sm:mt-10 sm:grid-cols-3 sm:gap-3">
                    {ONBOARDING_CHANNELS.map((channel) => {
                      const matches = accounts.filter(
                        (account) => account.platform === channel.id,
                      );
                      const active = matches.find(
                        (account) => account.status === "active",
                      );
                      const reconnect =
                        !active &&
                        matches.some(
                          (account) => account.status === "needs_reauth",
                        );
                      const connecting = connectingPlatform === channel.id;
                      const interactive = !busy && !active;
                      return (
                        <motion.li key={channel.id} variants={fadeUp}>
                          <motion.button
                            type="button"
                            disabled={busy || !!active}
                            onClick={() => onConnect(channel)}
                            whileHover={interactive ? { y: -2 } : undefined}
                            whileTap={interactive ? { scale: 0.98 } : undefined}
                            transition={{
                              type: "spring",
                              stiffness: 400,
                              damping: 28,
                            }}
                            aria-label={`${active ? "Connected to" : reconnect ? "Reconnect" : "Connect"} ${channel.name}`}
                            className={`group relative flex w-full flex-row items-center gap-3.5 rounded-2xl border p-3.5 text-left transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-default min-[420px]:flex-col min-[420px]:items-start min-[420px]:gap-5 min-[420px]:p-4 ${
                              active
                                ? "border-brand-primary bg-[#f3fbf6] shadow-[0_4px_14px_rgba(63,218,138,0.12)] dark:bg-brand-primary/10"
                                : "border-border bg-card shadow-[0_1px_2px_rgba(0,0,0,0.02)] hover:border-brand-primary/60 hover:shadow-[0_6px_20px_rgba(0,0,0,0.04)] disabled:opacity-60"
                            }`}
                          >
                            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-black/[0.06] bg-background shadow-2xs dark:border-border">
                              <ChannelIcon channel={channel} small />
                            </span>

                            <span className="block min-w-0 flex-1 pr-6 min-[420px]: max-w-full min-[420px]:pr-0">
                              <span className="block truncate text-sm font-semibold">
                                {channel.name}
                              </span>
                              <span
                                className={`mt-0.5 block truncate text-xs ${
                                  active
                                    ? "font-medium text-emerald-700 dark:text-emerald-400"
                                    : reconnect
                                      ? "font-medium text-amber-700"
                                      : "text-muted-foreground"
                                }`}
                              >
                                {active
                                  ? active.display_name
                                  : reconnect
                                    ? "Reconnect account"
                                    : hintFor(channel)}
                              </span>
                            </span>

                            <span className="ml-auto shrink-0 min-[420px]:absolute min-[420px]:right-3.5 min-[420px]:top-3.5">
                              {connecting ? (
                                <Loader2
                                  aria-label="Connecting"
                                  className="size-4 animate-spin text-muted-foreground"
                                />
                              ) : active ? (
                                <motion.span
                                  initial={{ scale: 0 }}
                                  animate={{ scale: 1 }}
                                  transition={{
                                    type: "spring",
                                    stiffness: 500,
                                    damping: 20,
                                  }}
                                  className="flex size-5 items-center justify-center rounded-full bg-brand-primary text-black shadow-2xs"
                                >
                                  <Check
                                    aria-hidden="true"
                                    className="size-3"
                                    strokeWidth={3}
                                  />
                                </motion.span>
                              ) : (
                                <span className="flex size-6 items-center justify-center rounded-lg border border-transparent text-muted-foreground transition-colors group-hover:border-border group-hover:bg-background group-hover:text-foreground">
                                  <ArrowUpRight
                                    aria-hidden="true"
                                    className="size-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                                  />
                                </span>
                              )}
                            </span>
                          </motion.button>
                        </motion.li>
                      );
                    })}
                  </ul>
                ) : (
                  <motion.div
                    variants={fadeUp}
                    className="mt-8 rounded-2xl border border-border bg-muted/30 p-5 text-sm text-muted-foreground sm:mt-10 sm:p-6"
                  >
                    Your workspace owner manages social connections. You can go
                    straight to your workspace.
                  </motion.div>
                )}

                {canConnect && (
                  <motion.p
                    variants={fadeUp}
                    className="mt-4 flex items-center justify-center gap-2 text-xs text-muted-foreground sm:mt-5"
                  >
                    <ShieldCheck
                      aria-hidden="true"
                      className="size-3.5 shrink-0"
                    />
                    <span>
                      Connections are secure, and you can disconnect anytime.
                    </span>
                  </motion.p>
                )}
              </>
            )}
          </motion.div>

          <AnimatePresence>
            {error && (
              <motion.p
                key="error"
                role="alert"
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mt-5 rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-xs leading-relaxed text-destructive"
              >
                {error}
              </motion.p>
            )}
          </AnimatePresence>

          {step === "connect" && (
            <>
              <div className="mt-6 flex items-center justify-between gap-3 border-t border-border pt-5 sm:mt-8 sm:pt-6">
                <button
                  type="button"
                  onClick={() => onStep("welcome")}
                  disabled={busy}
                  className="flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-medium text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50"
                >
                  <ArrowLeft aria-hidden="true" className="size-3.5" /> Back
                </button>
                <motion.div
                  whileTap={{ scale: 0.98 }}
                  className="flex-1z sm:flex-initial"
                >
                  <Button
                  style={{minHeight:"5px",padding:"5p1x"}}
                    onClick={onFinish}
                    disabled={busy}
                    className={`h-9  gap-2 rounded-lg px-5 text-sm w-fit sm:w-auto sm:px-6 ${
                      ready ? "primary-btn" : "secondary-btn"
                    }`}
                  >
                    {finishing && (
                      <Loader2
                        className="size-4 animate-spin"
                        aria-hidden="true"
                      />
                    )}
                    {ready ? "Go to my workspace" : "Skip for now"}
                    <ArrowRight aria-hidden="true" className="size-4" />
                  </Button>
                </motion.div>
              </div>
              {activeCount > 0 && (
                <p
                  role="status"
                  className="mt-3 text-xs text-emerald-700 sm:mt-4 dark:text-emerald-400"
                >
                  {activeCount === 1
                    ? "1 account connected."
                    : `${activeCount} accounts connected.`}
                </p>
              )}
            </>
          )}
        </section>
      </OnboardingShell>
    </MotionConfig>
  );
}