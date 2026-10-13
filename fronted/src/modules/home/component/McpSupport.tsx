"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { ArrowRight, Check, Sparkles } from "lucide-react";

const BRAND = "#48F7A2";
const BRAND_DEEP = "#12a05c";
const BRAND_INK = "#06281a";
const BRAND_TEXT = "#39d082";

type ClientId = "claude" | "chatgpt" | "cursor" | "gemini";

interface Demo {
  id: ClientId;
  client: string;
  prompt: string;
  reply: string;
  tools: string[];
  resultTitle: string;
  resultQuote: string;
  resultMeta: string;
}

const DEMOS: Demo[] = [
  {
    id: "claude",
    client: "Claude",
    prompt: "Turn this week's shipped PRs into 3 LinkedIn posts in my voice.",
    reply:
      "On it. Reading your merged PRs, drafting the posts in your voice, and queuing them through your Draftva MCP.",
    tools: [
      "scan_pull_requests()",
      "create_post_draft()",
      "queue_post_draft()",
    ],
    resultTitle: "3 posts queued",
    resultQuote:
      "“We cut cold-start time by 41% this week. The fix was boring, and that’s the point.”",
    resultMeta: "Queued for 9:15 am. Nothing posts until you confirm.",
  },
  {
    id: "chatgpt",
    client: "ChatGPT",
    prompt: "Which topic drove the most engagement on LinkedIn this month?",
    reply:
      "Checking your last 30 days of analytics and summarizing what worked, using your Draftva MCP.",
    tools: ["query_analytics()", "rank_topics()", "summarize_insights()"],
    resultTitle: "Insight ready",
    resultQuote:
      "“Technical postmortems averaged 8.4% engagement, 3.2% above your average.”",
    resultMeta: "Based on 24 posts. Read-only, nothing was changed.",
  },
  {
    id: "cursor",
    client: "Cursor",
    prompt: "Scan the staged diff for PR #142 and schedule a release post.",
    reply:
      "Reading your staged Git diff, writing the announcement, and scheduling it with your Draftva MCP.",
    tools: ["repurpose_git_diff()", "create_post_draft()", "schedule_post()"],
    resultTitle: "2 drafts staged",
    resultQuote:
      "“Shipped: faster builds, cleaner logs, and one less thing to babysit.”",
    resultMeta: "Peak slot 9:15 am. Nothing posts until you confirm.",
  },
  {
    id: "gemini",
    client: "Gemini",
    prompt:
      "Draft a thread from my last 3 podcast notes and queue it for Friday.",
    reply:
      "Pulling your notes, shaping them into a thread in your voice, and queuing it with your Draftva MCP.",
    tools: ["read_notes()", "create_thread_draft()", "queue_post_draft()"],
    resultTitle: "1 thread queued",
    resultQuote:
      "“Three lessons from this month’s interviews. The third one changed how I hire.”",
    resultMeta: "Queued for Friday 8:30 am. Nothing posts until you confirm.",
  },
];

const BULLETS = [
  "Turn commits, PRs and notes into posts, straight from your IDE or chat",
  "Draft posts and replies that sound like you, then queue them",
  "Pull analytics and attach images or videos without leaving the conversation",
];

const INTEGRATIONS = ["Claude", "ChatGPT", "Cursor", "Gemini", "Any MCP client"];

export function McpSupport() {
  const [active, setActive] = useState<ClientId>("claude");
  const reduced = useReducedMotion();
  const scrollRef = useRef<HTMLDivElement>(null);
  const demo = DEMOS.find((d) => d.id === active) ?? DEMOS[0];

  // On phones the chat has a fixed height, so the conversation scrolls.
  // Reset to the top on tab change, then glide down to the result card once
  // the tool chips have finished animating. No-op when nothing overflows
  // (desktop).
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: 0 });
    const timer = setTimeout(() => {
      if (el.scrollHeight <= el.clientHeight + 4) return;
      el.scrollTo({
        top: el.scrollHeight,
        behavior: reduced ? "auto" : "smooth",
      });
    }, 1300);
    return () => clearTimeout(timer);
  }, [active, reduced]);

  return (
    <section className="w-full  py-10 sm:px-6 sm:py-16">
      <div
        className="relative mx-auto max-w-6xl overflow-hidden rounded-[2rem] border bg-gradient-to-b from-[#f4fdf8] to-white shadow-[0_30px_80px_-40px_rgba(18,160,92,0.35)]"
        style={{ borderColor: `${BRAND}4D` }}
      >
        {/* Ambient glows */}
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 size-[420px] rounded-full opacity-60 blur-[90px]"
          style={{
            background: `radial-gradient(circle, ${BRAND}, transparent 70%)`,
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-28 -left-20 size-[360px] rounded-full opacity-40 blur-[90px]"
          style={{
            background: `radial-gradient(circle, ${BRAND}, transparent 70%)`,
          }}
        />

        <div className="relative grid items-center gap-10 px-4 py-10 sm:px-10 sm:py-14 lg:grid-cols-[1.05fr_0.95fr] lg:gap-12 lg:px-14 lg:py-16">
          {/* LEFT: copy */}
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white py-1 pl-1 pr-3 text-[13px] font-medium text-zinc-800 shadow-2xs">
              <span
                className="rounded-full px-2.5 py-0.5 text-[11px] font-bold tracking-wide"
                style={{ background: BRAND, color: BRAND_INK }}
              >
                NEW
              </span>
              Draftva MCP is live
            </div>

            <h2 className="mt-5 font-heading text-[1.6rem] font-bold leading-[1.08] tracking-tight text-foreground sm:text-4xl">
              Your AI can now{" "}
              <span style={{ color: BRAND_TEXT }}>
                create, schedule & publish
              </span>{" "}
              across every platform.
            </h2>

            <p className="mt-5 max-w-xl text-base leading-relaxed text-zinc-600 sm:text-lg">
              Draftva runs as an MCP server. Claude, ChatGPT or Cursor can now
              find what&apos;s worth posting, draft in your voice, and queue
              everything on your Draftva account. Nothing posts until you
              confirm.
            </p>

            <ul className="mt-6 space-y-3">
              {BULLETS.map((text) => (
                <li key={text} className="flex items-start gap-3">
                  <span
                    className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full"
                    style={{ background: `${BRAND}33` }}
                  >
                    <Check
                      className="size-3.5 stroke-[3]"
                      style={{ color: BRAND_DEEP }}
                    />
                  </span>
                  <span className="text-[15px] font-medium leading-snug text-zinc-800">
                    {text}
                  </span>
                </li>
              ))}
            </ul>

            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
              <Link href="/register" className="primary-btn group rounded-lg">
                Try Draftva MCP
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link
                href="/register"
                className="group inline-flex items-center gap-1.5 text-[15px] font-semibold"
                style={{ color: BRAND_DEEP }}
              >
                View MCP documentation
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-2">
              <span className="text-[13px] text-zinc-500">Works with</span>
              {INTEGRATIONS.map((name) => (
                <span
                  key={name}
                  className="rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-[12px] font-medium text-zinc-700"
                >
                  {name}
                </span>
              ))}
            </div>
          </div>

          {/* RIGHT: chat mockup (fixed h-84 on phones, natural height from md up) */}
          <div className="relative mx-auto w-full max-w-[460px]">
            <div className="relative flex h-84 scrollbar-none flex-col overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-md md:h-auto">
              {/* Window bar */}
              <div className="flex shrink-0 items-center justify-between border-b border-zinc-100 px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="flex gap-1.5">
                    <span className="size-2.5 rounded-full bg-zinc-200" />
                    <span className="size-2.5 rounded-full bg-zinc-200" />
                    <span className="size-2.5 rounded-full bg-zinc-200" />
                  </div>
                  <span className="text-sm font-semibold text-zinc-900">
                    {demo.client}
                  </span>
                </div>
                <span
                  className="rounded-full px-2.5 py-1 text-[11px] font-bold"
                  style={{ background: `${BRAND}26`, color: BRAND_DEEP }}
                >
                  Draftva MCP
                </span>
              </div>

              {/* Client tabs */}
              <div
                role="tablist"
                aria-label="AI client"
                className="flex shrink-0 gap-1 overflow-x-auto border-b border-zinc-100 bg-zinc-50/60 px-3 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              >
                {DEMOS.map((d) => {
                  const on = d.id === active;
                  return (
                    <button
                      style={{ minHeight: "16px" }}
                      key={d.id}
                      type="button"
                      role="tab"
                      aria-selected={on}
                      onClick={() => setActive(d.id)}
                      className={`shrink-0 whitespace-nowrap rounded-lg px-3 py-1 text-xs font-semibold transition-colors ${
                        on
                          ? "bg-blue-300 secondary-btn text-white"
                          : "text-zinc-500 hover:bg-white hover:text-zinc-900"
                      }`}
                    >
                      {d.client}
                    </button>
                  );
                })}
              </div>

              {/* Conversation: scrolls inside the fixed-height card on phones */}
              <div
                ref={scrollRef}
                className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 sm:px-5 md:min-h-[430px] md:overflow-visible"
              >
                <AnimatePresence mode="wait">
                  <motion.div
                    key={demo.id}
                    initial={reduced ? false : { opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={reduced ? undefined : { opacity: 0, y: -6 }}
                    transition={{ duration: 0.25 }}
                  >
                    {/* User bubble */}
                    <div className="flex justify-end">
                      <div
                        className="max-w-[85%] rounded-2xl rounded-br-md px-4 py-2.5 text-[14px] font-medium leading-snug shadow-sm"
                        style={{ background: BRAND, color: BRAND_INK }}
                      >
                        {demo.prompt}
                      </div>
                    </div>

                    {/* Assistant reply */}
                    <div className="mt-4 flex items-start gap-3">
                      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl border border-border bg-white shadow-sm">
                        <Sparkles stroke="#FFBF00" className="size-4" />
                      </span>
                      <p className="text-[14px] leading-snug text-zinc-800">
                        {demo.reply}
                      </p>
                    </div>

                    {/* Tool chips */}
                    <div className="mt-3 flex flex-col items-start gap-2 pl-11">
                      {demo.tools.map((tool, i) => (
                        <motion.span
                          key={tool}
                          initial={reduced ? false : { opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: reduced ? 0 : 0.25 + i * 0.18 }}
                          className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 font-mono text-[12px]"
                          style={{
                            borderColor: `${BRAND}66`,
                            background: `${BRAND}14`,
                            color: "#0b6b3b",
                          }}
                        >
                          <Check className="size-3 stroke-[3]" />
                          {tool}
                        </motion.span>
                      ))}
                    </div>

                    {/* Result card */}
                    <motion.div
                      initial={reduced ? false : { opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{
                        delay: reduced ? 0 : 0.25 + demo.tools.length * 0.18,
                      }}
                      className="ml-11 mt-4 rounded-2xl border border-zinc-200 bg-zinc-50/70 p-4"
                    >
                      <div
                        className="flex items-center gap-1.5 text-[13px] font-bold"
                        style={{ color: BRAND_DEEP }}
                      >
                        <Check className="size-3.5 stroke-[3]" />
                        {demo.resultTitle}
                      </div>
                      <p className="mt-2 text-[14px] italic leading-snug text-zinc-800">
                        {demo.resultQuote}
                      </p>
                      <p className="mt-2 text-[12px] text-zinc-500">
                        {demo.resultMeta}
                      </p>
                    </motion.div>
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Phone-only fade hinting that the chat scrolls */}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-white to-transparent md:hidden"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default McpSupport;