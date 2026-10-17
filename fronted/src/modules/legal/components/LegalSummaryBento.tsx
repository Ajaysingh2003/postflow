import React from "react";
import { Sparkles } from "lucide-react";
import type { LegalSummaryPoint } from "../types";

interface LegalSummaryBentoProps {
  summaries: LegalSummaryPoint[];
}

export function LegalSummaryBento({ summaries }: LegalSummaryBentoProps) {
  if (!summaries || summaries.length === 0) return null;

  return (
    <div className="mb-10 sm:mb-12 overflow-hidden rounded-2xl sm:rounded-3xl border border-black/[0.08] bg-white p-6 sm:p-8 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-6 border-b border-black/[0.06]">
        <div className="flex items-center gap-2.5">
         
          <h2 className="font-heading text-lg sm:text-xl font-semibold text-[#11120e] tracking-tight">
            Key Takeaways (At A Glance)
          </h2>
        </div>
        <span className="font-subheading inline-flex items-center self-start sm:self-auto rounded-full border border-neutral-200/90 bg-neutral-50 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-600">
          Plain English Summary
        </span>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {summaries.map((item, index) => {
          const Icon = item.icon;
          return (
            <div
              key={index}
              className="flex flex-col justify-start space-y-2 rounded-xl bg-[#faf9f5]/80 p-4 border border-black/[0.04]"
            >
              <div className="flex size-8 items-center justify-center rounded-lg bg-white shadow-2xs text-[#0f7a47] border border-black/[0.05]">
                <Icon className="size-4" />
              </div>
              <h3 className="font-heading text-sm font-semibold text-neutral-900">
                {item.title}
              </h3>
              <p className="font-content text-xs text-neutral-600 leading-relaxed">
                {item.description}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
