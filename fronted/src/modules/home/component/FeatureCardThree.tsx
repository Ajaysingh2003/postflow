"use client";

import React, { useEffect, useRef, useState } from "react";
import { AnimatePresence, animate, motion, useInView, useReducedMotion } from "framer-motion";
import { ArrowUpRight, BarChart3, Monitor, Smartphone, Tv } from "lucide-react";
import { BentoCard, BentoHeader, CardBottomFade } from "./FeatureSection";

const BRAND = "#B3E61D";
// Pure lime is ~1.4:1 on white, fine for fills but not for lines or text
const OLIVE = "#5c7a0b";
const LINE_COLOR = "#6f8f0f";
const ease = [0.16, 1, 0.3, 1] as const;
const spring = { type: "spring", stiffness: 520, damping: 42, mass: 0.6 } as const;

/* Share of viewers still watching a 12:00 video, sampled every 30s (averages ~56%) */
const RETENTION = [100, 88, 80, 75, 71, 68, 65, 63, 61, 60, 58, 56, 60, 58, 50, 48, 45, 43, 40, 38, 36, 34, 33, 31, 30];
const STEP = 30;
const PLAYS = 124_800;
const AVG = 56;
const START_POINT = 12; // the replay bump at 6:00

const INSIGHTS = [
  { at: 1, label: "Biggest drop", time: "0:30" },
  { at: 12, label: "Replay spike", time: "6:00" },
];

const KPIS = [
  { label: "Plays", to: 124.8, format: (v: number) => `${v.toFixed(1)}K`, delta: "+14.8%", up: true },
  {
    label: "Avg. watch",
    to: 402,
    format: (v: number) => `${Math.floor(v / 60)}m ${String(Math.floor(v % 60)).padStart(2, "0")}s`,
    delta: "+9.2%",
    up: true,
  },
  { label: "Buffering", to: 0.02, format: (v: number) => `${v.toFixed(2)}%`, delta: "Healthy", up: false },
];

const LOCATIONS = [
  { code: "US", name: "United States", value: 34 },
  { code: "DE", name: "Germany", value: 16 },
  { code: "IN", name: "India", value: 12 },
  { code: "NL", name: "Netherlands", value: 11 },
  { code: "JP", name: "Japan", value: 8 },
];

const DEVICES = [
  { label: "Desktop", value: 46, icon: Monitor, color: BRAND },
  { label: "Mobile", value: 43, icon: Smartphone, color: "#11120e" },
  { label: "TV", value: 11, icon: Tv, color: "rgba(17,18,14,0.25)" },
];

/* ------------------------------ chart geometry ----------------------------- */

const n = RETENTION.length;
const points = RETENTION.map((v, i): [number, number] => [(i / (n - 1)) * 100, 100 - v]);

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

const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });
const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

/* ---------------------------------- flags ---------------------------------- */

const FLAGS: Record<string, React.ReactNode> = {
  US: (
    <>
      <rect width="30" height="20" fill="#fff" />
      {[0, 1, 2, 3, 4, 5, 6].map((i) => (
        <rect key={i} y={i * 3.077} width="30" height="1.538" fill="#B22234" />
      ))}
      <rect width="12.5" height="10.77" fill="#3C3B6E" />
      {[0, 1, 2].flatMap((r) =>
        [0, 1, 2, 3].map((c) => <circle key={`${r}${c}`} cx={2.2 + c * 2.9} cy={2.2 + r * 3} r="0.55" fill="#fff" />)
      )}
    </>
  ),
  DE: (
    <>
      <rect width="30" height="6.67" fill="#000" />
      <rect y="6.67" width="30" height="6.67" fill="#DD0000" />
      <rect y="13.33" width="30" height="6.67" fill="#FFCE00" />
    </>
  ),
  NL: (
    <>
      <rect width="30" height="6.67" fill="#AE1C28" />
      <rect y="6.67" width="30" height="6.67" fill="#fff" />
      <rect y="13.33" width="30" height="6.67" fill="#21468B" />
    </>
  ),
  IN: (
    <>
      <rect width="30" height="6.67" fill="#FF9933" />
      <rect y="6.67" width="30" height="6.67" fill="#fff" />
      <rect y="13.33" width="30" height="6.67" fill="#138808" />
      <circle cx="15" cy="10" r="2.3" fill="none" stroke="#000080" strokeWidth="0.5" />
      <circle cx="15" cy="10" r="0.5" fill="#000080" />
    </>
  ),
  JP: (
    <>
      <rect width="30" height="20" fill="#fff" />
      <circle cx="15" cy="10" r="6" fill="#BC002D" />
    </>
  ),
};

function Flag({ code, name }: { code: string; name: string }) {
  return (
    <svg
      viewBox="0 0 30 20"
      role="img"
      aria-label={name}
      className="h-[14px] w-[21px] shrink-0 rounded-[3px] shadow-[0_0_0_1px_rgba(0,0,0,0.12)]"
    >
      <title>{name}</title>
      {FLAGS[code]}
    </svg>
  );
}

/* ------------------------------- small pieces ------------------------------ */

function Counter({ to, run, format }: { to: number; run: boolean; format: (v: number) => string }) {
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

function LivePill({ run }: { run: boolean }) {
  const [count, setCount] = useState(1284);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (!run || reduced) return;
    const id = setInterval(() => setCount((c) => Math.max(900, c + Math.round((Math.random() - 0.45) * 18))), 2200);
    return () => clearInterval(id);
  }, [run, reduced]);

  return (
    <div className="flex shrink-0 items-center gap-1.5 rounded-full border border-border/70 bg-background px-2.5 py-1">
      <span className="relative flex size-1.5">
        <span className="absolute inline-flex size-full animate-ping rounded-full opacity-70" style={{ backgroundColor: BRAND }} />
        <span className="relative inline-flex size-1.5 rounded-full" style={{ backgroundColor: LINE_COLOR }} />
      </span>
      <span className="relative inline-flex h-4 items-center overflow-hidden text-[11px] font-semibold tabular-nums text-foreground">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={count}
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -10, opacity: 0 }}
            transition={{ duration: 0.25, ease }}
          >
            {count.toLocaleString("en-US")}
          </motion.span>
        </AnimatePresence>
      </span>
      <span className="font-subheading hidden text-[11px] text-muted-foreground sm:inline">watching</span>
    </div>
  );
}

/* ---------------------------------- card ----------------------------------- */

export function FeatureCardThree() {
  const rootRef = useRef<HTMLDivElement>(null);
  const plotRef = useRef<HTMLDivElement>(null);
  const inView = useInView(rootRef, { once: true, margin: "-80px" });
  const reduced = useReducedMotion();
  const show = inView || !!reduced;
  const init = <T extends object>(v: T) => (reduced ? false : v);

  const [pinned, setPinned] = useState(START_POINT);
  const [active, setActive] = useState(START_POINT);

  const value = RETENTION[active];
  const [x, y] = points[active];
  const tipX = Math.min(76, Math.max(24, x));
  const below = value > 50; // tooltip drops under the point on the high part of the curve

  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = plotRef.current?.getBoundingClientRect();
    if (!r) return;
    const frac = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    setActive(Math.round(frac * (n - 1)));
  };

  return (
    <BentoCard className="relative flex flex-col overflow-hidden bg-background">
      <BentoHeader
        icon={BarChart3}
        badge="Analytics"
        title="Know where viewers stop watching"
        description="See retention, playback health and audience behavior without installing another tracking script."
        linkText="Explore analytics ↗"
      />

      <div className="relative mt-1 flex-1 select-none px-3 pb-5 sm:px-6 sm:pb-6">
        <motion.div
          ref={rootRef}
          initial={init({ opacity: 0, y: 18 })}
          animate={show ? { opacity: 1, y: 0 } : undefined}
          transition={{ duration: 0.7, ease }}
          className="relative z-10 mx-auto w-full max-w-[620px]"
        >
          <div className="overflow-hidden rounded-[16px] border border-border/70 bg-background shadow-[0_18px_40px_-28px_rgba(15,23,42,.28)]">
            {/* Video and live audience */}
            <div className="flex h-12 items-center justify-between gap-3 border-b border-border/60 px-3 sm:h-[52px] sm:px-4">
              <div className="flex min-w-0 items-center gap-2.5">
                <div className="relative h-7 w-10 shrink-0 overflow-hidden rounded-md bg-[#151a22] sm:h-8 sm:w-11">
                  <div className="absolute inset-x-0 bottom-0 h-[48%] bg-[#bd8467]" />
                  <div className="absolute inset-x-0 bottom-0 h-[38%] bg-[#202631] [clip-path:polygon(0_80%,20%_45%,37%_65%,56%_30%,75%_65%,100%_42%,100%_100%,0_100%)]" />
                </div>
                <div className="min-w-0">
                  <p className="font-heading truncate text-xs font-semibold text-foreground sm:text-sm">Q3 launch keynote</p>
                  <p className="font-subheading mt-0.5 text-[10px] text-muted-foreground">12:00 long</p>
                </div>
              </div>
              <LivePill run={show} />
            </div>

            {/* Headline numbers count up once in view */}
            <div className="grid grid-cols-3 divide-x divide-border/60 border-b border-border/60">
              {KPIS.map((k) => (
                <div key={k.label} className="min-w-0 px-2.5 py-2.5 sm:px-4 sm:py-3">
                  <p className="font-subheading truncate text-[11px] font-medium text-muted-foreground">{k.label}</p>
                  <div className="mt-1 flex items-baseline gap-1.5">
                    <span className="font-heading truncate text-sm font-bold tracking-tight tabular-nums text-foreground sm:text-base">
                      <Counter to={k.to} run={show} format={k.format} />
                    </span>
                    <span
                      className="font-subheading hidden items-center text-[10px] font-semibold sm:inline-flex"
                      style={{ color: OLIVE }}
                    >
                      {k.up && <ArrowUpRight className="size-3" />}
                      {k.delta}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Audience retention */}
            <div className="px-3 pt-3 sm:px-4 sm:pt-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-heading text-xs font-bold text-foreground sm:text-sm">Audience retention</p>
                  <p className="font-subheading mt-0.5 text-[11px] text-muted-foreground">Still watching, last 28 days</p>
                </div>
                <div className="flex shrink-0 items-baseline gap-1">
                  <span className="font-heading text-xs font-bold tabular-nums text-foreground sm:text-sm">{AVG}%</span>
                  <span className="font-subheading text-[10px] text-muted-foreground">avg.</span>
                </div>
              </div>

              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {INSIGHTS.map((ins) => {
                  const on = pinned === ins.at;
                  return (
                    <button
                      key={ins.at}
                      type="button"
                      aria-pressed={on}
                      onClick={() => {
                        setPinned(ins.at);
                        setActive(ins.at);
                      }}
                      className={`font-subheading rounded-full border px-2.5 py-1 text-[11px] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground ${
                        on
                          ? "border-foreground bg-foreground text-background"
                          : "border-border bg-background text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {ins.label} <span className="tabular-nums opacity-70">{ins.time}</span>
                    </button>
                  );
                })}
              </div>

              <div className="mt-3 flex gap-1.5 sm:gap-2">
                <div
                  aria-hidden
                  className="font-subheading flex h-[104px] shrink-0 flex-col justify-between py-0.5 text-right text-[10px] leading-none text-muted-foreground/70 sm:h-[132px]"
                >
                  <span>100</span>
                  <span>50</span>
                  <span>0</span>
                </div>

                <div className="min-w-0 flex-1">
                  <div
                    ref={plotRef}
                    onPointerMove={onMove}
                    onPointerDown={onMove}
                    onPointerLeave={() => setActive(pinned)}
                    onPointerCancel={() => setActive(pinned)}
                    role="img"
                    aria-label={`Audience retention over 12 minutes. ${value}% still watching at ${fmtTime(active * STEP)}.`}
                    className="relative h-[104px] cursor-crosshair touch-pan-y sm:h-[132px]"
                  >
                    {/* The curve wipes in from the left */}
                    <motion.svg
                      viewBox="0 0 100 100"
                      preserveAspectRatio="none"
                      aria-hidden
                      className="absolute inset-0 size-full overflow-visible text-foreground"
                      initial={init({ clipPath: "inset(-6px 100% -6px -6px)" })}
                      animate={show ? { clipPath: "inset(-6px 0% -6px -6px)" } : undefined}
                      transition={{ duration: 1.3, ease, delay: 0.25 }}
                    >
                      <defs>
                        <linearGradient id="retention-area" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0" stopColor={BRAND} stopOpacity="0.42" />
                          <stop offset="1" stopColor={BRAND} stopOpacity="0" />
                        </linearGradient>
                      </defs>
                      {[0, 50, 100].map((g) => (
                        <line key={g} x1="0" x2="100" y1={g} y2={g} stroke="currentColor" strokeOpacity="0.08" strokeDasharray="2 3" vectorEffect="non-scaling-stroke" />
                      ))}
                      <line x1="0" x2="100" y1={100 - AVG} y2={100 - AVG} stroke={LINE_COLOR} strokeOpacity="0.55" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
                      <path d={AREA} fill="url(#retention-area)" />
                      <path d={LINE} fill="none" stroke={LINE_COLOR} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
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
                        className="absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background bg-[#11120e] shadow ring-4 ring-[#B3E61D]/30"
                      />
                      <motion.div
                        aria-hidden
                        initial={false}
                        animate={{ left: `${tipX}%`, top: `${y}%` }}
                        transition={spring}
                        className="absolute z-20 w-max -translate-x-1/2"
                      >
                        <div
                          className={`min-w-[96px] rounded-lg border border-white/[0.08] bg-[#11120e] px-2.5 py-1.5 zshadow-lg transition-transform duration-150 ${
                            below ? "translate-y-3" : "-translate-y-[calc(100%+12px)]"
                          }`}
                        >
                          <p className="font-subheading text-[10px] text-white/50">{fmtTime(active * STEP)}</p>
                          <p className="font-heading mt-0.5 text-xs font-bold tabular-nums text-white">{value}% watching</p>
                          <p className="font-subheading mt-0.5 hidden text-[10px] tabular-nums text-white/50 sm:block">
                            {compact.format(Math.round((PLAYS * value) / 100))} viewers
                          </p>
                        </div>
                      </motion.div>
                    </motion.div>
                  </div>

                  <div aria-hidden className="font-subheading mt-1.5 flex justify-between text-[10px] text-muted-foreground/70">
                    {["0:00", "3:00", "6:00", "9:00", "12:00"].map((t) => (
                      <span key={t}>{t}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Where viewers are, and what they watch on */}
            <div className="mt-4 grid grid-cols-2 border-t border-border/60">
              <div className="border-r border-border/60 px-3 py-3 sm:px-4">
                <div className="flex items-center justify-between">
                  <p className="font-heading text-xs font-semibold text-foreground">Top locations</p>
                  <span className="font-subheading hidden text-[10px] text-muted-foreground sm:inline">142 countries</span>
                </div>
                <ul className="mt-2.5 space-y-2">
                  {LOCATIONS.map((l, i) => (
                    <motion.li
                      key={l.code}
                      className="flex items-center gap-2"
                      initial={init({ opacity: 0, x: -6 })}
                      animate={show ? { opacity: 1, x: 0 } : undefined}
                      transition={{ duration: 0.5, ease, delay: 0.5 + i * 0.07 }}
                    >
                      <Flag code={l.code} name={l.name} />
                      <span className="h-1.5 min-w-0 flex-1 rounded-full bg-foreground/[0.06]">
                        <motion.span
                          className="block h-full rounded-full"
                          initial={init({ scaleX: 0 })}
                          animate={show ? { scaleX: 1 } : undefined}
                          transition={{ duration: 0.9, ease, delay: 0.6 + i * 0.07 }}
                          style={{
                            originX: 0,
                            width: `${(l.value / 34) * 100}%`,
                            backgroundColor: i === 0 ? BRAND : "rgba(17,18,14,0.25)",
                          }}
                        />
                      </span>
                      <span className="font-subheading w-7 text-right text-[10px] font-medium tabular-nums text-muted-foreground">{l.value}%</span>
                    </motion.li>
                  ))}
                </ul>
              </div>

              <div className="px-3 py-3 sm:px-4">
                <p className="font-heading text-xs font-semibold text-foreground">Devices</p>
                <div className="mt-2.5 flex h-1.5 gap-0.5 overflow-hidden rounded-full">
                  {DEVICES.map((d, i) => (
                    <motion.span
                      key={d.label}
                      className="h-full rounded-full"
                      initial={init({ scaleX: 0 })}
                      animate={show ? { scaleX: 1 } : undefined}
                      transition={{ duration: 0.9, ease, delay: 0.6 + i * 0.1 }}
                      style={{ originX: 0, width: `${d.value}%`, backgroundColor: d.color }}
                    />
                  ))}
                </div>
                <ul className="mt-3 space-y-2">
                  {DEVICES.map((d) => (
                    <li key={d.label} className="flex items-center gap-2">
                      <span className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: d.color }} />
                      <d.icon className="size-3 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground">{d.label}</span>
                      <span className="font-subheading text-[10px] font-semibold tabular-nums text-foreground">{d.value}%</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </motion.div>
        <CardBottomFade height="h-28" />
      </div>
    </BentoCard>
  );
}