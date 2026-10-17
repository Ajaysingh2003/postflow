"use client";

import React, { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  Check,
  ChevronDown,
  ChevronsRight,
  Copy,
  Diff,
  Loader,
  RotateCcw,
  Sparkles,
} from "lucide-react";

import { BentoCard, BentoHeader, CardBottomFade } from "./FeatureSection";
import { PlatformBadge } from "./PlatformBadge";

/* -------------------------------------------------------------------------- */
/* Types and demo content                                                     */
/* -------------------------------------------------------------------------- */

type Platform = "x" | "linkedin";

type Scenario =
  | {
      kind: "post";
      actions: number;
      prompt: string;
      response: string;
      platform: Platform;
      title: string;
      content: string;
    }
  | {
      kind: "rewrite";
      actions: number;
      prompt: string;
      response: string;
      platform: Platform;
      title: string;
      before: string;
      after: string;
    }
  | {
      kind: "insights";
      actions: number;
      prompt: string;
      response: string;
      metrics: { label: string; value: number }[];
    }
  | {
      kind: "ideas";
      actions: number;
      prompt: string;
      response: string;
      ideas: string[];
    };

const SCENARIOS: Scenario[] = [
  {
    kind: "post",
    actions: 2,
    prompt: "Write a LinkedIn post about staying consistent.",
    response: "Here's a draft you can build on.",
    platform: "linkedin",
    title: "LinkedIn draft",
    content:
      "Going viral gets attention.\n\nConsistency builds trust.\n\nThe best creators show up, share what they learn, and keep improving.",
  },
  {
    kind: "rewrite",
    actions: 2,
    prompt: "Make this tweet shorter and punchier.",
    response: "Done. Here's a sharper version.",
    platform: "x",
    title: "Suggested rewrite",
    before:
      "I think consistency is more important than going viral because viral posts don't always last.",
    after:
      "Virality gets attention.\nConsistency builds an audience.\n\nChoose what compounds.",
  },
  {
    kind: "insights",
    actions: 3,
    prompt: "Which of my topics perform best?",
    response: "Here's what your audience engages with most.",
    metrics: [
      { label: "Founder stories", value: 94 },
      { label: "Building in public", value: 76 },
      { label: "Product updates", value: 58 },
    ],
  },
  {
    kind: "ideas",
    actions: 2,
    prompt: "Give me content ideas for this week.",
    response: "Here are three ideas worth exploring:",
    ideas: [
      "A lesson from your latest project",
      "Something you changed your mind about",
      "A mistake that helped you improve",
    ],
  },
];

/* -------------------------------------------------------------------------- */
/* Timing (ms)                                                                */
/* -------------------------------------------------------------------------- */

const SLIDE_DURATION = 7000;
const THINKING_END = 900;
const RESPONSE_START = 1100;
const CONTENT_START = 2300;
const RESPONSE_SPEED = 13; // ms per character
const CONTENT_SPEED = 9; // ms per character
const ITEM_SPEED = 450; // ms per list item or bar

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function draftDiff(before: string, after: string) {
  const a = before.split("\n"),
    b = after.split("\n");
  let start = 0,
    end = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start++;
  while (
    end < a.length - start &&
    end < b.length - start &&
    a[a.length - 1 - end] === b[b.length - 1 - end]
  )
    end++;
  return {
    removed: a.slice(start, a.length - end),
    added: b.slice(start, b.length - end),
  };
}


const SMALL_BTN = "!min-h-6 !gap-1 !rounded-md !px-2 !text-[11px]";

/* -------------------------------------------------------------------------- */
/* Draft card (same look as the app's DraftArtifactCard, at demo size)        */
/* -------------------------------------------------------------------------- */

function DraftCard({
  title,
  platform,
  content,
  original,
  shown,
  typing,
  ready,
}: {
  title: string;
  platform: Platform;
  content: string;
  original?: string;
  shown: number;
  typing: boolean;
  ready: boolean;
}) {
  const [compare, setCompare] = useState(false);
  const [applied, setApplied] = useState(false);
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const diff =
    compare && ready && original ? draftDiff(original, content) : null;

  async function copy() {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable, ignore */
    }
  }

  return (
    <section
      aria-label={title}
      className="overflow-hidden rounded-xl bg-white shadow-[0_1px_2px_rgba(16,24,40,0.05),0_4px_12px_rgba(16,24,40,0.04),0_0_0_0.5px_rgba(16,24,40,0.12)]"
    >
      {/* Header */}
      <div className="flex h-7 items-center justify-between border-b-[0.5px] border-black/10 bg-[#f7f8f9] px-3">
        <span className="font-subheading truncate text-[11px] font-medium text-[#6b737d]">
          {title}
        </span>
        <PlatformBadge platform={platform} size="xs" />
      </div>

      {/* Body */}
      <div className="px-3 py-2.5">
        {diff ? (
          <div className="space-y-1 text-[11.5px] leading-[1.5] text-[#111418]">
            {diff.removed.length > 0 && (
              <del className="flex gap-2 whitespace-pre-wrap break-words rounded-md bg-rose-50 px-2 py-1 text-rose-900 no-underline">
                <span aria-hidden className="select-none text-rose-400">
                  −
                </span>
                <span>{diff.removed.join("\n")}</span>
              </del>
            )}
            {diff.added.length > 0 && (
              <ins className="flex gap-2 whitespace-pre-wrap break-words rounded-md bg-emerald-50 px-2 py-1 text-emerald-900 no-underline">
                <span aria-hidden className="select-none text-emerald-500">
                  +
                </span>
                <span>{diff.added.join("\n")}</span>
              </ins>
            )}
          </div>
        ) : (
          <div className="whitespace-pre-wrap break-words text-[11.5px] leading-[1.55] text-[#111418]">
            {content.slice(0, shown)}
            {typing && (
              <span className="ml-0.5 inline-block h-3 w-[1.5px] translate-y-[2px] animate-pulse bg-[#3fda8a]" />
            )}
          </div>
        )}
      </div>

      {/* Status */}
      {applied && (
        <p className="flex items-center gap-1.5 border-t-[0.5px] border-black/10 px-3 py-1.5 text-[11px] text-[#6b737d]">
          <Check className="size-3 stroke-[2] text-emerald-600" />
          Applied to your draft. Save when ready.
        </p>
      )}

      {/* Actions */}
      <div
        className={`flex items-center justify-between gap-2 border-t-[0.5px] border-black/10 bg-[#fbfbfc] px-2 py-1.5 transition-opacity duration-300 ${
          ready ? "opacity-100" : "pointer-events-none opacity-50"
        }`}
      >
        <button
          type="button"
          onClick={copy}
          aria-label="Copy suggestion"
          className={`secondary-btn ${SMALL_BTN}`}
        >
          {copied ? (
            <Check className="size-3 stroke-[2]" />
          ) : (
            <Copy className="size-3 stroke-[1.8]" />
          )}
          {copied ? "Copied" : "Copy"}
        </button>

        <div className="flex items-center gap-1.5">
          {original && (
            <button
              type="button"
              aria-pressed={compare}
              onClick={() => setCompare((value) => !value)}
              className={`secondary-btn ${SMALL_BTN} aria-pressed:!bg-[#f0f0ec]`}
            >
              <Diff className="size-3 stroke-[1.8]" />
              Compare
            </button>
          )}
          <button
            type="button"
            onClick={() => setApplied((value) => !value)}
            className={`${applied ? "secondary-btn" : "primary-btn"} ${SMALL_BTN}`}
          >
            {applied ? (
              <RotateCcw className="size-3 stroke-[1.8]" />
            ) : (
              <ChevronsRight className="size-3 stroke-[2]" />
            )}
            {applied ? "Undo" : "Apply"}
          </button>
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Insights card (bar rows)                                                   */
/* -------------------------------------------------------------------------- */

import { TrendingUp } from "lucide-react";

const WEEK = [
  { day: "Mon", value: 120 },
  { day: "Tue", value: 180 },
  { day: "Wed", value: 150 },
  { day: "Thu", value: 240 },
  { day: "Fri", value: 210 },
  { day: "Sat", value: 320 },
  { day: "Sun", value: 390 },
];

const W = 300;
const H = 100;
const PAD_TOP = 14;

function buildPaths(data: typeof WEEK) {
  const max = Math.max(...data.map((d) => d.value));
  const points = data.map((d, i) => ({
    x: (i / (data.length - 1)) * W,
    y: PAD_TOP + (1 - d.value / max) * (H - PAD_TOP - 4),
  }));

  // Smooth curve: horizontal tangents between points
  let line = `M${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const p0 = points[i - 1];
    const p1 = points[i];
    const mid = (p0.x + p1.x) / 2;
    line += ` C${mid} ${p0.y} ${mid} ${p1.y} ${p1.x} ${p1.y}`;
  }

  const area = `${line} L${W} ${H} L0 ${H} Z`;
  return { points, line, area };
}

function InsightsCard({ revealed }: { revealed: number }) {
  const { points, line, area } = buildPaths(WEEK);
  const total = WEEK.reduce((sum, d) => sum + d.value, 0);
  const last = points[points.length - 1];
  const best = WEEK[WEEK.length - 1];

  const drawn = revealed >= 1; // line starts drawing
  const showTip = revealed >= 4; // tooltip lands after the line finishes

  return (
    <section
      aria-label="Weekly engagement"
      className="overflow-hidden rounded-xl bg-white shadow-[0_1px_2px_rgba(16,24,40,0.05),0_4px_12px_rgba(16,24,40,0.04),0_0_0_0.5px_rgba(16,24,40,0.12)]"
    >
      {/* Header */}
      <div className="flex h-7 items-center justify-between border-b-[0.5px] border-black/10 bg-[#f7f8f9] px-3">
        <span className="font-subheading text-[11px] font-medium text-[#6b737d]">
          Engagement
        </span>
        <span className="text-[10.5px] text-[#9aa1aa]">This week</span>
      </div>

      <div className="px-3 pb-2.5 pt-3">
        {/* Headline number */}
        <div className="flex items-end gap-2">
          <span className="font-heading text-[22px] font-semibold leading-none tracking-tight tabular-nums text-[#111418]">
            {total.toLocaleString()}
          </span>
          <span className="mb-0.5 flex items-center gap-0.5 rounded bg-[#e4fbee] px-1.5 py-px text-[10.5px] font-semibold text-[#0f7a47]">
            <TrendingUp className="size-3" aria-hidden="true" />
            +38%
          </span>
        </div>
        <p className="mt-1 text-[10.5px] text-[#9aa1aa]">
          Impressions vs. last week
        </p>

        {/* Chart */}
        <div className="relative mt-2.5 h-[88px]">
          {/* grid */}
          {[0.25, 0.6, 0.95].map((t) => (
            <span
              key={t}
              aria-hidden="true"
              className="absolute inset-x-0 border-t border-dashed border-black/[0.07]"
              style={{ top: `${t * 100}%` }}
            />
          ))}

          {/* line + area, revealed left to right */}
          <div
            className="absolute inset-0 transition-[clip-path] duration-[1400ms] ease-out"
            style={{ clipPath: `inset(0 ${drawn ? 0 : 100}% 0 0)` }}
          >
            <svg
              viewBox={`0 0 ${W} ${H}`}
              preserveAspectRatio="none"
              className="h-full w-full"
              aria-hidden="true"
            >
              <defs>
                <linearGradient id="ins-area" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3fda8a" stopOpacity="0.28" />
                  <stop offset="100%" stopColor="#3fda8a" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path d={area} fill="url(#ins-area)" />
              <path
                d={line}
                fill="none"
                stroke="#1fae64"
                strokeWidth="2"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
          </div>

          {/* peak marker + tooltip */}
          <div
            className={`absolute transition-opacity duration-300 ${
              showTip ? "opacity-100" : "opacity-0"
            }`}
            style={{
              left: `${(last.x / W) * 100}%`,
              top: `${(last.y / H) * 100}%`,
            }}
          >
            <span className="absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-[#1fae64] shadow-[0_1px_4px_rgba(6,56,29,0.4)]" />
            <span className="absolute -translate-x-full -translate-y-[calc(100%+10px)] whitespace-nowrap rounded-md bg-[#11120e] px-2 py-1 text-[10.5px] font-medium tabular-nums text-white shadow-lg">
              {best.day}
              <span className="ml-2 text-white/70">{best.value}</span>
            </span>
          </div>
        </div>

        {/* Day labels */}
        <div className="mt-1.5 flex justify-between text-[9.5px] text-[#a0a6ad]">
          {WEEK.map((d) => (
            <span key={d.day}>{d.day}</span>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="border-t-[0.5px] border-black/10 bg-[#fbfbfc] px-3 py-1.5">
        <p className="text-[9.5px] text-[#a0a6ad]">Illustrative demo data</p>
      </div>
    </section>
  );
}
/* -------------------------------------------------------------------------- */
/* Main card                                                                  */
/* -------------------------------------------------------------------------- */

export function FeatureCardOne() {
  const reduceMotion = useReducedMotion();

  const [index, setIndex] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  const scenario = SCENARIOS[index];

  /* Independent timer: each conversation advances after SLIDE_DURATION.
     Nothing (hover, focus, phase) can block the loop. */
  useEffect(() => {
    if (reduceMotion) return;

    let advanced = false;
    const start = performance.now();

    const interval = window.setInterval(() => {
      const time = performance.now() - start;

      if (time >= SLIDE_DURATION) {
        if (!advanced) {
          advanced = true;
          setElapsed(0);
          setIndex((current) => (current + 1) % SCENARIOS.length);
        }
        return;
      }

      setElapsed(time);
    }, 40);

    return () => window.clearInterval(interval);
  }, [index, reduceMotion]);

  const showThinking = !reduceMotion && elapsed < THINKING_END;
  const showAssistant = reduceMotion || elapsed >= RESPONSE_START;
  const showContent = reduceMotion || elapsed >= CONTENT_START;

  const introChars = reduceMotion
    ? Infinity
    : Math.max(0, Math.floor((elapsed - RESPONSE_START) / RESPONSE_SPEED));

  const bodyChars = reduceMotion
    ? Infinity
    : Math.max(0, Math.floor((elapsed - CONTENT_START) / CONTENT_SPEED));

  const items = reduceMotion
    ? Infinity
    : Math.max(0, Math.floor((elapsed - CONTENT_START) / ITEM_SPEED) + 1);

  const textLength =
    scenario.kind === "post"
      ? scenario.content.length
      : scenario.kind === "rewrite"
        ? scenario.after.length
        : 0;

  const typing = bodyChars < textLength;
  const ready =
    reduceMotion ||
    (scenario.kind === "post" || scenario.kind === "rewrite"
      ? !typing
      : true);

  return (
    <BentoCard className="relative flex !h-[460px] sm:!h-[540px] min-h-0 min-w-0 flex-col overflow-hidden !bg-[#fffefe] ">
      {/* Compact heading */}
      {/* <div className="relative z-10 shrink-0 px-5 pt-5 sm:px-6 sm:pt-6">
        <div className="flex items-center gap-2">
          <span className="flex size-6 items-center justify-center rounded-lg bg-[#f1f8f3]">
            <Sparkles className="size-3.5 text-[#278b53]" />
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#79818a]">
            AI ASSISTANT
          </span>
        </div>

        <h3 className="font-heading mt-3 text-[20px] font-semibold leading-[1.2] tracking-[-0.035em] text-[#181b1e] sm:text-[22px]">
          Your AI writing partner.
        </h3>

        <p className="mt-1.5 max-w-[370px] font-subheading text-[12px] leading-[1.65] text-[#818892]">
          Turn ideas into posts, improve your writing, and find what works.
        </p>
      </div> */}


        <BentoHeader
        icon={Sparkles}
        badge="AI assistant"
        title="An assistant that writes your posts"
        description="Ask for a post, refine a draft, or ask how your content is doing. You review every change before it reaches your draft."
        linkText="Try the assistant ↗"
      />
      {/* Demo viewport */}
      <div className="relative mt-4 min-h-0 flex-1 overflow-hidden px-4 sm:px-6">
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-12 h-[170px] w-[75%] -translate-x-1/2 rounded-full bg-[#3fda8a]/[0.07] blur-[75px]"
        />

        <div className="relative z-10 mx-auto h-full w-full max-w-[620px]">
          <motion.div
            key={index}
            initial={reduceMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: reduceMotion ? 0 : 0.3,
              ease: [0.22, 1, 0.36, 1],
            }}
            className="h-full"
          >
            {/* User message */}
            <div className="flex items-end justify-end">
              <div className="max-w-[15.5rem] rounded-2xl bg-[#f0f0f0] px-3 py-1.5">
                <p className="text-[12px] md:text-[13px] leading-[1.45] text-[#111418]">
                  {scenario.prompt}
                </p>
              </div>
            </div>

            {/* Thinking */}
            {showThinking && (
              <div className="mt-3 flex items-center gap-1.5">
                <Loader
                  className="size-3.5 animate-spin text-[#1f9d5c]"
                  aria-hidden="true"
                />
                <span className="shimmer text-[12px] md:text-[13px] font-semibold">
                  Thinking
                </span>
              </div>
            )}

            {/* Assistant */}
            {showAssistant && (
              <div className="mt-3 space-y-1.5">
                <div className="flex items-center gap-1 text-[11px] font-medium text-[#7d858f]">
                  Completed {scenario.actions} actions
                  <ChevronDown className="size-3" aria-hidden="true" />
                </div>

                <p className="min-h-[18px] text-[12px] md:text-[13px] leading-[1.5] text-[#111418]">
                  {scenario.response.slice(0, introChars)}
                </p>
                <div className=" max-w-[300px] md:!max-w-[400px] mx-auto">

                {showContent && (
                  <div className="pt-1">
                    {scenario.kind === "post" && (
                      <DraftCard
                        title={scenario.title}
                        platform={scenario.platform}
                        content={scenario.content}
                        shown={bodyChars}
                        typing={typing}
                        ready={ready}
                      />
                    )}

                    {scenario.kind === "rewrite" && (
                      <DraftCard
                        title={scenario.title}
                        platform={scenario.platform}
                        content={scenario.after}
                        original={scenario.before}
                        shown={bodyChars}
                        typing={typing}
                        ready={ready}
                      />
                    )}

                    {scenario.kind === "insights" && (
                      <InsightsCard
                        revealed={items}
                      />
                    )}

                    {scenario.kind === "ideas" && (
                      <ul className="list-disc space-y-0.5 pl-5 text-[12px] leading-[1.5] text-[#111418] marker:text-[#111418]">
                        {scenario.ideas.map((idea, i) => (
                          <li
                            key={idea}
                            className={`transition-all duration-300 ${
                              i < items
                                ? "translate-y-0 opacity-100"
                                : "translate-y-1 opacity-0"
                            }`}
                          >
                            {idea}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
                </div>
              </div>
            )}
          </motion.div>
        </div>

        {/* Bottom fade */}
        {/* <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-[#fffefe] to-transparent"
        /> */}
        <CardBottomFade height="h-8" />
      </div>
    </BentoCard>
  );
}