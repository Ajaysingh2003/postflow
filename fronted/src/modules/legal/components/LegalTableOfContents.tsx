"use client";

import React, { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { ChevronRight, HelpCircle, Mail, List } from "lucide-react";
import type { LegalSection } from "../types";

interface LegalTableOfContentsProps {
  sections: LegalSection[];
}

export function LegalTableOfContents({ sections }: LegalTableOfContentsProps) {
  const [activeId, setActiveId] = useState<string>(sections[0]?.id || "");
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  useEffect(() => {
    if (sections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        });
      },
      {
        rootMargin: "-80px 0px -70% 0px",
        threshold: 0.1,
      }
    );

    sections.forEach((section) => {
      const el = document.getElementById(section.id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [sections]);

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      const topOffset = 100;
      const elementPosition = el.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - topOffset;

      window.scrollTo({
        top: offsetPosition,
        behavior: "smooth",
      });
      setActiveId(id);
      setIsMobileOpen(false);
    }
  };

  return (
    <>
      {/* ------------------------------------------------------------------ */}
      {/* Mobile Jump Menu                                                   */}
      {/* ------------------------------------------------------------------ */}
      <div className="lg:hidden mb-6">
        <button
          type="button"
          onClick={() => setIsMobileOpen(!isMobileOpen)}
          className="flex w-full items-center justify-between rounded-xl border border-black/[0.08] bg-white p-3.5 text-left shadow-2xs"
        >
          <div className="flex items-center gap-2 text-sm font-medium text-neutral-800">
            <List className="size-4 text-neutral-500" />
            <span>Table of Contents ({sections.length} sections)</span>
          </div>
          <ChevronRight
            className={cn(
              "size-4 text-neutral-400 transition-transform duration-200",
              isMobileOpen && "rotate-90"
            )}
          />
        </button>

        {isMobileOpen && (
          <div className="mt-2 rounded-xl border border-black/[0.08] bg-white p-3 shadow-md space-y-1">
            {sections.map((section) => (
              <button
                key={section.id}
                type="button"
                onClick={() => scrollTo(section.id)}
                className={cn(
                  "flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs font-medium transition-colors",
                  activeId === section.id
                    ? "bg-[#3fda8a]/15 text-[#0f7a47] font-semibold"
                    : "text-neutral-600 hover:bg-neutral-50"
                )}
              >
                <span className="truncate">
                  {section.number ? `${section.number}. ` : ""}
                  {section.title}
                </span>
                {activeId === section.id && (
                  <span className="size-1.5 rounded-full bg-[#1db868]" />
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Desktop Sticky Table of Contents                                   */}
      {/* ------------------------------------------------------------------ */}
      <aside className="hidden lg:block sticky top-28 self-start w-full space-y-6">
        <div className="rounded-2xl border border-black/[0.08] bg-white p-5 shadow-2xs">
          <h3 className="font-heading text-xs font-bold uppercase tracking-wider text-neutral-500 pb-3 border-b border-black/[0.05]">
            On This Page
          </h3>

          <nav className="mt-4 space-y-1 max-h-[calc(100vh-280px)] overflow-y-auto no-scrollbar pr-1">
            {sections.map((section) => {
              const isActive = activeId === section.id;
              return (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => scrollTo(section.id)}
                  className={cn(
                    "group flex w-full items-start gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-[13px] leading-snug transition-all duration-150",
                    isActive
                      ? "bg-[#3fda8a]/15 text-neutral-950 font-semibold"
                      : "text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50"
                  )}
                >
                  {section.number && (
                    <span
                      className={cn(
                        "font-mono text-[11px] font-semibold mt-0.5 shrink-0",
                        isActive ? "text-[#0f7a47]" : "text-neutral-400 group-hover:text-neutral-600"
                      )}
                    >
                      {section.number}
                    </span>
                  )}
                  <span className="flex-1 line-clamp-2">{section.title}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Support helper card */}
        <div className="rounded-2xl border border-black/[0.08] bg-white p-5 shadow-2xs space-y-2.5">
          <div className="flex items-center gap-2 text-neutral-900 font-heading text-sm font-semibold">
            <HelpCircle className="size-4 text-[#0f7a47]" />
            <span>Need clarification?</span>
          </div>
          <p className="text-xs text-neutral-500 leading-relaxed">
            Our legal and privacy compliance team is here to answer any questions or process formal requests.
          </p>
          <a
            href="mailto:support@draftva.com"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0f7a47] hover:underline"
          >
            <Mail className="size-3.5" />
            <span>legal@draftva.com</span>
          </a>
        </div>
      </aside>
    </>
  );
}
