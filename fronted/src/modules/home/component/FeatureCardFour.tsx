"use client";

import React, { useEffect, useRef, useState } from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";
import {
  Check,
  CornerDownRight,
  Lightbulb,
  Mail,
  Repeat2,
  Sparkles,
} from "lucide-react";
import { BentoCard, BentoHeader, CardBottomFade } from "./FeatureSection";

const BRAND = "#3fda8a";
const ease = [0.16, 1, 0.3, 1] as const;

const SOURCE = "Why consistency compounds faster than going viral";
const CARD_W = 31;

type Format = "linkedin" | "x" | "threads" | "newsletter";

interface CardConfig {
  id: Format;
  name: string;
  tag: string;
  x: number;
  rot: number;
  top: number;
  z: number;
}

const CARDS: CardConfig[] = [
  { id: "linkedin", name: "LinkedIn", tag: "Post", x: 9, rot: -10, top: 52, z: 10 },
  { id: "x", name: "X", tag: "Thread", x: 28, rot: -5, top: 30, z: 20 },
  { id: "threads", name: "Threads", tag: "Take", x: 72, rot: 5, top: 30, z: 20 },
  { id: "newsletter", name: "Newsletter", tag: "Email", x: 91, rot: 10, top: 52, z: 10 },
];

/* ----------------------------- Platform Icons ------------------------------ */

const LINKEDIN_PATH =
  "M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z";
const X_PATH =
  "M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z";
const THREADS_PATH =
  "M16.5 9.5c-.6-2.2-2.3-3.5-4.7-3.5C8.6 6 6.5 8.5 6.5 12s2.1 6 5.3 6c2.6 0 4.2-1.4 4.2-3.2 0-2-1.8-3-4-3-1.5 0-2.4.7-2.4 1.6 0 .8.7 1.4 1.8 1.4 1.9 0 3.1-1.5 3.1-4";

function PlatformBadge({ id }: { id: Format }) {
  if (id === "newsletter") {
    return (
      <span className="flex size-4.5 shrink-0 items-center justify-center rounded-md bg-emerald-50 text-emerald-600 ring-1 ring-emerald-500/20">
        <Mail className="size-2.5" />
      </span>
    );
  }

  if (id === "linkedin") {
    return (
      <span className="flex size-4.5 shrink-0 items-center justify-center rounded-md bg-[#0A66C2] text-white shadow-xs">
        <svg viewBox="0 0 24 24" className="size-2.5 fill-current">
          <path d={LINKEDIN_PATH} />
        </svg>
      </span>
    );
  }

  return (
    <span className="flex size-4.5 shrink-0 items-center justify-center rounded-md bg-zinc-900 text-white shadow-xs">
      <svg viewBox="0 0 24 24" className="size-2.5">
        {id === "threads" ? (
          <path
            d={THREADS_PATH}
            fill="none"
            stroke="currentColor"
            strokeWidth="2.6"
            strokeLinecap="round"
          />
        ) : (
          <path d={X_PATH} fill="currentColor" />
        )}
      </svg>
    </span>
  );
}

/* ------------------------------ Format Previews ---------------------------- */

function PreviewContent({ id }: { id: Format }) {
  switch (id) {
    case "linkedin":
      return (
        <div className="space-y-1.5 text-left">
          <p className="line-clamp-2 text-[10.5px] font-semibold leading-snug text-zinc-900">
            One viral post earns quick attention. A weekly habit builds enterprise trust.
          </p>
          <p className="line-clamp-2 text-[9.5px] leading-relaxed text-zinc-500">
            3 frameworks top founders use to sustain high-signal distribution.
          </p>
          <div className="pt-1">
            <span className="inline-flex items-center gap-1 text-[9px] font-semibold text-[#0A66C2]">
              See 3 takeaways <CornerDownRight className="size-2.5" />
            </span>
          </div>
        </div>
      );

    case "x":
      return (
        <div className="relative space-y-2 pl-2.5 text-left">
          <span
            aria-hidden
            className="absolute bottom-1 left-0 top-1 w-px bg-zinc-200"
          />
          <div className="space-y-1">
            <span className="font-mono text-[9px] font-semibold text-zinc-400">1/4</span>
            <p className="line-clamp-2 text-[10px] font-medium leading-snug text-zinc-800">
              Going viral has a 24-hour half-life. Compounding reach lasts years.
            </p>
          </div>
          <p className="line-clamp-1 text-[9.5px] text-zinc-500">
            Here is the playbook: 🧵
          </p>
        </div>
      );

    case "threads":
      return (
        <div className="space-y-1.5 text-left">
          <div className="inline-block rounded-full bg-zinc-100 px-1.5 py-0.5 text-[8.5px] font-semibold text-zinc-600">
            Hot take
          </div>
          <p className="line-clamp-3 text-[10px] font-medium leading-snug text-zinc-800">
            Showing up every single Monday beats every growth hack ever invented. Who agrees?
          </p>
        </div>
      );

    case "newsletter":
      return (
        <div className="space-y-1.5 text-left">
          <span className="font-mono text-[8.5px] font-medium uppercase tracking-wider text-emerald-600">
            Issue #48
          </span>
          <p className="line-clamp-2 text-[10.5px] font-semibold leading-snug text-zinc-900">
            The Boring Routine That Scales Founder Distribution
          </p>
          <span className="inline-flex rounded-md bg-zinc-100 px-1.5 py-0.5 text-[9px] font-medium text-zinc-600">
            4 min read →
          </span>
        </div>
      );
  }
}

/* --------------------------------- Component -------------------------------- */

export function FeatureCardFour() {
  const areaRef = useRef<HTMLDivElement>(null);
  const seen = useInView(areaRef, { once: true, margin: "-80px" });
  const live = useInView(areaRef, { margin: "-40px" });
  const reduced = !!useReducedMotion();
  const show = seen || reduced;

  const [out, setOut] = useState(false);
  const [pulse, setPulse] = useState(0);

  useEffect(() => {
    if (reduced) {
      setOut(true);
      return;
    }
    if (!live) return;

    let timeout: ReturnType<typeof setTimeout>;

    const step = (next: boolean) => {
      setOut(next);
      if (next) setPulse((p) => p + 1);
      timeout = setTimeout(() => step(!next), next ? 5600 : 900);
    };

    timeout = setTimeout(() => step(true), 600);
    return () => clearTimeout(timeout);
  }, [live, reduced]);

  return (
    <BentoCard className="relative flex !h-[490px] flex-col overflow-hidden border-zinc-200/80 bg-white sm:!h-[500px]">
      <BentoHeader
        icon={Repeat2}
        badge="Omnichannel Engine"
        title="One raw note. Every channel tailored."
        description="Write your thought once. Draftva automatically restructures hooks, cadence, and line-breaks for every social platform."
        linkText="See repurposing workflow ↗"
        href="/register"
      />

      <div
        ref={areaRef}
        className="relative min-h-0 flex-1 select-none overflow-hidden"
      >
        <div className="absolute inset-y-0 left-1/2 w-full max-w-[620px] -translate-x-1/2">
          <motion.div
            role="img"
            aria-label="One idea expands into four native platform posts"
            className="relative h-full"
            initial={reduced ? false : { opacity: 0, y: 16 }}
            animate={show ? { opacity: 1, y: 0 } : undefined}
            transition={{ duration: 0.7, ease }}
          >
            {/* Ambient Violet + Mint Dual Glow */}
            <div
              aria-hidden
              className="pointer-events-none absolute left-1/2 top-[90px] h-48 w-88 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle_at_center,rgba(83,64,249,0.18)_0%,rgba(63,218,138,0.12)_45%,transparent_75%)] blur-[55px]"
            />

            {/* Precision Radar / Orbit Rings */}
            {[210, 330, 450].map((size) => (
              <motion.span
                key={size}
                aria-hidden
                className="pointer-events-none absolute left-1/2 top-[90px] rounded-full border border-zinc-200/60"
                style={{
                  width: size,
                  height: size,
                  marginLeft: -size / 2,
                  marginTop: -size / 2,
                }}
                initial={false}
                animate={{ opacity: out ? 0.75 : 0.2, scale: out ? 1 : 0.88 }}
                transition={{ duration: reduced ? 0 : 0.9, ease }}
              />
            ))}

            {/* Fanned Out Destination Cards */}
            {CARDS.map((c, i) => {
              const tucked = `${-50 + ((50 - c.x) / CARD_W) * 100}%`;
              const delay = out ? 0.12 + i * 0.11 : 0;

              return (
                <motion.div
                  key={c.id}
                  aria-hidden
                  className={`absolute w-[31%] min-w-[118px] max-w-[185px] hover:!z-40 ${
                    out ? "" : "pointer-events-none"
                  }`}
                  style={{
                    left: `${c.x}%`,
                    top: c.top,
                    zIndex: c.z,
                    transformOrigin: "50% 120%",
                  }}
                  initial={false}
                  animate={
                    out
                      ? { x: "-50%", rotate: c.rot, scale: 1, opacity: 1 }
                      : { x: tucked, rotate: 0, scale: 0.85, opacity: 0 }
                  }
                  transition={
                    reduced
                      ? { duration: 0 }
                      : {
                          type: "spring",
                          stiffness: 180,
                          damping: 20,
                          delay,
                          opacity: { duration: 0.26, delay },
                        }
                  }
                  whileHover={
                    reduced
                      ? undefined
                      : {
                          y: -10,
                          rotate: 0,
                          scale: 1.05,
                          transition: { type: "spring", stiffness: 320, damping: 22 },
                        }
                  }
                >
                  {/* Frosted Layered Surface */}
                  <div className="group relative flex h-[256px] flex-col justify-between rounded-2xl border border-zinc-200/90 bg-gradient-to-b from-white via-white to-zinc-50/60 p-3 shadow-[0_16px_36px_-16px_rgba(15,23,42,0.12),0_1px_3px_rgba(0,0,0,0.03)] backdrop-blur-md transition-all sm:p-3.5">
                    <div>
                      {/* Top Channel Pill */}
                      <div className="flex items-center justify-between border-b border-zinc-100 pb-2">
                        <div className="flex items-center gap-1.5">
                          <PlatformBadge id={c.id} />
                          <span className="text-[11px] font-semibold text-zinc-900">
                            {c.name}
                          </span>
                        </div>
                        <span className="rounded-sm bg-zinc-100 px-1 py-0.5 font-mono text-[8.5px] font-medium text-zinc-500">
                          {c.tag}
                        </span>
                      </div>

                      {/* Content Preview */}
                      <div className="mt-2.5">
                        <PreviewContent id={c.id} />
                      </div>
                    </div>

                    {/* Micro Skeleton Footer Lines */}
                    <div className="border-t border-zinc-100 pt-2">
                      <div className="space-y-1">
                        <span className="block h-1 w-full rounded-full bg-zinc-100" />
                        <span className="block h-1 w-2/3 rounded-full bg-zinc-100" />
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}

            {/* Central High-Contrast Violet Source Card */}
            <div
              aria-hidden
              className="absolute left-1/2 top-2 z-30 w-[38%] min-w-[140px] max-w-[224px] -translate-x-1/2"
            >
              {/* Outer Energy Pulse Ring */}
              {out && !reduced && (
                <motion.span
                  key={pulse}
                  className="pointer-events-none absolute -inset-1 rounded-[22px] border"
                  style={{ borderColor: BRAND }}
                  initial={{ opacity: 0.7, scale: 1 }}
                  animate={{ opacity: 0, scale: 1.12 }}
                  transition={{ duration: 1.1, ease: "easeOut" }}
                />
              )}

              {/* Polished Violet Hub Surface */}
              <div className="relative h-[272px] overflow-hidden rounded-2xl border border-white/25 bg-gradient-to-b from-[#604dff] via-[#5340f9] to-[#432ee6] p-3.5 shadow-[0_24px_50px_-14px_rgba(83,64,249,0.55),inset_0_1px_0_0_rgba(255,255,255,0.25)]">
                {/* Top White Rim Flare */}
                <span className="pointer-events-none absolute -top-10 left-1/2 h-28 w-44 -translate-x-1/2 rounded-full bg-white/25 blur-2xl" />
                {/* Bottom Mint Ambient Burst */}
                <span className="pointer-events-none absolute -bottom-10 right-0 h-28 w-28 rounded-full bg-[#3fda8a]/25 blur-2xl" />

                {/* Header Badge */}
                <div className="relative flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="flex size-5 items-center justify-center rounded-md bg-white/15 text-[#3fda8a] shadow-inner backdrop-blur-xs">
                      <Lightbulb className="size-3 text-[#3fda8a]" />
                    </span>
                    <span className="font-mono text-[9px] font-semibold tracking-wider uppercase text-violet-200">
                      Raw Note
                    </span>
                  </div>
                  <span className="flex size-1.5 rounded-full bg-[#3fda8a] shadow-[0_0_8px_#3fda8a]" />
                </div>

                {/* Core Thought Headline */}
                <p className="relative mt-2.5 text-[12.5px] font-semibold leading-[1.3] text-white sm:text-[13px]">
                  {SOURCE}
                </p>

                {/* Translucent Frosted Separator */}
                <div className="relative my-3 h-px bg-white/15" />

                {/* Progress Checklist */}
                <ul className="relative space-y-2">
                  {CARDS.map((c, i) => (
                    <li
                      key={c.id}
                      className="flex h-4 items-center justify-between text-[11px]"
                    >
                      <span
                        className={`truncate font-medium transition-colors duration-300 ${
                          out ? "text-white" : "text-violet-200/50"
                        }`}
                      >
                        {c.name}
                      </span>
                      <span className="relative flex size-3.5 shrink-0 items-center justify-center">
                        <span className="absolute inset-0 rounded-full border border-white/25" />
                        {out && (
                          <motion.span
                            key={`${pulse}-${c.id}`}
                            className="absolute inset-0 flex items-center justify-center rounded-full bg-[#3fda8a] shadow-[0_0_8px_rgba(63,218,138,0.5)]"
                            initial={reduced ? false : { scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{
                              type: "spring",
                              stiffness: 350,
                              damping: 20,
                              delay: 0.28 + i * 0.12,
                            }}
                          >
                            <Check className="size-2.5 stroke-[3] text-[#062c16]" />
                          </motion.span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>

                {/* Synthesis Status Footer */}
                <div className="relative mt-3.5 flex items-center justify-between border-t border-white/15 pt-2 text-[10px]">
                  <span
                    className="flex items-center gap-1.5 font-medium transition-colors"
                    style={{ color: out ? "#3fda8a" : "rgba(221, 214, 254, 0.65)" }}
                  >
                    <span
                      className={`size-1.5 rounded-full ${
                        out
                          ? "bg-[#3fda8a] shadow-[0_0_6px_#3fda8a]"
                          : "bg-violet-300/40 animate-pulse"
                      }`}
                    />
                    {out ? "4 tailored formats" : "Synthesizing…"}
                  </span>

                </div>
              </div>
            </div>
          </motion.div>
        </div>

        <CardBottomFade height="h-14" />
      </div>
    </BentoCard>
  );
}

export default FeatureCardFour;