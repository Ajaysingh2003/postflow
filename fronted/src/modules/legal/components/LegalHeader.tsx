"use client";

import React, { useState } from "react";
import { Check, Copy, Printer, ShieldCheck, Clock, Calendar, Hash } from "lucide-react";
import type { LegalDocMeta } from "../types";

interface LegalHeaderProps {
  meta: LegalDocMeta;
}

export function LegalHeader({ meta }: LegalHeaderProps) {
  const [copied, setCopied] = useState(false);

  const handleCopyLink = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handlePrint = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  return (
    <section className="relative isolate w-full overflow-hidden pt-8 pb-10 sm:pt-12 sm:pb-14">
      {/* ------------------------------------------------------------------ */}
      {/* Decorative background matching Landing Page                        */}
      {/* ------------------------------------------------------------------ */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
      >
        {/* Subtle top glow */}
        <div className="absolute left-[15%] top-[-200px] h-[400px] w-[600px] rounded-full bg-[#3fda8a]/[0.08] blur-[130px]" />

        {/* Left curved line */}
        <div className="absolute -left-[300px] top-[-80px] h-[550px] w-[550px] rounded-full border-[18px] border-[#ebeae5]/60" />

        {/* Right curved line */}
        <div className="absolute -right-[320px] top-[40px] h-[650px] w-[650px] rounded-full border-[20px] border-[#ebeae5]/50" />
      </div>

      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl space-y-4 sm:space-y-5">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 rounded-full border border-neutral-200/90 bg-white/80 px-3 py-1 shadow-2xs backdrop-blur-xs">
            <span className="flex size-2 rounded-full bg-[#3fda8a] animate-pulse" />
            <span className="font-subheading text-[11px] font-semibold uppercase tracking-wider text-neutral-600">
              Draftva Trust & Compliance
            </span>
          </div>

          {/* Heading */}
          <h1 className="font-heading text-3xl sm:text-4xl md:text-5xl lg:text-[52px] font-medium leading-[1.08] tracking-[-0.04em] text-[#11120e]">
            {meta.title}
          </h1>

          {/* Description */}
          <p className="font-content text-base sm:text-lg text-[#6d6e68] leading-relaxed max-w-2xl">
            {meta.description}
          </p>

          {/* Metadata Bar & Actions */}
          <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-black/[0.06]">
            {/* Meta Tags */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs sm:text-sm text-neutral-500 font-content">
              <div className="flex items-center gap-1.5">
                <Calendar className="size-3.5 text-neutral-400" />
                <span>Last Updated: <strong className="text-neutral-800 font-medium">{meta.lastUpdated}</strong></span>
              </div>
              <span className="text-neutral-300 hidden sm:inline">•</span>
              <div className="flex items-center gap-1.5">
                <Hash className="size-3.5 text-neutral-400" />
                <span>Version {meta.version}</span>
              </div>
              <span className="text-neutral-300 hidden sm:inline">•</span>
              <div className="flex items-center gap-1.5">
                <Clock className="size-3.5 text-neutral-400" />
                <span>{meta.readTime}</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopyLink}
                className="inline-flex items-center gap-1.5 rounded-full border border-black/[0.08] bg-white px-3 py-1 text-xs font-medium text-neutral-700 shadow-2xs transition-all hover:bg-neutral-50 active:scale-95"
                title="Copy link to document"
              >
                {copied ? (
                  <>
                    <Check className="size-3.5 text-emerald-600" />
                    <span className="text-emerald-700 font-semibold">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="size-3.5 text-neutral-500" />
                    <span>Copy Link</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handlePrint}
                className="inline-flex items-center gap-1.5 rounded-full border border-black/[0.08] bg-white px-3 py-1 text-xs font-medium text-neutral-700 shadow-2xs transition-all hover:bg-neutral-50 active:scale-95"
                title="Print or Save as PDF"
              >
                <Printer className="size-3.5 text-neutral-500" />
                <span>Print</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
