"use client";

import React, { useState } from "react";
import { ChevronDown, MessageCircleQuestion } from "lucide-react";
import { cn } from "@/lib/utils";

import { PRICING_FAQS } from "../pricing-faqs";

export default function PricingFaqSection() {
  const [openIdx, setOpenIdx] = useState<number | null>(0);

  const toggle = (idx: number) => {
    setOpenIdx((current) => (current === idx ? null : idx));
  };

  return (
    <section id="faqs" className="mx-auto w-full max-w-4xl py-12 sm:py-20">
      {/* Section Header */}
      <div className="mx-auto max-w-2xl text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-[#3fda8a]/40 bg-[#3fda8a]/10 px-3 py-1">
          <MessageCircleQuestion className="size-3.5 text-[#0f7a47]" />
          <span className="font-subheading text-xs font-medium tracking-wide text-[#0f7a47]">
            Got Questions?
          </span>
        </div>

        <h2 className="font-heading mt-4 text-2xl font-bold tracking-tight text-[#11120e] sm:text-4xl">
          Frequently asked questions
        </h2>

        <p className="mt-3 font-subheading text-sm text-[#6d7066] sm:text-base">
          Everything you need to know about billing, plans, quotas, and platform
          safety. Have another question? Our support team is ready to help.
        </p>
      </div>

      {/* FAQ Accordion List */}
      <div className="mt-10 space-y-3">
        {PRICING_FAQS.map((faq, idx) => {
          const isOpen = openIdx === idx;
          return (
            <div
              key={faq.question}
              className={cn(
                "overflow-hidden rounded-2xl border transition-all duration-200",
                isOpen
                  ? "border-[#3fda8a]/60 bg-white shadow-sm"
                  : "border-black/[0.06] bg-white hover:border-black/15",
              )}
            >
              <button
                type="button"
                onClick={() => toggle(idx)}
                aria-expanded={isOpen}
                aria-controls={`pricing-faq-${idx}`}
                className="flex w-full items-center justify-between gap-4 p-5 text-left"
              >
                <span className="font-heading text-sm font-semibold text-[#11120e] sm:text-base">
                  {faq.question}
                </span>

                <span
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-full transition-transform duration-200",
                    isOpen
                      ? "rotate-180 bg-[#3fda8a]/20 text-[#0f7a47]"
                      : "bg-[#faf9f5] text-[#85887e]",
                  )}
                >
                  <ChevronDown className="size-4" />
                </span>
              </button>

              <div
                id={`pricing-faq-${idx}`}
                hidden={!isOpen}
                className="border-t border-black/[0.04] px-5 pb-5 pt-3"
              >
                <p className="font-content text-sm leading-relaxed text-[#6d7066]">
                  {faq.answer}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
