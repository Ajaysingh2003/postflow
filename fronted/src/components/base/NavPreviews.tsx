"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  BarChart3,
  Bot,
  CalendarDays,
  Check,
  Clock,
  Code2,
  PencilLine,
  Repeat2,
  Send,
  Share2,
  Sparkles,
  UsersRound,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/* Channels (real logos from /public/channels)                                */
/* -------------------------------------------------------------------------- */

export const CHANNELS = [
  { name: "X", src: "/channels/x.jpeg" },
  { name: "LinkedIn", src: "/channels/linkedin.svg" },
  { name: "Threads", src: "/channels/threads.svg" },
  { name: "Reddit", src: "/channels/reddit.svg" },
  // { name: "Instagram", src: "/channels/instagram.svg" },
  // { name: "Facebook", src: "/channels/facebook.png" },
  // { name: "TikTok", src: "/channels/tiktok.svg" },
];

/** Scenes use the first four so layouts stay balanced. */
const SHOWN = CHANNELS.slice(0, 4);
const N = SHOWN.length;

function Logo({ name, size = 18, alt = "" }: { name: string; size?: number; alt?: string }) {
  const c = CHANNELS.find((x) => x.name === name) ?? CHANNELS[0];
  return (
    <Image
      src={c.src}
      alt={alt}
      width={size * 2}
      height={size * 2}
      unoptimized={c.src.endsWith(".svg")}
      style={{ width: size, height: size }}
      className="shrink-0 rounded-[5px] object-cover"
    />
  );
}

export function ChannelLogos({ size = 20, className }: { size?: number; className?: string }) {
  return (
    <ul className={cn("flex items-center gap-1.5", className)} aria-label="Supported channels">
      {CHANNELS.map((c) => (
        <li key={c.name} title={c.name}>
          <Logo name={c.name} size={size} alt={c.name} />
        </li>
      ))}
    </ul>
  );
}

/* -------------------------------------------------------------------------- */
/* Motion helpers                                                             */
/* -------------------------------------------------------------------------- */

type SceneProps = { reduced: boolean };

/** Steps through 0..length-1 forever. Reduced motion jumps to the finished state. */
function useCycle(length: number, ms: number, reduced: boolean) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (reduced) return;
    const t = setInterval(() => setTick((v) => v + 1), ms);
    return () => clearInterval(t);
  }, [ms, reduced]);
  return reduced
    ? { step: length - 1, loop: 0 }
    : { step: tick % length, loop: Math.floor(tick / length) };
}

function useTyped(text: string, loop: number, reduced: boolean, speed = 32) {
  const [n, setN] = useState(reduced ? text.length : 0);
  useEffect(() => {
    if (reduced) {
      setN(text.length);
      return;
    }
    setN(0);
    const t = setInterval(() => setN((v) => Math.min(v + 1, text.length)), speed);
    return () => clearInterval(t);
  }, [text, loop, reduced, speed]);
  return text.slice(0, n);
}

function useCount(to: number, loop: number, reduced: boolean, ms = 1100) {
  const [v, setV] = useState(reduced ? to : 0);
  useEffect(() => {
    if (reduced) {
      setV(to);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const frame = (now: number) => {
      const p = Math.min((now - start) / ms, 1);
      setV(to * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [to, loop, reduced, ms]);
  return v;
}

const card =
  "rounded-xl border border-black/[0.07] bg-white shadow-[0_6px_18px_-12px_rgba(0,0,0,0.25)]";

function Stage({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("absolute inset-0 flex flex-col justify-center gap-2.5 p-3", className)}>
      {children}
    </div>
  );
}

const pop = { type: "spring", stiffness: 420, damping: 26 } as const;

/* -------------------------------------------------------------------------- */
/* Product scenes                                                             */
/* -------------------------------------------------------------------------- */

const POST = "We just shipped scheduled queues. Here's how they work.";

function ComposerScene({ reduced }: SceneProps) {
  const { step, loop } = useCycle(4 + N, 800, reduced);
  const text = useTyped(POST, loop, reduced);
  return (
    <Stage>
      <div className={cn(card, "p-2.5")}>
        <div className="flex items-center justify-between text-[11px] font-medium text-neutral-500">
          <span>New post</span>
          <span className="flex items-center gap-1 text-[#12784a]">
            <Check size={12} /> Autosaved
          </span>
        </div>
        <p className="mt-2 min-h-[54px] text-[12px] leading-snug text-neutral-800">
          {text}
          {!reduced && (
            <span className="ml-0.5 inline-block h-3.5 w-px translate-y-0.5 animate-pulse bg-neutral-800" />
          )}
        </p>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {SHOWN.map((c, i) => {
          const on = step >= 3 + i;
          return (
            <motion.div
              key={c.name}
              animate={{ opacity: on ? 1 : 0.4, scale: on ? 1 : 0.94 }}
              transition={pop}
              className={cn(card, "relative flex h-11 items-center justify-center")}
            >
              <Logo name={c.name} size={20} />
              {on && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={pop}
                  className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-[#3fda8a] text-[#06311b]"
                >
                  <Check size={10} strokeWidth={3} />
                </motion.span>
              )}
            </motion.div>
          );
        })}
      </div>
    </Stage>
  );
}

function AiScene({ reduced }: SceneProps) {
  const { step } = useCycle(6, 900, reduced);
  return (
    <Stage>
      <div className={cn(card, "p-2.5")}>
        <p className="text-[11px] font-medium uppercase tracking-wide text-neutral-500">Your draft</p>
        <p className="mt-1.5 text-[12px] text-neutral-600">we launched something new today</p>
      </div>

      <div className="flex justify-center">
        <motion.span
          animate={step === 1 ? { scale: [1, 0.93, 1] } : { scale: 1 }}
          transition={{ duration: 0.3 }}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors",
            step >= 1
              ? "border-[#3fda8a] bg-[#e9faf1] text-[#12784a]"
              : "border-black/10 bg-white text-neutral-700",
          )}
        >
          <Sparkles size={13} /> Improve writing
        </motion.span>
      </div>

      <div className={cn(card, "min-h-[64px] border-[#3fda8a]/40 p-2.5")}>
        {step < 2 ? (
          <p className="text-[12px] text-neutral-400">Suggestion appears here</p>
        ) : step === 2 ? (
          <div className="space-y-2 pt-1">
            {["w-full", "w-11/12", "w-2/3"].map((w, i) => (
              <motion.div
                key={w}
                animate={{ opacity: [0.35, 0.9, 0.35] }}
                transition={{ duration: 1, repeat: Infinity, delay: i * 0.15 }}
                className={cn("h-2 rounded bg-neutral-200", w)}
              />
            ))}
          </div>
        ) : (
          <motion.p
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-[12px] font-medium leading-snug text-neutral-900"
          >
            Queues are live. Set your best times once and every post goes out on schedule.
          </motion.p>
        )}
      </div>
    </Stage>
  );
}

function RepurposeScene({ reduced }: SceneProps) {
  const { step } = useCycle(N + 2, 700, reduced);
  return (
    <Stage>
      <div className={cn(card, "flex h-9 items-center gap-2 px-2.5")}>
        <Repeat2 size={14} className="text-[#12784a]" />
        <span className="truncate text-[12px] font-medium text-neutral-800">
          5 lessons from building my first startup
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {SHOWN.map((c, i) => {
          const on = step >= 1 + i;
          return (
            <motion.div
              key={c.name}
              animate={{ opacity: on ? 1 : 0.25, y: on ? 0 : 8 }}
              transition={pop}
              className={cn(card, "p-2")}
            >
              <div className="flex items-center gap-1.5">
                <Logo name={c.name} size={16} />
                <span className="text-[11px] font-medium text-neutral-700">
                  {c.name} {c.name === "X" ? "thread" : "post"}
                </span>
              </div>
              <div className="mt-2 space-y-1.5">
                <div className="h-1.5 w-full rounded bg-neutral-200" />
                <div className="h-1.5 w-2/3 rounded bg-neutral-200" />
              </div>
            </motion.div>
          );
        })}
      </div>
    </Stage>
  );
}

const DAYS = ["M", "T", "W", "T", "F", "S", "S"];
const SLOTS: Record<number, number> = { 0: 0, 2: 1, 4: 2, 5: 3 }; // day index -> channel index

function ScheduleScene({ reduced }: SceneProps) {
  const { step } = useCycle(7, 700, reduced);
  let order = 0;
  return (
    <Stage>
      <div className="flex items-center justify-between px-0.5 text-[11px] font-medium text-neutral-500">
        <span>This week</span>
        <CalendarDays size={13} />
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {DAYS.map((d, i) => {
          const ch = SHOWN[SLOTS[i] % N];
          const has = i in SLOTS;
          const myOrder = has ? order++ : -1;
          const landed = has && step >= 1 + myOrder;
          return (
            <div key={i} className="flex flex-col items-center gap-1">
              <span className="text-[11px] text-neutral-500">{d}</span>
              <div className="flex h-12 w-full items-center justify-center rounded-lg border border-black/[0.06] bg-white/70">
                {has && (
                  <motion.div
                    initial={false}
                    animate={{ opacity: landed ? 1 : 0, y: landed ? 0 : -14, scale: landed ? 1 : 0.8 }}
                    transition={pop}
                  >
                    <Logo name={ch.name} size={20} />
                  </motion.div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <motion.div
        animate={{ opacity: step >= 5 ? 1 : 0.35 }}
        className={cn(card, "mx-auto flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] text-neutral-800")}
      >
        <Clock size={13} className="text-[#12784a]" />
        Next up · Wed 9:30 AM
      </motion.div>
    </Stage>
  );
}

function ChannelsScene({ reduced }: SceneProps) {
  const { step } = useCycle(N + 3, 700, reduced);
  return (
    <Stage>
      <div className={cn(card, "divide-y divide-black/[0.06]")}>
        {SHOWN.map((c, i) => {
          const on = step >= 1 + i;
          return (
            <div key={c.name} className="flex h-10 items-center gap-2.5 px-2.5">
              <Logo name={c.name} size={20} />
              <span className="flex-1 text-[13px] font-medium text-neutral-800">{c.name}</span>
              <span
                className={cn(
                  "text-[11px] transition-colors",
                  on ? "text-[#12784a]" : "text-neutral-400",
                )}
              >
                {on ? "Connected" : "Not connected"}
              </span>
              <motion.span
                animate={{ backgroundColor: on ? "#3fda8a" : "#d4d4d4" }}
                className="relative h-[18px] w-8 shrink-0 rounded-full"
              >
                <motion.span
                  animate={{ x: on ? 16 : 2 }}
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  className="absolute top-[2px] size-[14px] rounded-full bg-white shadow"
                />
              </motion.span>
            </div>
          );
        })}
      </div>
    </Stage>
  );
}

const BARS = [38, 52, 44, 66, 58, 80, 96, 76, 90];

function AnalyticsScene({ reduced }: SceneProps) {
  const { loop } = useCycle(4, 1500, reduced);
  const count = useCount(24.8, loop, reduced);
  return (
    <Stage>
      <div className={cn(card, "p-3")}>
        <p className="text-[11px] font-medium text-neutral-500">Engagement · last 7 days</p>
        <div className="mt-0.5 flex items-end gap-2">
          <span className="text-[26px] font-semibold leading-none tracking-tight text-neutral-900 tabular-nums">
            {count.toFixed(1)}K
          </span>
          <span className="mb-0.5 rounded-md bg-[#e3f9eb] px-1.5 py-0.5 text-[11px] font-semibold text-[#12784a]">
            +18.4%
          </span>
        </div>

        <div className="mt-3 flex h-16 items-end gap-1.5 border-b border-black/[0.06]">
          {BARS.map((h, i) => (
            <motion.div
              key={`${loop}-${i}`}
              initial={{ height: reduced ? `${h}%` : 0 }}
              animate={{ height: `${h}%` }}
              transition={{ duration: 0.5, delay: reduced ? 0 : i * 0.05, ease: [0.22, 1, 0.36, 1] }}
              className={cn("flex-1 rounded-t-[3px]", i === 6 ? "bg-[#3fda8a]" : "bg-[#cdeedb]")}
            />
          ))}
        </div>
      </div>
    </Stage>
  );
}

function McpScene({ reduced }: SceneProps) {
  const { step } = useCycle(7, 800, reduced);
  const flowing = step >= 2 && step < 4;
  const Connector = () => (
    <div className="relative mx-auto h-[18px] w-px bg-black/10">
      {!reduced && (
        <motion.span
          animate={flowing ? { y: [0, 14], opacity: [1, 0] } : { opacity: 0 }}
          transition={{ duration: 0.7, repeat: Infinity }}
          className="absolute -left-[2px] top-0 size-[5px] rounded-full bg-[#3fda8a]"
        />
      )}
    </div>
  );
  return (
    <Stage className="gap-0">
      <motion.div
        animate={{ opacity: step >= 1 ? 1 : 0.3, y: step >= 1 ? 0 : 6 }}
        className={cn(card, "flex items-start gap-2 p-2.5")}
      >
        <Bot size={15} className="mt-0.5 shrink-0 text-neutral-700" />
        <p className="text-[12px] leading-snug text-neutral-800">Schedule this post for Tuesday at 9am</p>
      </motion.div>

      <Connector />

      <div
        className={cn(
          card,
          "flex items-center gap-2 px-2.5 py-2 transition-colors",
          step >= 2 && "border-[#3fda8a] bg-[#f0fcf5]",
        )}
      >
        <span className="flex size-6 items-center justify-center rounded-md bg-[#3fda8a] text-[#06311b]">
          <Code2 size={14} />
        </span>
        <span className="text-[12px] font-semibold text-neutral-900">Draftva MCP</span>
      </div>

      <Connector />

      <div className="flex items-center justify-center gap-2">
        <div className="flex gap-1.5">
          {SHOWN.map((c, i) => (
            <motion.span
              key={c.name}
              animate={{ opacity: step >= 4 ? 1 : 0.35, scale: step >= 4 ? 1 : 0.9 }}
              transition={{ ...pop, delay: reduced ? 0 : i * 0.05 }}
            >
              <Logo name={c.name} size={20} />
            </motion.span>
          ))}
        </div>
        <motion.span
          animate={{ opacity: step >= 5 ? 1 : 0, x: step >= 5 ? 0 : -6 }}
          className="flex items-center gap-1 rounded-full bg-[#e3f9eb] px-2 py-1 text-[11px] font-semibold text-[#12784a]"
        >
          <Check size={11} strokeWidth={3} /> Scheduled
        </motion.span>
      </div>
    </Stage>
  );
}

/* -------------------------------------------------------------------------- */
/* Solutions scenes                                                           */
/* -------------------------------------------------------------------------- */

function FlowScene({
  reduced,
  nodes,
  caption,
}: SceneProps & { nodes: { label: string; icon: LucideIcon }[]; caption: string }) {
  const { step } = useCycle(nodes.length + 2, 900, reduced);
  const a = step - 1; // active node index, -1 = idle
  return (
    <Stage className="items-center gap-4">
      <div className="flex w-full items-start px-1">
        {nodes.map((n, i) => {
          const Icon = n.icon;
          const done = a > i;
          const active = a === i;
          return (
            <React.Fragment key={n.label}>
              <div className="flex w-[60px] flex-col items-center gap-1.5">
                <motion.span
                  animate={{ scale: active ? 1.1 : 1 }}
                  transition={pop}
                  className={cn(
                    "flex size-10 items-center justify-center rounded-xl border transition-colors",
                    done && "border-[#3fda8a] bg-[#3fda8a] text-[#06311b]",
                    active && "border-[#3fda8a] bg-[#e9faf1] text-[#12784a]",
                    !done && !active && "border-black/[0.08] bg-white text-neutral-500",
                  )}
                >
                  {done ? <Check size={17} strokeWidth={2.6} /> : <Icon size={17} />}
                </motion.span>
                <span className="text-[12px] font-medium text-neutral-800">{n.label}</span>
              </div>
              {i < nodes.length - 1 && (
                <div className="relative mt-[19px] h-0.5 flex-1 rounded bg-black/10">
                  <motion.span
                    animate={{ scaleX: a > i ? 1 : 0 }}
                    transition={{ duration: 0.4 }}
                    className="absolute inset-0 origin-left rounded bg-[#3fda8a]"
                  />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>

      <p className="px-3 text-center text-[12px] leading-snug text-neutral-600">{caption}</p>
      <ChannelLogos size={18} />
    </Stage>
  );
}

const CLIENTS = ["Studio North", "Bloom Co", "Kite Labs"];
const TIMES = ["Mon 9:00", "Wed 12:30", "Fri 8:15"];

function ClientsScene({ reduced }: SceneProps) {
  const { step } = useCycle(CLIENTS.length, 1500, reduced);
  const current = reduced ? 0 : step;
  return (
    <Stage>
      <div className="flex gap-1 rounded-lg bg-black/[0.05] p-1">
        {CLIENTS.map((c, i) => (
          <span
            key={c}
            className={cn(
              "flex-1 truncate rounded-md px-1.5 py-1 text-center text-[11px] font-medium transition-all",
              i === current ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-500",
            )}
          >
            {c}
          </span>
        ))}
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={current}
          initial={{ opacity: 0, x: reduced ? 0 : 10 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: reduced ? 0 : -10 }}
          transition={{ duration: 0.2 }}
          className="space-y-2"
        >
          {TIMES.map((t, r) => (
            <div key={t} className={cn(card, "flex h-10 items-center gap-2.5 px-2.5")}>
              <Logo name={SHOWN[(current + r) % N].name} size={18} />
              <div className="flex-1 space-y-1.5">
                <div className="h-1.5 w-full rounded bg-neutral-200" />
                <div className="h-1.5 w-1/2 rounded bg-neutral-200" />
              </div>
              <span className="text-[11px] text-neutral-500">{t}</span>
            </div>
          ))}
        </motion.div>
      </AnimatePresence>
    </Stage>
  );
}

const CreatorsScene = ({ reduced }: SceneProps) => (
  <FlowScene
    reduced={reduced}
    nodes={[
      { label: "Create", icon: PencilLine },
      { label: "Schedule", icon: CalendarDays },
      { label: "Grow", icon: BarChart3 },
    ]}
    caption="Write once. Show up everywhere, on schedule."
  />
);

const FoundersScene = ({ reduced }: SceneProps) => (
  <FlowScene
    reduced={reduced}
    nodes={[
      { label: "Ship", icon: PencilLine },
      { label: "Share", icon: Share2 },
      { label: "Trust", icon: UsersRound },
    ]}
    caption="Share the build. Let the audience compound."
  />
);

const TeamsScene = ({ reduced }: SceneProps) => (
  <FlowScene
    reduced={reduced}
    nodes={[
      { label: "Draft", icon: PencilLine },
      { label: "Review", icon: UsersRound },
      { label: "Publish", icon: Send },
    ]}
    caption="Nothing goes live without a second pair of eyes."
  />
);

/* -------------------------------------------------------------------------- */
/* Public preview panel                                                       */
/* -------------------------------------------------------------------------- */

const SCENES: Record<string, React.ComponentType<SceneProps>> = {
  composer: ComposerScene,
  ai: AiScene,
  repurposing: RepurposeScene,
  scheduling: ScheduleScene,
  channels: ChannelsScene,
  analytics: AnalyticsScene,
  mcp: McpScene,
  creators: CreatorsScene,
  founders: FoundersScene,
  agencies: ClientsScene,
  teams: TeamsScene,
};

export type PreviewEntry = {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  /** Optional real screenshot; overrides the animated scene. */
  image?: string;
};

export function NavPreview({ items, activeId }: { items: PreviewEntry[]; activeId: string }) {
  const reduced = Boolean(useReducedMotion());
  const active = items.find((i) => i.id === activeId) ?? items[0];
  const Scene = SCENES[active.id];

  return (
    <div className="flex h-full flex-col rounded-xl border border-black/[0.07] bg-white p-2">
      <div className="relative aspect-[4/3] overflow-hidden rounded-lg border border-black/[0.06] bg-[#f6f5f0]">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={active.id}
            className="absolute inset-0"
            initial={{ opacity: 0, y: reduced ? 0 : 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduced ? 0 : 0.18 }}
          >
            {active.image ? (
              <Image
                src={active.image}
                alt={`${active.title} preview`}
                fill
                sizes="300px"
                className="object-cover object-top"
              />
            ) : Scene ? (
              <Scene reduced={reduced} />
            ) : null}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="px-2 pb-2 pt-3">
        <p className="text-[14px] font-semibold text-neutral-900">{active.title}</p>
        <p className="mt-1 text-[13px] leading-snug text-neutral-600">{active.description}</p>
      </div>
    </div>
  );
}