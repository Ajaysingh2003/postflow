"use client";

import React, { useId, useMemo, useState } from "react";
import { Check, ChevronDown, Minus, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { PAID_ALLOWANCES } from "../planAllowances";

/* -------------------------------------------------------------------------- */
/*  Data                                                                       */
/* -------------------------------------------------------------------------- */

type TierId = "starter" | "pro" | "business";
type Value = string | boolean;

interface FeatureRow {
  name: string;
  hint?: string;
  starter: Value;
  pro: Value;
  business: Value;
}

interface FeatureCategory {
  category: string;
  features: FeatureRow[];
}

const row = (
  name: string,
  starter: Value,
  pro: Value,
  business: Value,
  hint?: string,
): FeatureRow => ({ name, hint, starter, pro, business });

const TIERS: readonly {
  id: TierId;
  name: string;
  tagline: string;
  popular?: boolean;
}[] = [
  { id: "starter", name: "Starter", tagline: "Founders & creators" },
  { id: "pro", name: "Pro", tagline: "High-velocity teams", popular: true },
  { id: "business", name: "Business", tagline: "Agencies & brands" },
];

const COMPARISON_DATA: FeatureCategory[] = [
  {
    category: "Publishing & channels",
    features: [
      row(
        "Supported networks",
        "All 6 channels",
        "All 6 channels",
        "All 6 channels",
        "X (Twitter), LinkedIn, Threads, Instagram, Facebook, and Reddit.",
      ),
      row(
        "Scheduled posts / month",
        "Unlimited",
        "Unlimited",
        "Unlimited",
        "All paid plans include unlimited scheduled and published posts.",
      ),
      row(
        "Connected social accounts",
        "5 accounts",
        "15 accounts",
        "50 accounts",
      ),
      row("Visual multi-channel calendar", true, true, true),
      row(
        "Cross-platform stagger scheduling",
        true,
        true,
        true,
        "Post to X immediately while scheduling for peak hours on LinkedIn.",
      ),
      row(
        "Evergreen queue auto-recycling",
        false,
        true,
        true,
        "Automatically recycle your top-performing posts into queue gaps.",
      ),
      row("Draft scheduling via MCP (Claude/Cursor)", true, true, true),
    ],
  },
  {
    category: "AI writer & copilot",
    features: [
      row(
        "Monthly AI credits",
        ...((["starter", "pro", "business"] as const).map(
          (code) =>
            `${PAID_ALLOWANCES[code].ai_credits.toLocaleString("en-US")} credits`,
        ) as [string, string, string]),
        "One credit per successful AI request. Credits reset monthly, including on yearly plans. Unused credits don’t roll over.",
      ),
      row("AI hook & opener generator", true, true, true),
      row("Tone & rephrase engine", true, true, true),
      row(
        "Custom brand voice profiles",
        ...((["starter", "pro", "business"] as const).map(
          (code) => `${PAID_ALLOWANCES[code].brand_profiles} voice profiles`,
        ) as [string, string, string]),
        "Train the AI on your past winners to replicate your natural cadence.",
      ),
      row("Multi-tweet & carousel splitter", true, true, true),
    ],
  },
  {
    category: "Analytics & telemetry",
    features: [
      row("Live official API telemetry", true, true, true),
      row("Historical data retention", "30 days", "1 year", "Unlimited"),
      row(
        "Breakout post velocity detector",
        false,
        true,
        true,
        "Real-time alerts when early engagement spikes 3x above your baseline.",
      ),
      row(
        "Golden hours audience heatmap",
        "Basic",
        "Advanced",
        "Advanced + custom",
      ),
      row("Exportable PDF & CSV reports", false, true, true),
    ],
  },
  {
    category: "Team & workspaces",
    features: [
      row(
        "Independent workspaces",
        "3 workspaces",
        "5 workspaces",
        "10 workspaces",
        "Keep client accounts or separate company entities completely isolated.",
      ),
      row("Team member seats", "3 seats", "5 seats", "15 seats"),
      row("Role-based permissions", false, true, true),
      row("Draft approval workflows", false, true, true),
    ],
  },
  {
    category: "Support & security",
    features: [
      row("100% official OAuth 2.0 access", true, true, true),
      row("SOC-2 ready & AES-256 encryption", true, true, true),
      row(
        "Customer support tier",
        "Standard email",
        "Priority email & chat",
        "Dedicated Slack + CSM",
      ),
    ],
  },
];

const TOTAL_FEATURES = COMPARISON_DATA.reduce(
  (n, g) => n + g.features.length,
  0,
);
const differs = (f: FeatureRow) =>
  !(f.starter === f.pro && f.pro === f.business);

/* -------------------------------------------------------------------------- */
/*  Layout constants                                                           */
/* -------------------------------------------------------------------------- */

// Feature column + 3 plan columns. Rows stay gap-free so the Pro tint is one
// continuous band from header to footer.
const MD_COLS = "md:grid-cols-[minmax(0,2.2fr)_repeat(3,minmax(0,1fr))]";
const ROW_COLS = `grid-cols-[minmax(0,1fr)_auto] ${MD_COLS}`;
const PRO_BAND = "bg-[#3fda8a]/[0.07] md:border-x md:border-[#3fda8a]/25";
// Distance from the viewport top where the sticky headers should stop.
// Match this to your site navbar height.
const STICKY_DESKTOP = "md:top-20";
const STICKY_MOBILE = "top-16";

/* -------------------------------------------------------------------------- */
/*  Small pieces                                                               */
/* -------------------------------------------------------------------------- */

function ValueCell({ value }: { value: Value }) {
  if (typeof value === "boolean") {
    return value ? (
      <span className="inline-flex size-6 items-center justify-center rounded-full bg-[#3fda8a]/25 text-[#0f7a47]">
        <Check className="size-3.5 stroke-[2.5]" aria-hidden="true" />
        <span className="sr-only">Included</span>
      </span>
    ) : (
      <span className="inline-flex size-6 items-center justify-center text-neutral-300">
        <Minus className="size-4" aria-hidden="true" />
        <span className="sr-only">Not included</span>
      </span>
    );
  }
  return (
    <span
      className={cn(
        "font-heading text-center text-xs font-semibold sm:text-[13px]",
        /unlimited|advanced/i.test(value) ? "text-[#0f7a47]" : "text-[#11120e]",
      )}
    >
      {value}
    </span>
  );
}

function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="group inline-flex items-center gap-2.5 rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0f7a47]"
    >
      <span
        className={cn(
          "relative h-5 w-9 rounded-full transition-colors",
          checked ? "bg-[#3fda8a]" : "bg-black/15",
        )}
      >
        <span
          className={cn(
            "absolute left-0.5 top-0.5 size-4 rounded-full bg-white shadow-sm transition-transform motion-reduce:transition-none",
            checked && "translate-x-4",
          )}
        />
      </span>
      <span className="font-subheading text-xs font-medium text-[#11120e]">
        {label}
      </span>
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/*  Main                                                                       */
/* -------------------------------------------------------------------------- */

export default function PricingComparisonTable() {
  const uid = useId();

  const [mobileTier, setMobileTier] = useState<TierId>("pro");
  const [diffOnly, setDiffOnly] = useState(false);
  const [open, setOpen] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(COMPARISON_DATA.map((g, i) => [g.category, i < 2])),
  );

  const categories = useMemo(
    () =>
      COMPARISON_DATA.map((g) => ({
        ...g,
        features: diffOnly ? g.features.filter(differs) : g.features,
      })).filter((g) => g.features.length > 0),
    [diffOnly],
  );

  const shownCount = categories.reduce((n, g) => n + g.features.length, 0);
  const allOpen = categories.every((g) => open[g.category]);
  const activeTier = TIERS.find((t) => t.id === mobileTier)!;

  const toggleAll = () =>
    setOpen((prev) => {
      const next = { ...prev };
      categories.forEach((g) => (next[g.category] = !allOpen));
      return next;
    });

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 sm:py-20">
      {/* Header */}
      <div className="mx-auto max-w-2xl text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-[#3fda8a]/40 bg-[#3fda8a]/10 px-3 py-1">
          <span className="size-2 rounded-full bg-[#3fda8a]" />
          <span className="font-subheading text-xs font-medium tracking-wide text-[#11120e]">
            Detailed breakdown
          </span>
        </div>

        <h3 className="font-heading mt-4 text-balance text-3xl font-bold tracking-tight text-[#11120e] sm:text-5xl">
          Compare plans side by side
        </h3>

        <p className="mt-3 font-subheading text-sm text-[#6d7066] sm:text-base">
          Everything included in each tier, in one place. No hidden fees or
          surprise add-ons.
        </p>
      </div>

      {/* Toolbar */}
      <div className="mt-10 flex flex-wrap items-center justify-between gap-x-6 gap-y-3 px-1">
        <p
          aria-live="polite"
          className="font-subheading text-xs text-[#85887e]"
        >
          Showing {shownCount} of {TOTAL_FEATURES} features
        </p>
        <div className="flex items-center gap-5">
          <Switch
            checked={diffOnly}
            onChange={setDiffOnly}
            label="Differences only"
          />
          <button
            type="button"
            onClick={toggleAll}
            className="font-subheading rounded-md text-xs font-medium text-[#0f7a47] underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0f7a47]"
          >
            {allOpen ? "Collapse all" : "Expand all"}
          </button>
        </div>
      </div>

      {/* Table card (no overflow-hidden here: it would break the sticky header) */}
      <div className="mt-3 rounded-3xl border border-black/[0.08] bg-white shadow-[0_24px_60px_-24px_rgba(17,18,14,0.1)]">
        {/* Desktop sticky plan header */}
        <div
          className={cn(
            "sticky z-20 hidden rounded-t-3xl border-b border-black/[0.08] bg-white/90 backdrop-blur-md md:grid",
            STICKY_DESKTOP,
            MD_COLS,
          )}
        >
          <div className="flex items-end px-6 py-4">
            <span className="font-subheading text-xs font-medium text-[#85887e]">
              Features
            </span>
          </div>
          {TIERS.map((tier) => (
            <div key={tier.id} className="px-2 py-2.5">
              {tier.popular ? (
                <div className="primary-btn !flex h-auto w-full flex-col items-center justify-center rounded-2xl px-4 py-4 text-center">
                  <span className="font-subheading inline-flex mt-py-1 items-center gap-1 rounded-full bordezr bordzer-white/20 zbg-white/15 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white zshadow-2xs backdrop-blur-zxs">
                    <Sparkles className="size-2.5" aria-hidden="true" />
                    Most popular
                  </span>
                  <span className="font-heading mt-2 block text-base font-bold text-white">
                    {tier.name}
                  </span>
                  <span className="font-subheading mt-0.5 block text-[11px] text-white/80">
                    {tier.tagline}
                  </span>
                </div>
              ) : (
                <div className="px-3 py-3 text-center">
                  <span className="font-heading block text-base font-semibold text-[#11120e]">
                    {tier.name}
                  </span>
                  <span className="font-subheading block text-[11px] text-[#85887e]">
                    {tier.tagline}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Mobile sticky plan switcher */}
        <div
          className={cn(
            "sticky z-20 rounded-t-3xl border-b border-black/[0.08] bg-white/90 px-4 py-3 backdrop-blur-md md:hidden",
            STICKY_MOBILE,
          )}
        >
          <div
            role="tablist"
            aria-label="Choose a plan"
            className="grid grid-cols-3 gap-1 rounded-xl bg-[#f2f1ed] p-1"
          >
            {TIERS.map((tier) => {
              const active = mobileTier === tier.id;
              return (
                <button
                  key={tier.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setMobileTier(tier.id)}
                  className={cn(
                    "font-subheading inline-flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-all focus-visible:outline-2 focus-visible:outline-[#0f7a47]",
                    active
                      ? "bg-white text-[#11120e] shadow-xs"
                      : "text-[#6d7066] hover:text-[#11120e]",
                  )}
                >
                  {tier.name}
                  {tier.popular && (
                    <span
                      aria-label="Most popular"
                      className="size-1.5 rounded-full bg-[#3fda8a]"
                    />
                  )}
                </button>
              );
            })}
          </div>
          <p className="font-subheading mt-2 text-center text-[11px] text-[#85887e]">
            {activeTier.tagline}
            {activeTier.popular && " · Most popular"}
          </p>
        </div>

        {/* Categories */}
        <div className="overflow-hidden rounded-b-3xl">
          {categories.map((group, gi) => {
            const isOpen = !!open[group.category];
            const panelId = `${uid}-panel-${gi}`;
            return (
              <div
                key={group.category}
                className="border-t border-black/[0.06] first:border-t-0"
              >
                <button
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  onClick={() =>
                    setOpen((prev) => ({ ...prev, [group.category]: !isOpen }))
                  }
                  className={cn(
                    "group w-full text-left transition-colors hover:bg-[#faf9f5] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#0f7a47] md:grid",
                    MD_COLS,
                  )}
                >
                  <span className="flex items-center gap-3 px-4 py-4 sm:px-6">
                    <ChevronDown
                      className={cn(
                        "size-4 shrink-0 text-[#85887e] transition-transform duration-300 motion-reduce:transition-none",
                        !isOpen && "-rotate-90",
                      )}
                      aria-hidden="true"
                    />
                    <span className="font-heading text-sm font-semibold text-[#11120e] sm:text-base">
                      {group.category}
                    </span>
                    <span className="font-subheading rounded-full bg-black/[0.05] px-2 py-0.5 text-[11px] tabular-nums text-[#6d7066]">
                      {group.features.length}
                    </span>
                  </span>
                  <span aria-hidden="true" className="hidden md:block" />
                  <span
                    aria-hidden="true"
                    className={cn("hidden md:block", PRO_BAND)}
                  />
                  <span aria-hidden="true" className="hidden md:block" />
                </button>

                <div
                  id={panelId}
                  className={cn(
                    "grid transition-[grid-template-rows,visibility] duration-300 motion-reduce:transition-none",
                    isOpen ? "grid-rows-[1fr]" : "invisible grid-rows-[0fr]",
                  )}
                >
                  <div className="min-h-0 overflow-hidden">
                    {group.features.map((feat) => (
                      <div
                        key={feat.name}
                        className={cn(
                          "grid items-stretch border-t border-black/[0.05]",
                          ROW_COLS,
                        )}
                      >
                        {/* Name + hint */}
                        <div className="flex min-w-0 flex-col justify-center px-4 py-3.5 sm:px-6">
                          <span className="font-content text-[13px] font-medium text-[#11120e] sm:text-sm">
                            {feat.name}
                          </span>
                          {feat.hint && (
                            <span className="mt-0.5 text-xs leading-relaxed text-[#85887e]">
                              {feat.hint}
                            </span>
                          )}
                        </div>

                        {/* Mobile: selected plan only */}
                        <div className="flex items-center justify-end px-4 py-3.5 sm:px-6 md:hidden">
                          <ValueCell value={feat[mobileTier]} />
                        </div>

                        {/* Desktop: all plans */}
                        <div className="hidden items-center justify-center px-2 py-3.5 md:flex">
                          <ValueCell value={feat.starter} />
                        </div>
                        <div
                          className={cn(
                            "hidden items-center justify-center px-2 py-3.5 md:flex",
                            PRO_BAND,
                          )}
                        >
                          <ValueCell value={feat.pro} />
                        </div>
                        <div className="hidden items-center justify-center px-2 py-3.5 md:flex">
                          <ValueCell value={feat.business} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <p className="font-subheading mt-5 flex items-center justify-center gap-1.5 text-center text-xs text-[#85887e]">
        <Check className="size-3.5 text-[#0f7a47]" aria-hidden="true" />
        Every plan includes unlimited scheduled posts and official OAuth 2.0
        access.
      </p>
    </section>
  );
}
