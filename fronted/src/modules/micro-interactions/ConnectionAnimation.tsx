"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowUpRight,
  Bot,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Flame,
  Globe2,
  Lock,
  MessageSquare,
  Repeat2,
  Send,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  ThumbsUp,
  TrendingUp,
  UserCheck,
  Zap,
} from "lucide-react";
import { Linkedin } from "@/lib/icons";

/* -------------------------------------------------------------------------- */
/* Design Tokens & Timing                                                     */
/* -------------------------------------------------------------------------- */

const STAGE_INTERVAL = 4200;

const STAGES = [
  { id: "connect", label: "01. Handshake", icon: Zap },
  { id: "draft", label: "02. Synthesis", icon: Sparkles },
  { id: "queue", label: "03. Traffic Slot", icon: Calendar },
  { id: "growth", label: "04. Engagement", icon: TrendingUp },
] as const;

const SAMPLE_HOOK =
  "Most LinkedIn growth problems aren't content bottlenecks. They're distribution and timing failures.";

/* -------------------------------------------------------------------------- */
/* Main Canvas Component                                                      */
/* -------------------------------------------------------------------------- */

export default function ConnectionAnimation() {
  const reducedMotion = useReducedMotion();
  const [stage, setStage] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (reducedMotion || isPaused) return;

    const timer = window.setInterval(() => {
      setStage((prev) => (prev + 1) % STAGES.length);
    }, STAGE_INTERVAL);

    return () => window.clearInterval(timer);
  }, [reducedMotion, isPaused]);

  return (
    <section className="relative hidden min-h-screen w-full select-none overflow-hidden bg-[#0066c8] md:flex md:flex-col">
      {/* Dynamic Kinetic Background Canvas */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        {/* Soft Multi-Stop Atmospheric Mesh */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(130% 90% at 90% -10%, rgba(85, 187, 255, 0.45) 0%, rgba(20, 125, 230, 0.7) 45%, rgba(0, 75, 160, 0.95) 100%)",
          }}
        />

        {/* Ambient Grid Lines with Masking */}
        <div
          className="absolute inset-0 opacity-15"
          style={{
            backgroundImage:
              "linear-gradient(to right, rgba(255,255,255,0.4) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.4) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
            maskImage:
              "radial-gradient(ellipse at 60% 30%, black 20%, transparent 80%)",
          }}
        />

        {/* Floating Ambient Caustic Orbs */}
        <motion.div
          className="absolute -right-20 top-24 size-96 rounded-full bg-cyan-300/20 blur-[110px]"
          animate={
            reducedMotion
              ? undefined
              : { scale: [1, 1.15, 1], opacity: [0.25, 0.4, 0.25] }
          }
          transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute -left-20 bottom-24 size-[420px] rounded-full bg-blue-900/40 blur-[130px]"
          animate={
            reducedMotion
              ? undefined
              : { scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }
          }
          transition={{ duration: 9, repeat: Infinity, ease: "easeInOut", delay: 1 }}
        />
      </div>

      {/* Main Content Layout */}
      <div className="relative z-10 flex min-h-screen flex-col justify-between px-8 py-10 lg:px-14 xl:px-18">
        {/* Header Branding */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-2xl bg-white/15 text-white shadow-inner ring-1 ring-white/30 backdrop-blur-md">
              <Linkedin size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-heading text-lg font-bold tracking-tight text-white">
                  Outlify
                </span>
                <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">
                  Engine
                </span>
              </div>
              <p className="text-xs text-white/75">
                Autonomous Growth &amp; Content Architecture
              </p>
            </div>
          </div>

          {/* Secure Handshake Chip */}
          <div className="hidden items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3.5 py-1.5 text-xs font-medium text-white shadow-xs backdrop-blur-md lg:flex">
            <ShieldCheck size={14} className="text-emerald-300" />
            <span>Encrypted Token Vault</span>
          </div>
        </div>

        {/* Central Stage Showcase */}
        <div
          className="relative my-auto flex flex-col items-center justify-center py-6"
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
        >
          {/* Main Elevated Display Card */}
          <div className="relative w-full max-w-[560px]">
            {/* Top Kinetic Stage Selector Tabs */}
            <div className="mb-4 flex items-center justify-between gap-1.5 rounded-2xl border border-white/20 bg-white/10 p-1.5 shadow-lg backdrop-blur-md">
              {STAGES.map((s, idx) => {
                const Icon = s.icon;
                const isActive = stage === idx;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setStage(idx)}
                    className={`relative flex flex-1 items-center justify-center gap-2 rounded-xl py-2 text-xs font-semibold transition-all duration-300 ${
                      isActive
                        ? "text-slate-900 shadow-md"
                        : "text-white/70 hover:text-white"
                    }`}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="activePill"
                        className="absolute inset-0 rounded-xl bg-white"
                        transition={{ type: "spring", stiffness: 350, damping: 30 }}
                      />
                    )}
                    <span className="relative z-10 flex items-center gap-1.5">
                      <Icon size={13} className={isActive ? "text-[#128be0]" : ""} />
                      <span className="hidden sm:inline">{s.label}</span>
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Viewport Window */}
            <div className="relative overflow-hidden rounded-[26px] border border-white/35 bg-white/95 p-6 shadow-[0_32px_80px_-20px_rgba(3,37,76,0.6)] backdrop-blur-xl">
              {/* Top Window Bar */}
              <div className="mb-5 flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1.5">
                    <span className="size-2.5 rounded-full bg-slate-200" />
                    <span className="size-2.5 rounded-full bg-slate-200" />
                    <span className="size-2.5 rounded-full bg-slate-200" />
                  </div>
                  <span className="ml-2  text-[11px] font-semibold text-slate-400">
                    outlify://workflow/v2.1
                  </span>
                </div>

                <div className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold text-emerald-600 border border-emerald-100">
                  <span className="size-1.5 animate-pulse rounded-full bg-emerald-500" />
                  RUNTIME ACTIVE
                </div>
              </div>

              {/* Dynamic Step Viewport */}
              <div className="relative h-[310px]">
                <AnimatePresence mode="wait">
                  {stage === 0 && <HandshakeScene key="handshake" />}
                  {stage === 1 && <SynthesisScene key="synthesis" />}
                  {stage === 2 && <QueueScene key="queue" />}
                  {stage === 3 && <ImpactScene key="impact" />}
                </AnimatePresence>
              </div>

              {/* Real-time Step Progress Bar */}
              <div className="mt-4 h-1 w-full overflow-hidden rounded-full bg-slate-100">
                <motion.div
                  key={stage}
                  className="h-full bg-[#128be0]"
                  initial={{ width: "0%" }}
                  animate={{ width: "100%" }}
                  transition={{ duration: STAGE_INTERVAL / 1000, ease: "linear" }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Headline / Conversion Footprint */}
        <div className="max-w-2xl pt-2">
          <h2 className="font-heading text-3xl font-semibold leading-tight tracking-tight text-white lg:text-4xl">
            Autonomous LinkedIn distribution. <br />
            Compounding results while you sleep.
          </h2>
          <p className="mt-3 text-sm font-normal leading-relaxed text-white/80">
            Outlify captures your authentic point of view, refines viral hooks,
            and schedules dispatch windows for peak network visibility.
          </p>
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Sub-Scenes (Micro-Simulations)                                             */
/* -------------------------------------------------------------------------- */

/** 01. Cryptographic Handshake Scene */
function HandshakeScene() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.35 }}
      className="flex h-full flex-col justify-between"
    >
      <div className="text-center">
        <span className="rounded-full bg-sky-50 px-3 py-1  text-[11px] font-semibold text-[#128be0]">
          PEER-TO-PEER AUTHORIZATION
        </span>
        <h3 className="mt-2 text-base font-bold text-slate-900">
          Zero-Password Session Extraction
        </h3>
        <p className="text-xs text-slate-500">
          Connects directly through local session authorization tokens.
        </p>
      </div>

      {/* Graphic Connection Circuit */}
      <div className="relative my-auto flex items-center justify-center gap-8">
        {/* LinkedIn Node */}
        <motion.div
          animate={{ scale: [1, 1.03, 1] }}
          transition={{ duration: 2.4, repeat: Infinity }}
          className="relative flex size-20 items-center justify-center rounded-2xl bg-[#0A66C2] text-white shadow-lg shadow-blue-500/25"
        >
          <Linkedin size={36} />
          <span className="absolute -bottom-2 rounded-md bg-slate-900 px-1.5 py-0.5 text-[9px] font-semibold text-white">
            Client
          </span>
        </motion.div>

        {/* Data Stream Circuit Line */}
        <div className="relative h-1 w-28 rounded-full bg-slate-100 overflow-hidden">
          <motion.div
            className="absolute h-full w-12 rounded-full bg-gradient-to-r from-transparent via-[#128be0] to-transparent"
            animate={{ x: [-40, 112] }}
            transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
          />
        </div>

        {/* Outlify Core Node */}
        <motion.div
          animate={{ scale: [1, 1.03, 1] }}
          transition={{ duration: 2.4, repeat: Infinity, delay: 1.2 }}
          className="relative flex size-20 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-lg shadow-slate-950/20"
        >
          <Sparkles size={34} className="text-sky-400" />
          <span className="absolute -bottom-2 rounded-md bg-[#128be0] px-1.5 py-0.5 text-[9px] font-semibold text-white">
            Outlify
          </span>
        </motion.div>
      </div>

      {/* Security Status Footnote */}
      <div className="flex items-center justify-center gap-2 rounded-xl bg-emerald-50/80 p-2 text-center text-xs font-semibold text-emerald-700 border border-emerald-100">
        <CheckCircle2 size={15} />
        <span>Hardware sandbox verified. Session tokens synced.</span>
      </div>
    </motion.div>
  );
}

/** 02. AI Contextual Synthesis Scene */
function SynthesisScene() {
  const [typedCount, setTypedCount] = useState(0);

  useEffect(() => {
    setTypedCount(0);
    const timer = setInterval(() => {
      setTypedCount((prev) => {
        if (prev >= SAMPLE_HOOK.length) {
          clearInterval(timer);
          return prev;
        }
        return prev + 1;
      });
    }, 20);
    return () => clearInterval(timer);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.35 }}
      className="flex h-full flex-col justify-between"
    >
      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
        <div className="flex items-center gap-2">
          <Bot size={15} className="text-[#128be0]" />
          <span className="text-xs font-bold text-slate-800">
            Voice Matrix Adaptive Engine
          </span>
        </div>
        <span className="flex items-center gap-1 rounded-md bg-sky-50 px-2 py-0.5 text-[10px] font-bold text-sky-700">
          <Flame size={11} className="text-orange-500" />
          Hook Score: 96/100
        </span>
      </div>

      {/* Post Editor Preview */}
      <div className="rounded-xl border border-slate-100 bg-slate-50/70 shadow-sm p-4">
        <div className="flex items-center gap-2.5">
          <div className="flex size-7 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white">
            AS
          </div>
          <div>
            <p className="text-xs font-bold leading-none text-slate-900">
              Ajay Singh
            </p>
            <p className="text-[10px] text-slate-400">Founder at Outlify</p>
          </div>
        </div>

        <p className="mt-3 min-h-[58px] text-xs font-normal leading-relaxed text-slate-700">
          {SAMPLE_HOOK.slice(0, typedCount)}
          {typedCount < SAMPLE_HOOK.length && (
            <span className="inline-block h-3.5 w-0.5 translate-y-0.5 bg-[#128be0] animate-pulse" />
          )}
        </p>

        <div className="mt-2 flex items-center justify-between text-[10px] font-medium text-slate-400">
          <span>Synthesized from top 5% industry hooks</span>
          <span className="text-[#128be0]">Formatted for dwell-time</span>
        </div>
      </div>

      <div className="flex items-center justify-between rounded-xl bg-slate-100/70 px-3 py-2 text-xs font-semibold text-slate-600">
        <span className="text-[11px]">Next: Smart Schedule Injection</span>
        <span className="rounded bg-white px-2 py-0.5 text-[10px] text-slate-900 shadow-2xs">
          High Traffic Slot Ready
        </span>
      </div>
    </motion.div>
  );
}

/** 03. High-Traffic Algorithm Queue Scene */
function QueueScene() {
  const queueItems = [
    { day: "Today", time: "14:15", label: "Peak Tech Founder Window", active: true },
    { day: "Tomorrow", time: "08:45", label: "US East Opening Scroll", active: false },
    { day: "Thursday", time: "11:30", label: "Mid-Day Engagement Surge", active: false },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.35 }}
      className="flex h-full flex-col justify-between"
    >
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xs font-bold text-slate-900">
            Algorithmic Dispatch Queue
          </h3>
          <p className="text-[10px] text-slate-400">
            Auto-timed for highest impression density
          </p>
        </div>
        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-600">
          Auto-Pilot ON
        </span>
      </div>

      {/* Queue Items */}
      <div className="space-y-2">
        {queueItems.map((item, i) => (
          <motion.div
            key={item.day}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.15 }}
            className={`flex items-center justify-between rounded-xl border p-2.5 transition-all ${
              item.active
                ? "border-sky-200 bg-sky-50/70 shadow-xs"
                : "border-slate-100 bg-white"
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`flex size-8 items-center justify-center rounded-lg ${
                  item.active
                    ? "bg-[#128be0] text-white"
                    : "bg-slate-100 text-slate-400"
                }`}
              >
                <Clock size={14} />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-800">
                  {item.day} • {item.time}
                </p>
                <p className="text-[10px] text-slate-500">{item.label}</p>
              </div>
            </div>

            {item.active ? (
              <span className="flex items-center gap-1  text-[10px] font-bold text-[#128be0]">
                QUEUED
              </span>
            ) : (
              <span className="text-[10px] text-slate-400">Scheduled</span>
            )}
          </motion.div>
        ))}
      </div>

      <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-1.5 text-[10px] font-medium text-slate-500">
        <span>Dynamic spacing enabled</span>
        <span>Anti-Shadowban Protected</span>
      </div>
    </motion.div>
  );
}

/** 04. Algorithmic Impact & Engagement Scene */
function ImpactScene() {
  const reactions = useCountUp(342, true);
  const comments = useCountUp(58, true);
  const reposts = useCountUp(27, true);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.35 }}
      className="flex h-full flex-col justify-between"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex size-2 rounded-full bg-emerald-500 animate-ping" />
          <span className="text-xs font-bold text-slate-900">
            Post Performance Live Stream
          </span>
        </div>
        <span className="text-[10px]  font-bold text-slate-400">
          +3.4x vs Baseline
        </span>
      </div>

      {/* Mini Performance Graph Simulator */}
      <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3">
        <div className="flex items-end justify-between gap-1 h-14 pt-2">
          {[20, 32, 28, 45, 60, 52, 78, 92, 85, 100].map((h, i) => (
            <motion.div
              key={i}
              initial={{ height: 0 }}
              animate={{ height: `${h}%` }}
              transition={{ delay: i * 0.04, duration: 0.5 }}
              className={`w-full rounded-t-sm ${
                i === 9 ? "bg-[#128be0]" : "bg-sky-200"
              }`}
            />
          ))}
        </div>
        <div className="mt-2 flex justify-between text-[9px] font-semibold text-slate-400">
          <span>T+0m (Dispatch)</span>
          <span>T+45m (Algorithm Acceleration)</span>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl border border-slate-100 bg-white p-2.5 text-center shadow-2xs">
          <div className="flex items-center justify-center gap-1 text-[10px] text-slate-400">
            <ThumbsUp size={11} className="text-sky-500" /> Reactions
          </div>
          <p className="mt-1  text-sm font-bold text-slate-900">
            {reactions}
          </p>
        </div>
        <div className="rounded-xl border border-slate-100 bg-white p-2.5 text-center shadow-2xs">
          <div className="flex items-center justify-center gap-1 text-[10px] text-slate-400">
            <MessageSquare size={11} className="text-blue-500" /> Comments
          </div>
          <p className="mt-1  text-sm font-bold text-slate-900">
            {comments}
          </p>
        </div>
        <div className="rounded-xl border border-slate-100 bg-white p-2.5 text-center shadow-2xs">
          <div className="flex items-center justify-center gap-1 text-[10px] text-slate-400">
            <Repeat2 size={11} className="text-emerald-500" /> Reposts
          </div>
          <p className="mt-1  text-sm font-bold text-slate-900">
            {reposts}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-center gap-1.5 text-center text-xs font-semibold text-emerald-600">
        <ArrowUpRight size={14} />
        <span>Top 3% dwell-time across network feeds</span>
      </div>
    </motion.div>
  );
}

/* -------------------------------------------------------------------------- */
/* Utilities & Helpers                                                        */
/* -------------------------------------------------------------------------- */

function useCountUp(target: number, run: boolean) {
  const [value, setValue] = useState(run ? 0 : target);

  useEffect(() => {
    if (!run) {
      setValue(target);
      return;
    }

    let frame = 0;
    const start = performance.now();
    const duration = 1200;

    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(target * eased));

      if (progress < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, run]);

  return value;
}