"use client";
// TODO(launch-content): Owner must verify existing endorsements, product and compliance claims; do not reuse them in structured data.

import React from "react";
import {
  ShieldCheck,
  CalendarCheck,
  RefreshCw,
  Lock,
  type LucideIcon,
} from "lucide-react";

const GUARANTEES: {
  icon: LucideIcon;
  badge: string;
  title: string;
  description: string;
}[] = [
  {
    icon: CalendarCheck,
    badge: "Free plan",
    title: "Start free, upgrade when ready",
    description:
      "Use the Free plan with no expiry. Choose a paid plan when you need more AI credits, accounts or brand profiles.",
  },
  {
    icon: ShieldCheck,
    badge: "OAuth 2.0",
    title: "100% official APIs",
    description:
      "Zero account risk. We exclusively connect via official OAuth 2.0 endpoints—no password storing or browser scrapers.",
  },
  {
    icon: RefreshCw,
    badge: "No lock-in",
    title: "Cancel anytime in 1 click",
    description:
      "No commitments or retention hurdles. Manage your billing, upgrade, downgrade, or cancel instantly from your dashboard.",
  },
  {
    icon: Lock,
    badge: "AES-256",
    title: "Encrypted at rest",
    description:
      "Your tokens and draft assets are secured with AES-256 encryption at rest and processed via SOC-2 compliant infrastructure.",
  },
];

export default function PricingGuarantee() {
  return (
    <section
      aria-label="Pricing and security guarantees"
      className="mx-auto w-full max-w-6xl py-8 sm:py-12"
    >
      <div className="overflow-hidden rounded-3xl border border-black/[0.08] bg-white shadow-[0_18px_40px_-20px_rgba(17,18,14,0.06)]">
        {/* Top Trust Header Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-black/[0.06] bg-[#faf9f5] px-5 py-3 sm:px-7">
          <div className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="size-2 rounded-full bg-[#3fda8a]"
            />
            <h2 className="font-subheading text-xs font-semibold text-[#11120e]">
              Risk-Free Billing & Account Safety
            </h2>
          </div>
          <span className="font-subheading text-[11px] text-[#85887e]">
            Official platform partner · Zero shadowban risk
          </span>
        </div>

        {/* 4-Column Hairline-Divided Grid */}
        <div className="grid grid-cols-1 divide-y divide-black/[0.06] sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4">
          {GUARANTEES.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.title}
                className="group flex flex-col justify-between p-5 transition-colors hover:bg-[#faf9f5]/60 sm:p-6"
              >
                <div>
                  {/* Top Row: Icon + Spec Pill */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex size-8 items-center justify-center rounded-lg bg-[#3fda8a]/20 text-[#0f7a47] transition-colors group-hover:bg-[#3fda8a] group-hover:text-[#11120e]">
                      <Icon className="size-4" aria-hidden="true" />
                    </div>
                    <span className="font-subheading rounded-md border border-black/[0.06] bg-[#faf9f5] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#6d7066]">
                      {item.badge}
                    </span>
                  </div>

                  {/* Title */}
                  <h3 className="font-heading mt-4 text-[15px] font-semibold tracking-tight text-[#11120e]">
                    {item.title}
                  </h3>

                  {/* Body (No font utility class per your design rules) */}
                  <p className="mt-1.5 text-xs leading-relaxed text-[#6d7066]">
                    {item.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
