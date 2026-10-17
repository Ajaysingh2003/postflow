import React from "react";
import type { LegalDocMeta, LegalSection } from "../types";
import { LegalHeader } from "./LegalHeader";
import { LegalSummaryBento } from "./LegalSummaryBento";
import { LegalTableOfContents } from "./LegalTableOfContents";
import { LegalSectionItem } from "./LegalSectionItem";
import { LegalCta } from "./LegalCta";

interface LegalDocumentLayoutProps {
  meta: LegalDocMeta;
  sections: LegalSection[];
}

export function LegalDocumentLayout({ meta, sections }: LegalDocumentLayoutProps) {
  return (
    <div className="w-full bg-[#faf9f5] min-h-screen">
      <LegalHeader meta={meta} />

      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
        <LegalSummaryBento summaries={meta.summaries} />

        <div className="grid relative grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-start">
          {/* Sticky Table of Contents Sidebar */}
          <aside className="lg:col-span-4 lg:sticky lg:top-8 lg:max-h-[calc(100vh-4rem)] lg:overflow-y-auto">
            <LegalTableOfContents sections={sections} />
          </aside>

          {/* Main Content Column */}
          <main className="lg:col-span-8 space-y-2">
            <div className="rounded-2xl sm:rounded-3xl border border-black/[0.08] bg-white p-6 sm:p-10 shadow-sm space-y-2">
              {sections.map((section) => (
                <LegalSectionItem key={section.id} section={section} />
              ))}
            </div>
          </main>
        </div>

        <LegalCta />
      </div>
    </div>
  );
}