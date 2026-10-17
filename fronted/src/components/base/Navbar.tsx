"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import {
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Bot,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  Code2,
  Layers3,
  Menu,
  PencilLine,
  Repeat2,
  Share2,
  UsersRound,
  Workflow,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@/components/ui/navigation-menu";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

/* -------------------------------------------------------------------------- */
/* Configuration                                                              */
/* -------------------------------------------------------------------------- */

const BRAND = "#3fda8a";

// Update these anchors to match the IDs used on your landing page.

const ROUTES = {
  home: "/",
  login: "/login",
  signup: "/login",
  platform: "/#platform",
  composer: "/product/ai-writer",
  ai: "/product/ai-writer",
  scheduling: "/product/schedule",
  repurposing: "/#feature-repurposing",
  analytics: "/product/analytics",

  channels: "/product/social-intigration",
  mcp: "/product/mcp",
  integrations: "/product/social-intigration",
  pricing: "/pricing",
  howItWorks: "/#how-it-works",
} as const;

type FeatureKind =
  | "composer"
  | "ai"
  | "scheduling"
  | "repurposing"
  | "analytics"
  | "collaboration"
  | "channels"
  | "mcp";

type AudienceKind = "creators" | "founders" | "agencies" | "teams";

type NavEntry<K extends string = string> = {
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
  kind: K;
};

/* -------------------------------------------------------------------------- */
/* Product Items                                                              */
/* -------------------------------------------------------------------------- */

const products: NavEntry<FeatureKind>[] = [
  {
    title: "Social Composer",
    description: "Create beautiful posts for every platform.",
    href: ROUTES.composer,
    icon: PencilLine,
    kind: "composer",
  },
  {
    title: "AI Writing Assistant",
    description: "Better ideas, sharper writing, your voice.",
    href: ROUTES.ai,
    icon: Bot,
    kind: "ai",
  },
  {
    title: "Scheduling & Queue",
    description: "Plan ahead and publish at the right time.",
    href: ROUTES.scheduling,
    icon: CalendarDays,
    kind: "scheduling",
  },
  {
    title: "Content Repurposing",
    description: "Turn one idea into posts for every channel.",
    href: ROUTES.repurposing,
    icon: Repeat2,
    kind: "repurposing",
  },
  {
    title: "Advanced Analytics",
    description: "Understand what works and grow faster.",
    href: ROUTES.analytics,
    icon: BarChart3,
    kind: "analytics",
  },
  
  {
    title: "Social Integrations",
    description: "Manage your channels in one workspace.",
    href: ROUTES.channels,
    icon: Share2,
    kind: "channels",
  },
  {
    title: "Draftva MCP",
    description: "Connect your AI tools to your publishing workflow.",
    href: ROUTES.mcp,
    icon: Code2,
    kind: "mcp",
  },
];

/* -------------------------------------------------------------------------- */
/* Solutions                                                                  */
/* -------------------------------------------------------------------------- */

const solutions: NavEntry<AudienceKind>[] = [
  {
    title: "For Creators",
    description: "Build an audience around your ideas.",
    href: ROUTES.howItWorks,
    icon: PencilLine,
    kind: "creators",
  },
  {
    title: "For Founders",
    description: "Build your brand while building your business.",
    href: ROUTES.howItWorks,
    icon: ArrowUpRight,
    kind: "founders",
  },
  {
    title: "For Agencies",
    description: "Manage content across clients and channels.",
    href: ROUTES.howItWorks,
    icon: Layers3,
    kind: "agencies",
  },
  {
    title: "For Marketing Teams",
    description: "Plan, collaborate, publish, and measure.",
    href: ROUTES.howItWorks,
    icon: UsersRound,
    kind: "teams",
  },
];

/* -------------------------------------------------------------------------- */
/* Brand                                                                      */
/* -------------------------------------------------------------------------- */

function BrandLogo({ compact = false }: { compact?: boolean }) {
  return (
    <Link
      href={ROUTES.home}
      aria-label="Draftva home"
      className="group inline-flex shrink-0 items-center gap-2.5"
    >
      <span
        className={cn(
          "relative flex shrink-0 items-center justify-center overflow-hidden",
          "rounded-[10px] bg-[#101311] text-white",
          "shadow-[inset_0_1px_1px_rgba(255,255,255,0.16),0_2px_5px_rgba(0,0,0,0.12)]",
          compact ? "size-8" : "size-[34px]"
        )}
      >
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-1 bottom-[-16px] h-8 rounded-full bg-[#3fda8a]/25 blur-xl"
        />

        <span className="relative text-[21px] font-black leading-none tracking-[-0.12em] pr-0.5">
          D
        </span>
      </span>

      <span
        className={cn(
          "font-heading font-bold tracking-[-0.065em] text-neutral-950",
          compact ? "text-[20px]" : "text-[23px]"
        )}
      >
        draftva<span className="text-[#3fda8a]">.</span>
      </span>
    </Link>
  );
}

/* -------------------------------------------------------------------------- */
/* Shared Social Badges                                                       */
/* -------------------------------------------------------------------------- */

const CHANNELS = [
  { name: "X", short: "𝕏" },
  { name: "LinkedIn", short: "in" },
  { name: "Threads", short: "@" },
  { name: "Reddit", short: "r/" },
];

function SocialBadge({
  name,
  short,
}: {
  name: string;
  short: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-black/[0.065] bg-white px-2 py-1.5 text-[10px] font-medium text-neutral-600">
      <span className="flex size-[17px] items-center justify-center rounded bg-neutral-900 text-[9px] font-bold text-white">
        {short}
      </span>

      {name}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Product Preview                                                            */
/* -------------------------------------------------------------------------- */

function FeaturePreview({
  kind,
  reduced,
}: {
  kind: FeatureKind;
  reduced: boolean;
}) {
  const active = products.find((item) => item.kind === kind) ?? products[0];
  const Icon = active.icon;

  const headings: Record<FeatureKind, string> = {
    composer: "One idea. Every platform.",
    ai: "Your words, only better.",
    scheduling: "Create now. Publish later.",
    repurposing: "One idea. More possibilities.",
    analytics: "Know what works.",
    collaboration: "Better together.",
    channels: "All your channels. One place.",
    mcp: "Your AI. Your publishing workflow.",
  };

  return (
    <div
      className={cn(
        "relative flex h-full min-h-[325px] flex-col overflow-hidden",
        "rounded-xl border border-[#d9efe1] bg-[#f5fbf7]"
      )}
    >
      {/* Background decoration */}

      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-20 -top-24 size-64 rounded-full bg-[#3fda8a]/10 blur-3xl"
      />

      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-20 -left-20 size-52 rounded-full bg-[#3fda8a]/10 blur-3xl"
      />

      <div className="relative z-10 flex items-center gap-2 border-b border-[#dceee2] px-4 py-3">
        <span className="flex size-7 items-center justify-center rounded-lg border border-[#b9e8ca] bg-white text-[#168b50]">
          <Icon size={14} />
        </span>

        <span className="text-[10px] font-semibold tracking-tight text-neutral-700">
          {active.title}
        </span>

        <span className="ml-auto flex items-center gap-1.5 text-[9px] font-medium text-[#168b50]">
          <span className="size-1.5 rounded-full bg-[#3fda8a]" />
          Draftva
        </span>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={kind}
          initial={{
            opacity: 0,
            y: reduced ? 0 : 10,
            scale: reduced ? 1 : 0.98,
          }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{
            opacity: 0,
            y: reduced ? 0 : -8,
          }}
          transition={{
            duration: reduced ? 0 : 0.22,
            ease: [0.22, 1, 0.36, 1],
          }}
          className="relative z-10 flex flex-1 flex-col px-4 pb-4 pt-5"
        >
          <h3 className="max-w-[230px] font-heading text-[19px] font-semibold leading-[1.25] tracking-[-0.045em] text-neutral-900">
            {headings[kind]}
          </h3>

          {/* Composer */}

          {kind === "composer" && (
            <div className="mt-5 rounded-xl border border-black/[0.06] bg-white p-3 shadow-[0_7px_20px_-12px_rgba(0,0,0,0.15)]">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-semibold text-neutral-500">
                  New post
                </span>

                <span className="flex items-center gap-1 text-[9px] text-[#168b50]">
                  <Check size={11} />
                  Saved
                </span>
              </div>

              <p className="mt-3 text-[11px] font-medium leading-[1.6] text-neutral-700">
                Great ideas deserve to be shared.
                <br />
                Start creating something today.
              </p>

              <div className="mt-4 flex flex-wrap gap-1.5">
                {CHANNELS.map((channel) => (
                  <SocialBadge key={channel.name} {...channel} />
                ))}
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-neutral-100 pt-3">
                <span className="text-[9px] text-neutral-400">
                  Customize for each platform
                </span>

                <ArrowRight size={13} className="text-neutral-500" />
              </div>
            </div>
          )}

          {/* AI Writing Assistant */}

          {kind === "ai" && (
            <div className="mt-5 space-y-2.5">
              <div className="rounded-lg border border-black/[0.06] bg-white/80 p-3">
                <span className="text-[9px] font-semibold text-neutral-400">
                  YOUR DRAFT
                </span>

                <p className="mt-2 text-[11px] leading-relaxed text-neutral-500">
                  We launched something new today.
                </p>
              </div>

              <div className="flex justify-center">
                <span className="flex size-7 items-center justify-center rounded-full border border-[#bde9cd] bg-white text-[#159654]">
                  <Bot size={14} />
                </span>
              </div>

              <div className="rounded-lg border border-[#b4e9c8] bg-white p-3 shadow-sm">
                <div className="flex items-center gap-1.5 text-[9px] font-semibold text-[#168b50]">
                  <Check size={11} />
                  Improved with Draftva
                </div>

                <p className="mt-2 text-[11px] font-medium leading-relaxed text-neutral-800">
                  Months of building. Countless iterations.
                  Today, we're finally sharing what we've created.
                </p>
              </div>
            </div>
          )}

          {/* Scheduling */}

          {kind === "scheduling" && (
            <div className="mt-5 rounded-xl border border-black/[0.06] bg-white p-3 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold text-neutral-800">
                  Your publishing week
                </span>

                <CalendarDays size={14} className="text-neutral-400" />
              </div>

              <div className="mt-4 grid grid-cols-7 gap-1">
                {["M", "T", "W", "T", "F", "S", "S"].map((day, i) => (
                  <div
                    key={i}
                    className="flex flex-col items-center gap-2"
                  >
                    <span className="text-[9px] text-neutral-400">
                      {day}
                    </span>

                    <motion.div
                      initial={{ scale: reduced ? 1 : 0.7, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{
                        delay: reduced ? 0 : i * 0.045,
                      }}
                      className={cn(
                        "flex size-7 items-center justify-center rounded-md text-[10px]",
                        [0, 2, 4].includes(i)
                          ? "bg-[#3fda8a] font-semibold text-[#0c3921]"
                          : "bg-neutral-100 text-neutral-400"
                      )}
                    >
                      {[0, 2, 4].includes(i) ? <Check size={12} /> : i + 12}
                    </motion.div>
                  </div>
                ))}
              </div>

              <div className="mt-4 flex items-center gap-2 rounded-lg border border-neutral-100 bg-neutral-50 px-2.5 py-2">
                <span className="size-2 rounded-full bg-[#3fda8a]" />

                <span className="text-[9px] font-medium text-neutral-600">
                  3 posts scheduled this week
                </span>
              </div>
            </div>
          )}

          {/* Repurposing */}

          {kind === "repurposing" && (
            <div className="mt-5 space-y-3">
              <div className="rounded-lg border border-[#b9e9cd] bg-white p-3">
                <span className="text-[9px] font-semibold text-[#168b50]">
                  ORIGINAL IDEA
                </span>

                <p className="mt-1.5 text-[11px] font-medium text-neutral-800">
                  5 lessons from building my first startup
                </p>
              </div>

              <div className="flex justify-center">
                <Repeat2 size={15} className="text-[#159654]" />
              </div>

              <div className="grid grid-cols-2 gap-2">
                {[
                  ["𝕏", "X thread"],
                  ["in", "LinkedIn post"],
                  ["@", "Threads post"],
                  ["r/", "Reddit post"],
                ].map(([icon, label], i) => (
                  <motion.div
                    key={label}
                    initial={{
                      opacity: 0,
                      y: reduced ? 0 : 8,
                    }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      delay: reduced ? 0 : i * 0.07,
                    }}
                    className="flex items-center gap-2 rounded-lg border border-black/[0.055] bg-white px-2.5 py-3"
                  >
                    <span className="flex size-6 items-center justify-center rounded-md bg-neutral-900 text-[10px] font-bold text-white">
                      {icon}
                    </span>

                    <span className="text-[9px] font-medium text-neutral-600">
                      {label}
                    </span>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* Analytics */}

          {kind === "analytics" && (
            <div className="mt-5 rounded-xl border border-black/[0.06] bg-white p-3 shadow-sm">
              <span className="text-[9px] font-medium text-neutral-500">
                Total engagement
              </span>

              <div className="mt-1 flex items-end gap-2">
                <strong className="font-heading text-[26px] tracking-tight text-neutral-900">
                  24.8K
                </strong>

                <span className="mb-1.5 rounded-md bg-[#e3f9eb] px-1.5 py-0.5 text-[9px] font-semibold text-[#168b50]">
                  +18.4%
                </span>
              </div>

              <div className="mt-5 flex h-[84px] items-end gap-2 border-b border-neutral-100 pb-1">
                {[35, 48, 41, 62, 52, 78, 92, 73, 86].map((height, i) => (
                  <div
                    key={i}
                    className="flex h-full flex-1 items-end"
                  >
                    <motion.div
                      initial={{ height: reduced ? `${height}%` : 0 }}
                      animate={{ height: `${height}%` }}
                      transition={{
                        duration: reduced ? 0 : 0.45,
                        delay: reduced ? 0 : i * 0.045,
                      }}
                      className={cn(
                        "w-full rounded-t-[3px]",
                        i === 6
                          ? "bg-[#27b96d]"
                          : "bg-[#b8efcb]"
                      )}
                    />
                  </div>
                ))}
              </div>

              <div className="mt-3 flex justify-between text-[9px] text-neutral-400">
                <span>Last 7 days</span>
                <span>Illustrative data</span>
              </div>
            </div>
          )}

          {/* Review & Approvals */}

          {kind === "collaboration" && (
            <div className="mt-5 space-y-2.5">
              <div className="rounded-lg border border-black/[0.06] bg-white p-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold text-neutral-800">
                    Launch announcement
                  </span>

                  <span className="rounded bg-amber-50 px-1.5 py-1 text-[8px] font-medium text-amber-600">
                    In review
                  </span>
                </div>

                <p className="mt-2 text-[10px] leading-relaxed text-neutral-500">
                  Ready for the team's final review.
                </p>
              </div>

              <div className="flex items-center gap-2 rounded-lg border border-[#b7e9c9] bg-white p-3">
                <span className="flex size-8 items-center justify-center rounded-full bg-[#ddf8e6] text-[#159654]">
                  <Check size={15} />
                </span>

                <div className="flex-1">
                  <p className="text-[10px] font-semibold text-neutral-800">
                    Approved
                  </p>

                  <p className="mt-0.5 text-[9px] text-neutral-500">
                    Your post is ready to publish.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Channels */}

          {kind === "channels" && (
            <div className="mt-5 rounded-xl border border-black/[0.06] bg-white p-2 shadow-sm">
              {CHANNELS.map((channel, i) => (
                <motion.div
                  key={channel.name}
                  initial={{
                    opacity: 0,
                    x: reduced ? 0 : 6,
                  }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{
                    delay: reduced ? 0 : i * 0.06,
                  }}
                  className={cn(
                    "flex items-center gap-2.5 rounded-lg px-2 py-2",
                    i !== CHANNELS.length - 1 && "border-b border-neutral-50"
                  )}
                >
                  <span className="flex size-7 items-center justify-center rounded-lg bg-neutral-900 text-[11px] font-bold text-white">
                    {channel.short}
                  </span>

                  <span className="flex-1 text-[10px] font-medium text-neutral-800">
                    {channel.name}
                  </span>

                  <span className="flex items-center gap-1 text-[9px] text-[#168b50]">
                    <span className="size-1.5 rounded-full bg-[#3fda8a]" />
                    Connected
                  </span>
                </motion.div>
              ))}
            </div>
          )}

          {/* MCP */}

          {kind === "mcp" && (
            <div className="mt-5 space-y-2">
              <div className="rounded-lg border border-black/[0.06] bg-white px-3 py-3">
                <div className="flex items-center gap-2">
                  <Bot size={15} className="text-neutral-700" />

                  <span className="text-[10px] font-semibold text-neutral-800">
                    Your AI assistant
                  </span>
                </div>
              </div>

              <div className="flex justify-center">
                <div className="h-4 w-px bg-[#9be4b7]" />
              </div>

              <div className="flex items-center gap-2 rounded-lg border border-[#ade6c2] bg-[#e4f9ec] px-3 py-3">
                <span className="flex size-7 items-center justify-center rounded-md bg-[#3fda8a] text-[#08381e]">
                  <Workflow size={14} />
                </span>

                <div>
                  <p className="text-[10px] font-semibold text-neutral-900">
                    Draftva MCP Server
                  </p>

                  <p className="text-[9px] text-neutral-500">
                    Your publishing workspace
                  </p>
                </div>
              </div>

              <div className="flex justify-center">
                <div className="h-4 w-px bg-[#9be4b7]" />
              </div>

              <div className="flex justify-center gap-2">
                {CHANNELS.map((channel) => (
                  <span
                    key={channel.name}
                    className="flex size-8 items-center justify-center rounded-lg border border-black/[0.07] bg-white text-[12px] font-bold text-neutral-800"
                    title={channel.name}
                  >
                    {channel.short}
                  </span>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      <div className="relative z-10 border-t border-[#dceee2] px-4 py-3">
        <p className="text-center text-[9px] font-medium tracking-wide text-[#669477]">
          Create · Schedule · Publish · Grow
        </p>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Solutions Preview                                                          */
/* -------------------------------------------------------------------------- */

const AUDIENCE_CONTENT: Record<
  AudienceKind,
  {
    eyebrow: string;
    headline: string;
    center: string;
    benefits: string[];
    footer: string;
  }
> = {
  creators: {
    eyebrow: "MADE FOR CREATORS",
    headline: "Your ideas deserve an audience.",
    center: "Your content",
    benefits: ["Create", "Publish", "Grow"],
    footer: "Build your personal brand, your way.",
  },
  founders: {
    eyebrow: "MADE FOR FOUNDERS",
    headline: "Build in public. Grow with purpose.",
    center: "Your story",
    benefits: ["Share progress", "Build trust", "Grow"],
    footer: "Turn your journey into your brand.",
  },
  agencies: {
    eyebrow: "MADE FOR AGENCIES",
    headline: "Every client. One workspace.",
    center: "Your agency",
    benefits: ["Client A", "Client B", "Client C"],
    footer: "More content. Less coordination.",
  },
  teams: {
    eyebrow: "MADE FOR TEAMS",
    headline: "Better content, together.",
    center: "Your team",
    benefits: ["Draft", "Review", "Publish"],
    footer: "Keep everyone moving together.",
  },
};

function SolutionsPreview({
  kind,
  reduced,
}: {
  kind: AudienceKind;
  reduced: boolean;
}) {
  const audience = AUDIENCE_CONTENT[kind];

  return (
    <div className="relative flex min-h-[312px] flex-col overflow-hidden rounded-xl border border-[#d9efe1] bg-[#f5fbf7] p-5">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-16 -top-16 size-48 rounded-full bg-[#3fda8a]/10 blur-3xl"
      />

      <AnimatePresence mode="wait">
        <motion.div
          key={kind}
          initial={{
            opacity: 0,
            y: reduced ? 0 : 8,
          }}
          animate={{ opacity: 1, y: 0 }}
          exit={{
            opacity: 0,
            y: reduced ? 0 : -6,
          }}
          transition={{ duration: reduced ? 0 : 0.22 }}
          className="relative z-10 flex flex-1 flex-col"
        >
          <span className="text-[9px] font-bold uppercase tracking-[0.1em] text-[#429267]">
            {audience.eyebrow}
          </span>

          <h3 className="mt-3 max-w-[240px] font-heading text-[20px] font-semibold leading-[1.25] tracking-[-0.045em] text-neutral-900">
            {audience.headline}
          </h3>

          <div className="mt-7 flex flex-col items-center">
            <div className="relative z-10 flex h-11 min-w-32 items-center justify-center gap-2 rounded-xl border border-[#b9e9cd] bg-white px-4 shadow-sm">
              <span className="flex size-6 items-center justify-center rounded-md bg-[#3fda8a] text-[#09341d]">
                <Workflow size={13} />
              </span>

              <span className="text-[10px] font-semibold text-neutral-800">
                {audience.center}
              </span>
            </div>

            <svg
              viewBox="0 0 240 46"
              fill="none"
              className="h-[46px] w-full text-[#b6e9c9]"
              aria-hidden="true"
            >
              <path
                d="M120 0V19M40 46V19H200V46M120 19V46"
                stroke="currentColor"
                strokeWidth="1.5"
              />

              {[40, 120, 200].map((x, i) => (
                <motion.circle
                  key={x}
                  cx={x}
                  cy={30}
                  r={2.5}
                  fill={BRAND}
                  animate={
                    reduced
                      ? {}
                      : {
                          cy: [20, 42],
                          opacity: [0, 1, 0],
                        }
                  }
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    delay: i * 0.3,
                  }}
                />
              ))}
            </svg>

            <div className="grid w-full grid-cols-3 gap-2">
              {audience.benefits.map((benefit, i) => (
                <motion.div
                  key={benefit}
                  animate={
                    reduced
                      ? {}
                      : {
                          y: [0, -3, 0],
                        }
                  }
                  transition={{
                    duration: 3,
                    repeat: Infinity,
                    delay: i * 0.4,
                  }}
                  className="flex min-h-[66px] flex-col items-center justify-center rounded-lg border border-[#d5eadd] bg-white px-1.5 py-2 text-center"
                >
                  <span className="mb-1.5 flex size-6 items-center justify-center rounded-full bg-[#e3f9eb] text-[9px] font-semibold text-[#168b50]">
                    {i + 1}
                  </span>

                  <span className="text-[9px] font-medium text-neutral-700">
                    {benefit}
                  </span>
                </motion.div>
              ))}
            </div>
          </div>

          <p className="mt-auto pt-5 text-center text-[10px] text-neutral-500">
            {audience.footer}
          </p>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Navigation Item                                                            */
/* -------------------------------------------------------------------------- */

function NavItemCard({
  item,
  onHover,
  onNavigate,
}: {
  item: NavEntry;
  onHover: () => void;
  onNavigate: () => void;
}) {
  const Icon = item.icon;

  return (
    <NavigationMenuLink >
      <Link
        href={item.href}
        onMouseEnter={onHover}
        onFocus={onHover}
        onClick={onNavigate}
        className={cn(
          "group flex items-start gap-3 rounded-xl p-2.5",
          "transition-colors duration-150",
          "hover:bg-[#f3faf5] focus-visible:bg-[#f3faf5]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3fda8a]"
        )}
      >
        <span
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-[10px]",
            "border border-black/[0.06] bg-white text-neutral-600",
            "shadow-[0_1px_2px_rgba(0,0,0,0.025)]",
            "transition-all duration-150",
            "group-hover:border-[#c0ebcf] group-hover:bg-[#e9f9ee]",
            "group-hover:text-[#168b50]"
          )}
        >
          <Icon size={16} strokeWidth={1.8} />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1">
            <span className="font-heading text-[12px] font-semibold tracking-tight text-neutral-900">
              {item.title}
            </span>

            <ArrowRight
              size={12}
              className="translate-x-[-3px] text-neutral-400 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100"
            />
          </div>

          <p className="mt-0.5 line-clamp-2 text-[11px] leading-[1.5] text-neutral-500">
            {item.description}
          </p>
        </div>
      </Link>
    </NavigationMenuLink>
  );
}

/* -------------------------------------------------------------------------- */
/* Mobile Navigation Group                                                    */
/* -------------------------------------------------------------------------- */

function MobileNavGroup({
  title,
  items,
  expanded,
  onToggle,
  onNavigate,
}: {
  title: string;
  items: NavEntry[];
  expanded: boolean;
  onToggle: () => void;
  onNavigate: () => void;
}) {
  return (
    <div className="border-b border-black/[0.06] py-2">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex w-full items-center justify-between rounded-lg px-2 py-3 text-left"
      >
        <span className="text-[13px] font-semibold text-neutral-900">
          {title}
        </span>

        <ChevronDown
          size={16}
          className={cn(
            "text-neutral-500 transition-transform duration-200",
            expanded && "rotate-180"
          )}
        />
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="space-y-0.5 pb-3">
              {items.map((item) => {
                const Icon = item.icon;

                return (
                  <Link
                    key={item.title}
                    href={item.href}
                    onClick={onNavigate}
                    className="flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-[#edf8f0]"
                  >
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-black/[0.06] bg-white text-neutral-600">
                      <Icon size={16} />
                    </span>

                    <div className="min-w-0 flex-1">
                      <p className="text-[12px] font-semibold text-neutral-900">
                        {item.title}
                      </p>

                      <p className="mt-0.5 text-[10px] leading-snug text-neutral-500">
                        {item.description}
                      </p>
                    </div>

                    <ChevronRight
                      size={14}
                      className="shrink-0 text-neutral-400"
                    />
                  </Link>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Navbar                                                                     */
/* -------------------------------------------------------------------------- */

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [desktopMenu, setDesktopMenu] = useState("");
  const [activeFeature, setActiveFeature] =
    useState<FeatureKind>("composer");
  const [activeAudience, setActiveAudience] =
    useState<AudienceKind>("creators");

  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileExpanded, setMobileExpanded] = useState<string | null>(
    "Product"
  );

  const reduced = Boolean(useReducedMotion());

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };

    handleScroll();

    window.addEventListener("scroll", handleScroll, {
      passive: true,
    });

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  const closeDesktop = () => setDesktopMenu("");
  const closeMobile = () => setMobileOpen(false);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-[100] w-full",
        "transition-all duration-300 ease-out",
        scrolled
          ? "border-b border-black/[0.06] bg-[#faf9f5]/90 shadow-[0_8px_30px_-15px_rgba(20,22,16,0.08)] backdrop-blur-xl"
          : "border-b border-transparent bg-[#faf9f5]/70 backdrop-blur-md"
      )}
    >
      <a
        href="#main-content"
        className="absolute -top-24 left-5 z-50 rounded-lg bg-white p-3 text-sm font-semibold text-neutral-900 shadow-md focus:top-3"
      >
        Skip to content
      </a>

      <nav className="mx-auto flex h-[64px] w-full max-w-[1240px] items-center justify-between px-5 sm:px-8">
        {/* Left: Brand + Desktop Navigation */}

        <div className="flex items-center gap-8">
          <BrandLogo />

          <div className="hidden lg:block">
            <NavigationMenu
              value={desktopMenu}
              onValueChange={(value) => {
                setDesktopMenu(value);

                if (value === "Product") {
                  setActiveFeature("composer");
                }

                if (value === "Solutions") {
                  setActiveAudience("creators");
                }
              }}
            >
              <NavigationMenuList className="gap-1">
                {/* Product Dropdown */}

                <NavigationMenuItem value="Product">
                  <NavigationMenuTrigger
                    className={cn(
                      "h-9 rounded-lg bg-transparent px-3",
                      "text-[13px] font-medium text-neutral-600",
                      "shadow-none transition-colors",
                      "hover:bg-black/[0.04] hover:text-neutral-900",
                      "data-[state=open]:bg-black/[0.04]",
                      "data-[state=open]:text-neutral-900"
                    )}
                  >
                    Product
                  </NavigationMenuTrigger>

                  <NavigationMenuContent>
                    <div className="w-[870px] overflow-hidden rounded-2xl border border-black/[0.075] bg-white shadow-[0_24px_60px_-15px_rgba(20,22,16,0.16)]">
                      <div className="grid grid-cols-[1fr_280px]">
                        <div className="p-4">
                          <div className="mb-3 px-2.5">
                            <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-neutral-400">
                              THE DRAFTVA PLATFORM
                            </span>

                            <p className="mt-1 text-[12px] text-neutral-600">
                              Everything you need to create, publish, and grow.
                            </p>
                          </div>

                          <div className="grid grid-cols-2 gap-1">
                            {products.map((item) => (
                              <NavItemCard
                                key={item.kind}
                                item={item}
                                onHover={() =>
                                  setActiveFeature(item.kind)
                                }
                                onNavigate={closeDesktop}
                              />
                            ))}
                          </div>

                          <div className="mt-4 border-t border-black/[0.06] pt-3">
                            <Link
                              href={ROUTES.platform}
                              onClick={closeDesktop}
                              className="group inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12px] font-semibold text-[#168b50] transition-colors hover:text-[#086b38]"
                            >
                              Explore the platform

                              <ArrowRight
                                size={14}
                                className="transition-transform group-hover:translate-x-1"
                              />
                            </Link>
                          </div>
                        </div>

                        <div className="border-l border-black/[0.05] bg-[#fbfcfa] p-3">
                          <FeaturePreview
                            kind={activeFeature}
                            reduced={reduced}
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-between border-t border-black/[0.06] bg-[#fafbf9] px-5 py-3">
                        <span className="flex items-center gap-2 text-[10px] text-neutral-500">
                          <span className="size-1.5 rounded-full bg-[#3fda8a]" />
                          Built for modern creators and teams
                        </span>

                        <span className="text-[10px] font-medium text-neutral-400">
                          One workspace. Every platform.
                        </span>
                      </div>
                    </div>
                  </NavigationMenuContent>
                </NavigationMenuItem>

                {/* Solutions Dropdown */}

                <NavigationMenuItem value="Solutions">
                  <NavigationMenuTrigger
                    className={cn(
                      "h-9 rounded-lg bg-transparent px-3",
                      "text-[13px] font-medium text-neutral-600",
                      "shadow-none transition-colors",
                      "hover:bg-black/[0.04] hover:text-neutral-900",
                      "data-[state=open]:bg-black/[0.04]",
                      "data-[state=open]:text-neutral-900"
                    )}
                  >
                    Solutions
                  </NavigationMenuTrigger>

                  <NavigationMenuContent>
                    <div className="w-[720px] overflow-hidden rounded-2xl border border-black/[0.075] bg-white p-4 shadow-[0_24px_60px_-15px_rgba(20,22,16,0.16)]">
                      <div className="grid grid-cols-[1fr_270px] gap-4">
                        <div>
                          <div className="mb-3 px-2.5">
                            <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-neutral-400">
                              MADE FOR YOUR AMBITION
                            </span>

                            <p className="mt-1 text-[12px] text-neutral-600">
                              Grow your presence, your way.
                            </p>
                          </div>

                          <div className="flex flex-col gap-1">
                            {solutions.map((item) => (
                              <NavItemCard
                                key={item.kind}
                                item={item}
                                onHover={() =>
                                  setActiveAudience(item.kind)
                                }
                                onNavigate={closeDesktop}
                              />
                            ))}
                          </div>
                        </div>

                        <SolutionsPreview
                          kind={activeAudience}
                          reduced={reduced}
                        />
                      </div>
                    </div>
                  </NavigationMenuContent>
                </NavigationMenuItem>

                {/* Direct Navigation */}

                <NavigationMenuItem>
                  <NavigationMenuLink >
                    <Link
                      href={ROUTES.integrations}
                      onClick={closeDesktop}
                      className="inline-flex h-9 items-center rounded-lg px-3 text-[13px] font-medium text-neutral-600 transition-colors hover:bg-black/[0.04] hover:text-neutral-900"
                    >
                      Integrations
                    </Link>
                  </NavigationMenuLink>
                </NavigationMenuItem>

                <NavigationMenuItem>
                  <NavigationMenuLink >
                    <Link
                      href={ROUTES.pricing}
                      onClick={closeDesktop}
                      className="inline-flex h-9 items-center rounded-lg px-3 text-[13px] font-medium text-neutral-600 transition-colors hover:bg-black/[0.04] hover:text-neutral-900"
                    >
                      Pricing
                    </Link>
                  </NavigationMenuLink>
                </NavigationMenuItem>

                <NavigationMenuItem>
                  <NavigationMenuLink >
                    <Link
                      href={ROUTES.howItWorks}
                      onClick={closeDesktop}
                      className="inline-flex h-9 items-center rounded-lg px-3 text-[13px] font-medium text-neutral-600 transition-colors hover:bg-black/[0.04] hover:text-neutral-900"
                    >
                      How it works
                    </Link>
                  </NavigationMenuLink>
                </NavigationMenuItem>
              </NavigationMenuList>
            </NavigationMenu>
          </div>
        </div>

        {/* Right: Desktop Actions */}

        <div className="hidden items-center gap-2.5 lg:flex">
          <Link
            href={ROUTES.login}
            className={cn(
              "secondary-btn rounded-lg"
            )}
          >
            Sign in
          </Link>

          <Link
            href={ROUTES.signup}
            className={cn(
              "primary-btn rounded-lg"
            )}
          >
            Start for free

            <ArrowRight
              size={14}
              className="transition-transform group-hover:translate-x-0.5"
            />
          </Link>
        </div>

        {/* Mobile Navigation */}

        <div className="lg:hidden">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger >
              <button
                type="button"
                aria-label="Open navigation menu"
                className="flex size-9 items-center justify-center rounded-[10px] border border-black/[0.08] bg-white/90 text-neutral-800 shadow-sm transition-colors hover:bg-white"
              >
                <Menu size={19} />
              </button>
            </SheetTrigger>

            <SheetContent
              side="right"
              className="flex h-dvh w-full max-w-[380px] flex-col border-l border-black/[0.08] bg-[#faf9f5] p-0 sm:max-w-[380px]"
            >
              <SheetHeader className="border-b border-black/[0.06] bg-white/80 px-5 py-4">
                <SheetTitle className="sr-only">
                  Draftva navigation
                </SheetTitle>

                <div className="pr-8">
                  <BrandLogo compact />
                </div>
              </SheetHeader>

              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
                <MobileNavGroup
                  title="Product"
                  items={products}
                  expanded={mobileExpanded === "Product"}
                  onToggle={() =>
                    setMobileExpanded(
                      mobileExpanded === "Product" ? null : "Product"
                    )
                  }
                  onNavigate={closeMobile}
                />

                <MobileNavGroup
                  title="Solutions"
                  items={solutions}
                  expanded={mobileExpanded === "Solutions"}
                  onToggle={() =>
                    setMobileExpanded(
                      mobileExpanded === "Solutions" ? null : "Solutions"
                    )
                  }
                  onNavigate={closeMobile}
                />

                <div className="mt-4 space-y-1">
                  {[
                    {
                      title: "Integrations",
                      href: ROUTES.integrations,
                    },
                    {
                      title: "Pricing",
                      href: ROUTES.pricing,
                    },
                    {
                      title: "How it works",
                      href: ROUTES.howItWorks,
                    },
                  ].map((link) => (
                    <Link
                      key={link.title}
                      href={link.href}
                      onClick={closeMobile}
                      className="flex h-11 items-center justify-between rounded-xl px-2.5 text-[13px] font-semibold text-neutral-800 transition-colors hover:bg-black/[0.035]"
                    >
                      {link.title}

                      <ChevronRight
                        size={15}
                        className="text-neutral-400"
                      />
                    </Link>
                  ))}
                </div>
              </div>

              <div className="border-t border-black/[0.06] bg-white/90 p-4">
                <div className="grid grid-cols-2 gap-2.5">
                  <Link
                    href={ROUTES.login}
                    onClick={closeMobile}
                    className="secondary-btn rounded-lg text-center"
                  >
                    Sign in
                  </Link>

                  <Link
                    href={ROUTES.signup}
                    onClick={closeMobile}
                    className="primary-btn rounded-lg"
                  >
                    Start for free
                    {/* <ArrowRight size={13} /> */}
                  </Link>
                </div>

                <p className="mt-3 text-center text-[10px] text-neutral-400">
                  Create better. Publish smarter. Grow together.
                </p>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </nav>
    </header>
  );
}