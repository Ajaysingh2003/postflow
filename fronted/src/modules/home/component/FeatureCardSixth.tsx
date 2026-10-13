"use client";

import { useEffect, useState } from "react";
import {
  AnimatePresence,
  motion,
  useReducedMotion,
} from "framer-motion";
import {
  Check,
  ChevronDown,
  Copy,
  Fingerprint,
  PenLine,
  SlidersHorizontal,
  Sparkles,
  Star,
} from "lucide-react";
import { BentoCard, BentoHeader, CardBottomFade } from "./FeatureSection";

/* -------------------------------------------------------------------------- */
/* Types & Data                                                               */
/* -------------------------------------------------------------------------- */

type ProfileId = "founder" | "professional" | "conversational";
type PreviewMode = "original" | "styled";

interface WritingProfile {
  id: ProfileId;
  name: string;
  description: string;
  tag: string;
  rules: string[];
  content: string;
}

const ORIGINAL_POST = `Consistency is important when you're growing an audience.

Posting regularly helps people get familiar with your work and builds trust over time.`;

const PROFILES: Record<ProfileId, WritingProfile> = {
  founder: {
    id: "founder",
    name: "Founder",
    tag: "High Signal",
    description: "Direct, punchy, opinionated",
    rules: ["Short sentences", "Zero buzzwords", "Strong conviction"],
    content: `One viral post won't build your audience.

Showing up every week will.

Consistency gives people a reason to remember you.`,
  },
  professional: {
    id: "professional",
    name: "Executive",
    tag: "Structured",
    description: "Thoughtful, clear, analytical",
    rules: ["Measured cadence", "Actionable lessons", "Nuanced claims"],
    content: `Consistent publishing builds more enterprise trust than an occasional viral post.

Share useful lessons regularly. Observe what converts. Iterate without friction.`,
  },
  conversational: {
    id: "conversational",
    name: "Storyteller",
    tag: "Casual",
    description: "Relaxed, approachable, peer-to-peer",
    rules: ["Natural rhythm", "Short paragraphs", "No jargon"],
    content: `Going viral is fun for a day.

What actually builds compounding leverage? Showing up again next Monday.

People start to recognize your ideas when you keep sharing.`,
  },
};

const PROFILE_IDS: ProfileId[] = ["founder", "professional", "conversational"];
const ROTATION_INTERVAL = 6000;

/* -------------------------------------------------------------------------- */
/* Infinite Ambient Components                                                */
/* -------------------------------------------------------------------------- */

/** Infinite pulsing audio/cadence equalizer */
function CadenceEqualizer() {
  const bars = [
    { duration: 1.1, min: 0.35, max: 0.95, delay: 0 },
    { duration: 0.85, min: 0.25, max: 1.0, delay: 0.15 },
    { duration: 1.25, min: 0.4, max: 0.8, delay: 0.3 },
    { duration: 0.95, min: 0.3, max: 1.0, delay: 0.05 },
    { duration: 1.4, min: 0.2, max: 0.75, delay: 0.2 },
  ];

  return (
    <div className="flex h-3.5 items-end gap-[2px]" aria-hidden="true">
      {bars.map((bar, i) => (
        <motion.span
          key={i}
          className="w-[2px] rounded-full bg-[#3fda8a]"
          animate={{ scaleY: [bar.min, bar.max, bar.min] }}
          transition={{
            duration: bar.duration,
            repeat: Infinity,
            ease: "easeInOut",
            delay: bar.delay,
          }}
          style={{ originY: 1 }}
        />
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Main Feature Card                                                          */
/* -------------------------------------------------------------------------- */

export function FeatureCardSixth() {
  const reducedMotion = useReducedMotion();
  const [profileId, setProfileId] = useState<ProfileId>("founder");
  const [mode, setMode] = useState<PreviewMode>("styled");
  const [rotationKey, setRotationKey] = useState(0);
  const [copied, setCopied] = useState(false);

  const profile = PROFILES[profileId];
  const displayedContent = mode === "original" ? ORIGINAL_POST : profile.content;

  // Auto-switch between original & calibrated draft
  useEffect(() => {
    if (reducedMotion) return;
    const interval = window.setInterval(() => {
      setMode((current) => (current === "original" ? "styled" : "original"));
    }, ROTATION_INTERVAL);
    return () => window.clearInterval(interval);
  }, [reducedMotion, rotationKey]);

  useEffect(() => {
    if (!copied) return;
    const timeout = window.setTimeout(() => setCopied(false), 1600);
    return () => window.clearTimeout(timeout);
  }, [copied]);

  const changeProfile = (next: ProfileId) => {
    setProfileId(next);
    setMode("styled");
    setRotationKey((prev) => prev + 1);
  };

  const copyContent = async () => {
    try {
      await navigator.clipboard.writeText(displayedContent);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <BentoCard className="relative flex !h-[500px] flex-col overflow-hidden border-zinc-200/80 bg-white sm:!h-[520px]">
      <BentoHeader
        icon={Fingerprint}
        badge="Adaptive Tone Engine"
        title="Your voice, calibrated in every post."
        description="Train Draftva on your personal writing patterns. Strip out generic corporate speak and publish posts that sound genuinely human."
        linkText="Configure your tone model ↗"
        href="/register"
      />

      <div className="relative z-10 mt-3 flex min-h-0 flex-1 flex-col px-3.5 pb-6 sm:px-6">
        {/* Infinite breathing background glow */}
        <motion.div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-4 h-[220px] w-[80%] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,#3fda8a_0%,rgba(63,218,138,0.15)_45%,transparent_75%)] blur-[55px]"
          animate={
            reducedMotion
              ? { opacity: 0.35 }
              : {
                  opacity: [0.35, 0.6, 0.35],
                  scale: [0.96, 1.04, 0.96],
                }
          }
          transition={{
            duration: 5.5,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />

        {/* Central Workspace Window */}
        <div className="relative mx-auto flex h-full w-full max-w-[530px] flex-col overflow-hidden rounded-2xl border border-zinc-200/90 bg-white/95 shadow-[0_14px_38px_-18px_rgba(20,35,28,0.12),0_1px_3px_rgba(0,0,0,0.03)] backdrop-blur-md">
          
          {/* Infinite Light Sweep Shimmer Line */}
          <div className="relative h-[2px] w-full overflow-hidden bg-zinc-100">
            <motion.div
              className="absolute inset-y-0 h-full w-36 bg-gradient-to-r from-transparent via-[#3fda8a] to-transparent"
              animate={
                reducedMotion
                  ? { left: "40%" }
                  : {
                      left: ["-25%", "115%"],
                    }
              }
              transition={{
                duration: 3.2,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
          </div>

          {/* Topbar: Document Metadata & Profile Chips */}
          <div className="flex h-12 shrink-0 items-center justify-between border-b border-zinc-100 bg-zinc-50/70 px-3.5 sm:px-4">
            <div className="flex items-center gap-2.5">
              <span className="flex size-6 items-center justify-center rounded-lg border border-zinc-200/80 bg-white text-zinc-700 shadow-2xs">
                <PenLine className="size-3 text-emerald-600" />
              </span>

              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-semibold text-zinc-900">
                  tone_profile.ts
                </span>
                <span className="hidden items-center gap-1 rounded-full border border-emerald-500/25 bg-emerald-50 px-2 py-0.5 text-[9.5px] font-semibold text-emerald-700 sm:inline-flex">
                  <span className="size-1 rounded-full bg-emerald-500" />
                  Active
                </span>
              </div>
            </div>

            {/* Profile Dropdown / Selector */}
            <div className="relative flex items-center">
              <select
                value={profileId}
                onChange={(e) => changeProfile(e.target.value as ProfileId)}
                aria-label="Select writing profile"
                className="h-8 cursor-pointer appearance-none rounded-lg border border-zinc-200/80 bg-white pl-2.5 pr-7 text-xs font-medium text-zinc-700 shadow-2xs outline-none transition-all hover:border-zinc-300 focus:border-emerald-500/60 focus:ring-2 focus:ring-emerald-500/15"
              >
                {PROFILE_IDS.map((id) => (
                  <option key={id} value={id}>
                    {PROFILES[id].name} ({PROFILES[id].tag})
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 size-3 text-zinc-400" />
            </div>
          </div>

          {/* Preview Navigation Tabs */}
          <div className="flex h-11 shrink-0 items-center justify-between border-b border-zinc-100 px-4">
            <div className="flex items-center gap-2">
              <CadenceEqualizer />
              <span className="text-[11px] font-medium text-zinc-400">
                Cadence Scan
              </span>
            </div>

            {/* Pill Toggle */}
            <div className="inline-flex rounded-lg border border-zinc-200/70 bg-zinc-100/70 p-0.5">
              <button
                type="button"
                onClick={() => {
                  setMode("original");
                  setRotationKey((k) => k + 1);
                }}
                className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-all ${
                  mode === "original"
                    ? "bg-white text-zinc-900 shadow-2xs"
                    : "text-zinc-500 hover:text-zinc-800"
                }`}
              >
                Raw Input
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode("styled");
                  setRotationKey((k) => k + 1);
                }}
                className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-medium transition-all ${
                  mode === "styled"
                    ? "bg-white text-emerald-800 shadow-2xs"
                    : "text-zinc-500 hover:text-zinc-800"
                }`}
              >
                <Star className="size-2.5 text-emerald-500" />
                <span>{profile.name} Voice</span>
              </button>
            </div>
          </div>

          {/* Animated Text Body */}
          <div className="relative min-h-[140px] flex-1 overflow-hidden px-4.5 py-3.5 sm:px-5">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={`${mode}-${profileId}`}
                initial={
                  reducedMotion
                    ? false
                    : { opacity: 0, y: 6, filter: "blur(2px)" }
                }
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0, y: -5, filter: "blur(2px)" }}
                transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                className="h-full"
              >
                <p className="whitespace-pre-line text-[13px] leading-relaxed text-zinc-800 sm:text-[13.5px]">
                  {displayedContent}
                </p>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Calibrated Style Rule Badges */}
          <div className="flex min-h-[42px] shrink-0 items-center gap-2 border-t border-zinc-100 bg-zinc-50/40 px-4 py-2">
            <SlidersHorizontal className="size-3 shrink-0 text-emerald-600" />
            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
              {profile.rules.map((rule) => (
                <span
                  key={rule}
                  className="inline-flex items-center gap-1 rounded-md border border-zinc-200/70 bg-white px-2 py-0.5 text-[10px] font-medium text-zinc-600 shadow-2xs"
                >
                  <span className="size-1 rounded-full bg-[#3fda8a]" />
                  {rule}
                </span>
              ))}
            </div>
          </div>

          {/* Bottom Action Footer */}
          <div className="flex h-11 shrink-0 items-center justify-between border-t border-zinc-100 bg-zinc-50/90 px-4">
            <div className="flex items-center gap-2 text-[11px] text-zinc-500">
              <span className="font-mono text-zinc-400">
                {displayedContent.length} chars
              </span>
              <span>•</span>
              <span className="text-emerald-700 font-medium">98.4% human score</span>
            </div>

            <button
              type="button"
              onClick={copyContent}
              className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2.5 text-xs font-medium text-zinc-700 shadow-2xs transition-colors hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-950"
            >
              {copied ? (
                <>
                  <Check className="size-3 text-emerald-600" />
                  <span className="text-emerald-600">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="size-3 text-zinc-400" />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Carousel indicators */}
        <div className="mt-3.5 flex shrink-0 items-center justify-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              setMode("original");
              setRotationKey((k) => k + 1);
            }}
            aria-label="Raw draft"
            className={`h-1 rounded-full transition-all duration-300 ${
              mode === "original" ? "w-6 bg-[#3fda8a]" : "w-2 bg-zinc-200"
            }`}
          />
          <button
            type="button"
            onClick={() => {
              setMode("styled");
              setRotationKey((k) => k + 1);
            }}
            aria-label="Calibrated draft"
            className={`h-1 rounded-full transition-all duration-300 ${
              mode === "styled" ? "w-6 bg-[#3fda8a]" : "w-2 bg-zinc-200"
            }`}
          />
        </div>
      </div>

      <CardBottomFade height="h-6" />
    </BentoCard>
  );
}

export default FeatureCardSixth;