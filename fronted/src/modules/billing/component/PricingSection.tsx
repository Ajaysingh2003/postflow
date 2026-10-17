"use client";

import React, { useState } from "react";
import PricingPlan from "./PricingPlan";
import PricingCardSection, { PricingSkeleton } from "./PricingCardSection";
import { Suspense } from "react";

function PricingSection() {
  const [timeLine, setTimeLine] = useState<
    "monthly" | "quarterly" | "annually"
  >("monthly");

  return (
    <section className="relative w-full py-16 sm:py-24 selection:bg-[#B3E61D]/30">
      <div className="mx-auto max-w-7xl ">
        {/* ── Typography Header Block ── */}
        <div className="flex flex-col items-center text-center max-w-3xl mx-auto mb-10 sm:mb-14">
          <div className="inline-flex items-center gap-2 rounded-full border border-black/[0.08] bg-[#fbfbf9] px-3.5 py-1 text-xs font-semibold text-neutral-800 shadow-2xs">
            <span className="size-1.5 rounded-full bg-[#4ff576] animate-pulse" />
            <span className="font-heading">Predictable Tier Pricing</span>
            <span className="text-neutral-300">•</span>
            <span className="font-subheading text-neutral-500">
              Free plan available
            </span>
          </div>

          <h2 className="mt-4 font-heading text-3xl sm:text-5xl lg:text-[36px] font-bold tracking-[-0.04em] text-[#11120e] leading-[1.08]">
            Transparent pricing for{" "}
            <span className="relative inline-block whitespace-nowrap">
              <span className="relative z-10 bg-[#98f9ae3c] text-[#11120e]">
                every scale
              </span>
              <span
                aria-hidden="true"
                className="absolute -inset-x-1.5 bottom-1 top-2 -z-0 rounded-[5px] bg-[#e7f6b8]"
              />
            </span>
          </h2>

          <p className="mt-4 font-subheading text-sm sm:text-base text-neutral-600 max-w-xl leading-relaxed tracking-normal">
            Plan your content, publish across channels, and shape your voice
            with AI. Start with Free. Paid plans include unlimited posts and
            monthly AI credits.
          </p>
        </div>

        {/* ── Billing Cycle Switcher ── */}
        <div
          aria-label="pricing-plan"
          className="w-full flex items-center justify-center mb-10"
        >
          <PricingPlan timeLine={timeLine} setTimeLine={setTimeLine} />
        </div>

        {/* ── Pricing Cards Grid ── */}
        <div className="w-full h-full px-4 md:px-0">
          <Suspense fallback={<PricingSkeleton />}>
            <PricingCardSection timeLine={timeLine} />
          </Suspense>
        </div>
      </div>
    </section>
  );
}

export default PricingSection;
