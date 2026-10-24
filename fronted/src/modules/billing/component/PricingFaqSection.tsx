"use client";

import React, { useState } from "react";
import { ChevronDown, MessageCircleQuestion } from "lucide-react";
import { cn } from "@/lib/utils";

interface FaqItem {
  question: string;
  answer: string;
}

const FAQS: FaqItem[] = [
  {
    question: "Is there a free plan?",
    answer:
      "Yes. Free includes 20 AI credits per month, 5 posts per month and 2 connected accounts, with no trial deadline. Paid plans start at checkout and include unlimited posts, more AI credits and custom brand voice profiles.",
  },
  {
    question: "Is post scheduling truly unlimited on all paid plans?",
    answer:
      "Yes! Unlike traditional tools that cap your calendar or charge extra when your queue grows, every paid Draftva plan includes unlimited scheduled and published posts. Batch and plan as many weeks or months in advance as you want across all your connected channels.",
  },
  {
    question: "What are AI credits and how are they counted?",
    answer:
      "AI credits power Draftva's intelligent assistant features—including viral hook generation, tone adjustments, thread expansion, and carousel copy synthesis. One AI credit typically refines or generates one complete post variant. If you ever hit your monthly credit limit, your publishing queue and scheduling remain completely active.",
  },
  {
    question: "Can I switch billing cycles or cancel at any time?",
    answer:
      "Monthly, every-six-months, and annual billing are available. Existing subscribers can open billing management from Settings or the Upgrade button. Available changes, charges, and cancellation terms are shown by Dodo before you confirm.",
  },
  {
    question: "Are my social media accounts protected from bans or shadowbans?",
    answer:
      "100% protected. Draftva connects strictly through official, partner-approved OAuth 2.0 APIs for X, LinkedIn, Threads, Instagram, Facebook, and Reddit. We never ask for your passwords, and we never use unauthorized browser scrapers or bots that violate platform terms.",
  },
  {
    question: "How do multiple workspaces and team seats work?",
    answer:
      "Workspaces keep different brands, projects, or agency clients cleanly compartmentalized with their own queues, tone voices, and analytics. Team seats let you invite colleagues, co-founders, or editors to collaborate with granular permissions and approval flows.",
  },
];

export default function PricingFaqSection() {
  const [openIdx, setOpenIdx] = useState<number | null>(0);

  const toggle = (idx: number) => {
    setOpenIdx((current) => (current === idx ? null : idx));
  };

  return (
    <section className="mx-auto w-full max-w-4xl py-12 sm:py-20">
      {/* Section Header */}
      <div className="mx-auto max-w-2xl text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-[#3fda8a]/40 bg-[#3fda8a]/10 px-3 py-1">
          <MessageCircleQuestion className="size-3.5 text-[#0f7a47]" />
          <span className="font-subheading text-xs font-medium tracking-wide text-[#0f7a47]">
            Got Questions?
          </span>
        </div>

        <h3 className="font-heading mt-4 text-2xl font-bold tracking-tight text-[#11120e] sm:text-4xl">
          Frequently asked questions
        </h3>

        <p className="mt-3 font-subheading text-sm text-[#6d7066] sm:text-base">
          Everything you need to know about billing, plans, quotas, and platform
          safety. Have another question? Our support team is ready to help.
        </p>
      </div>

      {/* FAQ Accordion List */}
      <div className="mt-10 space-y-3">
        {FAQS.map((faq, idx) => {
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

              {isOpen && (
                <div className="border-t border-black/[0.04] px-5 pb-5 pt-3">
                  <p className="font-content text-sm leading-relaxed text-[#6d7066]">
                    {faq.answer}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
