import React from "react";
import type { LegalSection } from "../types";

interface LegalSectionItemProps {
  section: LegalSection;
}

export function LegalSectionItem({ section }: LegalSectionItemProps) {
  return (
    <section
      id={section.id}
      className="scroll-mt-32 pb-12 pt-2 border-b border-black/[0.06] last:border-b-0 space-y-4"
    >
      <div className="flex items-center gap-2">
        {section.number && (
          <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded-md bg-neutral-100 text-neutral-600 border border-black/[0.04]">
            {section.number}
          </span>
        )}
      </div>

      <h2 className="font-heading text-2xl sm:text-3xl font-semibold tracking-tight text-[#11120e]">
        {section.title}
      </h2>

      <div className="font-content text-[15px] sm:text-[16px] leading-[1.75] text-[#3f413a] prose prose-neutral max-w-none">
        {section.content}
      </div>
    </section>
  );
}
