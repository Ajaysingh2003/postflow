"use client";

import React, { useEffect, useRef, useState } from "react";
import { animate, motion, useInView, useReducedMotion } from "framer-motion";
import { ArrowUpRight, BarChart3 } from "lucide-react";
import { BentoCard, BentoHeader, CardBottomFade } from "./FeatureSection";
import { PlatformBadge } from "./PlatformBadge";

const BRAND = "#3fda8a";
// Pure brand green is too light for thin lines and small text on white
const DEEP = "#1f9d5c";
const ease = [0.16, 1, 0.3, 1] as const;
const spring = {
  type: "spring",
  stiffness: 520,
  damping: 42,
  mass: 0.6,
} as const;

// Plot height. The y-axis labels use the same value so they always line up.
const CHART_H = "h-[78px]";

/* ------------------------------- demo data -------------------------------- */

/* Daily impressions, Sep 14 to Oct 11 (28 days) */
const DATA = [
  3200, 3400, 3100, 3800, 4100, 3600, 3300, 4200, 4500, 4300, 4800, 5200, 4700,
  4400, 5600, 6100, 5800, 5400, 6300, 7200, 6800, 6100, 8100, 8600, 8100, 7400,
  9300, 9900,
];
const MAX = 10_000;
const TOTAL = DATA.reduce((sum, v) => sum + v, 0);
const AVG = Math.round(TOTAL / DATA.length);
const ENGAGEMENT_RATE = 0.046;
const BEST = DATA.indexOf(Math.max(...DATA)); // the tooltip rests on the best day

const KPIS = [
  {
    label: "Impressions",
    to: TOTAL / 1000,
    format: (v: number) => `${v.toFixed(1)}K`,
    delta: "+18.4%",
  },
  {
    label: "Engagement",
    to: 4.6,
    format: (v: number) => `${v.toFixed(1)}%`,
    delta: "+0.9%",
  },
  {
    label: "New followers",
    to: 1840,
    format: (v: number) => `+${Math.round(v).toLocaleString("en-US")}`,
    delta: "+11.2%",
  },
];

type Platform = "linkedin" | "x";

const TOP_POST: { platform: Platform; title: string; rate: number } = {
  platform: "linkedin",
  title: "Why consistency beats going viral",
  rate: 8.4,
};

const PLATFORMS: { label: string; value: number; color: string }[] = [
  { label: "LinkedIn", value: 54, color: BRAND },
  { label: "X", value: 31, color: "#11120e" },
  { label: "Threads", value: 15, color: "rgba(17,18,14,0.25)" },
];
const PLATFORM_SUMMARY = PLATFORMS.map((p) => `${p.label} ${p.value}%`).join(
  " · ",
);

/* ------------------------------ chart geometry ----------------------------- */

const n = DATA.length;
const points = DATA.map((v, i): [number, number] => [
  (i / (n - 1)) * 100,
  100 - (v / MAX) * 100,
]);
const AVG_Y = 100 - (AVG / MAX) * 100;

// Catmull-Rom to cubic Bézier, so the curve passes through every sample
function smooth(p: [number, number][]) {
  const f = (v: number) => v.toFixed(2);
  let d = `M${f(p[0][0])} ${f(p[0][1])}`;
  for (let i = 0; i < p.length - 1; i++) {
    const p0 = p[i - 1] ?? p[i];
    const p1 = p[i];
    const p2 = p[i + 1];
    const p3 = p[i + 2] ?? p2;
    d += ` C${f(p1[0] + (p2[0] - p0[0]) / 6)} ${f(p1[1] + (p2[1] - p0[1]) / 6)} ${f(p2[0] - (p3[0] - p1[0]) / 6)} ${f(p2[1] - (p3[1] - p1[1]) / 6)} ${f(p2[0])} ${f(p2[1])}`;
  }
  return d;
}
const LINE = smooth(points);
const AREA = `${LINE} L100 100 L0 100 Z`;

const compact = new Intl.NumberFormat("en", {
  notation: "compact",
  maximumFractionDigits: 1,
});
const dateFmt = new Intl.DateTimeFormat("en", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});
const dateAt = (i: number) =>
  dateFmt.format(new Date(Date.UTC(2026, 8, 14 + i)));

/* ------------------------------- small pieces ------------------------------ */

function Counter({
  to,
  run,
  format,
}: {
  to: number;
  run: boolean;
  format: (v: number) => string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced) {
      if (ref.current) ref.current.textContent = format(to);
      return;
    }
    if (!run) return;
    const controls = animate(0, to, {
      duration: 1.4,
      ease,
      onUpdate: (v) => {
        if (ref.current) ref.current.textContent = format(v);
      },
    });
    return () => controls.stop();
  }, [run, to, format, reduced]);

  return <span ref={ref}>{format(0)}</span>;
}

/* ---------------------------------- card ----------------------------------- */

export function FeatureCardThree() {
  const rootRef = useRef<HTMLDivElement>(null);
  const plotRef = useRef<HTMLDivElement>(null);
  const inView = useInView(rootRef, { once: true, margin: "-80px" });
  const reduced = useReducedMotion();
  const show = inView || !!reduced;
  const init = <T extends object>(v: T) => (reduced ? false : v);

  const [active, setActive] = useState(BEST);

  const value = DATA[active];
  const [x, y] = points[active];
  const tipX = Math.min(76, Math.max(24, x));
  const below = y < 45; // tooltip drops under the point near the top of the chart

  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = plotRef.current?.getBoundingClientRect();
    if (!r) return;
    const frac = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    setActive(Math.round(frac * (n - 1)));
  };

  return (
    <BentoCard className="relative flex !h-[460px] flex-col overflow-hidden bg-background sm:!h-[500px]">
      <BentoHeader
        icon={BarChart3}
        badge="Analytics"
        title="Know what works. Grow faster."
        description="Track engagement, understand your audience, and discover which content performs best."
        linkText="Explore analytics ↗"
        href="/product/analytics"
      />

      {/* Fills the space under the header. Anything that ever overflows is clipped. */}
      <div className="relative min-h-0 flex-1 select-none overflow-hidden px-3 pb-4 sm:px-6 sm:pb-6">
        <motion.div
          ref={rootRef}
          initial={init({ opacity: 0, y: 18 })}
          animate={show ? { opacity: 1, y: 0 } : undefined}
          transition={{ duration: 0.7, ease }}
          className="relative z-10 mx-auto w-full max-w-[560px]"
        >
          <div className="overflow-hidden rounded-[16px] border border-border/70 bg-background shadow-[0_18px_40px_-28px_rgba(15,23,42,.28)]">
            {/* Headline numbers count up once in view */}
            <div className="grid grid-cols-3 divide-x divide-border/60 border-b border-border/60">
              {KPIS.map((k) => (
                <div key={k.label} className="min-w-0 px-3 py-2 sm:px-4">
                  <p className="font-subheading truncate text-[10.5px] font-medium leading-4 text-muted-foreground">
                    {k.label}
                  </p>
                  <div className="mt-0.5 flex items-baseline gap-1.5">
                    <span className="font-heading truncate text-sm font-bold leading-[18px] tracking-tight tabular-nums text-foreground sm:text-[15px]">
                      <Counter to={k.to} run={show} format={k.format} />
                    </span>
                    <span
                      className="font-subheading hidden items-center text-[10px] font-semibold leading-none sm:inline-flex"
                      style={{ color: DEEP }}
                    >
                      <ArrowUpRight className="size-3" aria-hidden="true" />
                      {k.delta}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Impressions over time */}
            <div className="px-3 pb-2 pt-2.5 sm:px-4">
              <div className="flex items-center justify-between gap-3">
                <p className="font-heading text-xs font-semibold leading-4 text-foreground">
                  Impressions
                  <span className="font-subheading ml-1.5 font-normal text-muted-foreground">
                    · last 28 days
                  </span>
                </p>
                <p className="font-subheading shrink-0 text-[10px] leading-4 text-muted-foreground">
                  <span className="font-semibold tabular-nums text-foreground">
                    {compact.format(AVG)}
                  </span>{" "}
                  avg. / day
                </p>
              </div>

              <div className="mt-2 flex gap-1.5">
                <div
                  aria-hidden
                  className={`font-subheading flex ${CHART_H} shrink-0 flex-col justify-between py-0.5 text-right text-[9.5px] leading-none text-muted-foreground/70`}
                >
                  <span>10K</span>
                  <span>5K</span>
                  <span>0</span>
                </div>

                <div className="min-w-0 flex-1">
                  <div
                    ref={plotRef}
                    onPointerMove={onMove}
                    onPointerDown={onMove}
                    onPointerLeave={() => setActive(BEST)}
                    onPointerCancel={() => setActive(BEST)}
                    role="img"
                    aria-label={`Daily impressions over 28 days. ${value.toLocaleString("en-US")} impressions on ${dateAt(active)}.`}
                    className={`relative ${CHART_H} cursor-crosshair touch-pan-y`}
                  >
                    {/* The curve wipes in from the left */}
                    <motion.svg
                      viewBox="0 0 100 100"
                      preserveAspectRatio="none"
                      aria-hidden
                      className="absolute inset-0 size-full overflow-visible text-foreground"
                      initial={init({ clipPath: "inset(-6px 100% -6px -6px)" })}
                      animate={
                        show
                          ? { clipPath: "inset(-6px 0% -6px -6px)" }
                          : undefined
                      }
                      transition={{ duration: 1.3, ease, delay: 0.25 }}
                    >
                      <defs>
                        <linearGradient
                          id="analytics-area"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="0"
                            stopColor={BRAND}
                            stopOpacity="0.38"
                          />
                          <stop offset="1" stopColor={BRAND} stopOpacity="0" />
                        </linearGradient>
                      </defs>
                      {[0, 50, 100].map((g) => (
                        <line
                          key={g}
                          x1="0"
                          x2="100"
                          y1={g}
                          y2={g}
                          stroke="currentColor"
                          strokeOpacity="0.08"
                          strokeDasharray="2 3"
                          vectorEffect="non-scaling-stroke"
                        />
                      ))}
                      <line
                        x1="0"
                        x2="100"
                        y1={AVG_Y}
                        y2={AVG_Y}
                        stroke={DEEP}
                        strokeOpacity="0.5"
                        strokeDasharray="4 4"
                        vectorEffect="non-scaling-stroke"
                      />
                      <path d={AREA} fill="url(#analytics-area)" />
                      <path
                        d={LINE}
                        fill="none"
                        stroke={DEEP}
                        strokeWidth="2"
                        strokeLinejoin="round"
                        strokeLinecap="round"
                        vectorEffect="non-scaling-stroke"
                      />
                    </motion.svg>

                    {/* Cursor, point and readout appear once the curve has drawn */}
                    <motion.div
                      className="pointer-events-none absolute inset-0"
                      initial={init({ opacity: 0 })}
                      animate={show ? { opacity: 1 } : undefined}
                      transition={{ duration: 0.4, delay: 1.3 }}
                    >
                      <motion.span
                        aria-hidden
                        initial={false}
                        animate={{ left: `${x}%` }}
                        transition={spring}
                        className="absolute inset-y-0 w-px bg-foreground/15"
                      />
                      <motion.span
                        aria-hidden
                        initial={false}
                        animate={{ left: `${x}%`, top: `${y}%` }}
                        transition={spring}
                        className="absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background bg-[#11120e] shadow ring-4 ring-[#3fda8a]/30"
                      />
                      <motion.div
                        aria-hidden
                        initial={false}
                        animate={{ left: `${tipX}%`, top: `${y}%` }}
                        transition={spring}
                        className="absolute z-20 w-max -translate-x-1/2"
                      >
                        <div
                          className={`rounded-lg border border-white/[0.08] bg-[#11120e] px-2.5 py-1.5 shadow-lg transition-transform duration-150 ${
                            below
                              ? "translate-y-3"
                              : "-translate-y-[calc(100%+12px)]"
                          }`}
                        >
                          <p className="font-subheading text-[10px] leading-[14px] text-white/50">
                            {dateAt(active)}
                            <span className="hidden sm:inline">
                              {" · "}
                              {Math.round(
                                value * ENGAGEMENT_RATE,
                              ).toLocaleString("en-US")}{" "}
                              engagements
                            </span>
                          </p>
                          <p className="font-heading text-xs font-bold leading-4 tabular-nums text-white">
                            {value.toLocaleString("en-US")} impressions
                          </p>
                        </div>
                      </motion.div>
                    </motion.div>
                  </div>

                  <div
                    aria-hidden
                    className="font-subheading mt-1 flex justify-between text-[9.5px] leading-[14px] text-muted-foreground/70"
                  >
                    {[0, 7, 14, 20, 27].map((i) => (
                      <span key={i}>{dateAt(i)}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* One-line summary: best post and platform mix (hidden on mobile to save height) */}
            <div className="hidden items-center justify-between gap-4 border-t border-border/60 px-4 py-2 sm:flex">
              <motion.div
                className="flex min-w-0 items-center gap-2"
                initial={init({ opacity: 0, x: -6 })}
                animate={show ? { opacity: 1, x: 0 } : undefined}
                transition={{ duration: 0.5, ease, delay: 0.5 }}
              >
                <span className="font-subheading shrink-0 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Top post
                </span>
                <PlatformBadge platform={TOP_POST.platform} />
                <span className="min-w-0 truncate text-[11px] text-foreground">
                  {TOP_POST.title}
                </span>
                <span
                  className="font-subheading shrink-0 rounded bg-[#e4fbee] px-1.5 py-px text-[10px] font-semibold tabular-nums"
                  style={{ color: DEEP }}
                >
                  {TOP_POST.rate}% eng.
                </span>
              </motion.div>

              <div
                className="flex shrink-0 items-center gap-2"
                title={PLATFORM_SUMMARY}
                aria-label={PLATFORM_SUMMARY}
              >
                <div className="flex h-1.5 w-16 gap-0.5 overflow-hidden rounded-full">
                  {PLATFORMS.map((p, i) => (
                    <motion.span
                      key={p.label}
                      className="h-full rounded-full"
                      initial={init({ scaleX: 0 })}
                      animate={show ? { scaleX: 1 } : undefined}
                      transition={{ duration: 0.9, ease, delay: 0.6 + i * 0.1 }}
                      style={{
                        originX: 0,
                        width: `${p.value}%`,
                        backgroundColor: p.color,
                      }}
                    />
                  ))}
                </div>
                <span className="font-subheading text-[10px] text-muted-foreground">
                  <span className="font-semibold tabular-nums text-foreground">
                    {PLATFORMS[0].value}%
                  </span>{" "}
                  {PLATFORMS[0].label}
                </span>
              </div>
            </div>
          </div>
        </motion.div>

        <CardBottomFade height="h-5" />
      </div>
    </BentoCard>
  );
}
