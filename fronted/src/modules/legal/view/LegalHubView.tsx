"use client"
import React from "react";
import Link from "next/link";
import {
  ArrowRight,
  ShieldCheck,
  Lock,
  Sparkles,
  FileText,
  Cookie,
  AlertTriangle,
  Database,
  Server,
  CheckCircle2,
  Calendar,
  Clock,
} from "lucide-react";

import { LegalCta } from "../components/LegalCta";
import { LEGAL_DOCS } from "../data/legalDocsList";

export default function LegalHubView() {
  return (
    <div className="w-full bg-[#faf9f5] min-h-screen">
      {/* ------------------------------------------------------------------ */}
      {/* Hero Header                                                        */}
      {/* ------------------------------------------------------------------ */}
      <section className="relative isolate w-full overflow-hidden pt-8 pb-10 sm:pt-12 sm:pb-14">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
        >
          <div className="absolute left-[20%] top-[-200px] h-[400px] w-[600px] rounded-full bg-[#3fda8a]/[0.08] blur-[130px]" />
          <div className="absolute -left-[300px] top-[-80px] h-[550px] w-[550px] rounded-full border-[18px] border-[#ebeae5]/60" />
          <div className="absolute -right-[320px] top-[40px] h-[650px] w-[650px] rounded-full border-[20px] border-[#ebeae5]/50" />
        </div>

        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl space-y-4 sm:space-y-5">
            <div className="inline-flex items-center gap-2 rounded-full border border-neutral-200/90 bg-white/80 px-3 py-1 shadow-2xs backdrop-blur-xs">
              <span className="flex size-2 rounded-full bg-[#3fda8a] animate-pulse" />
              <span className="font-subheading text-[11px] font-semibold uppercase tracking-wider text-neutral-600">
                Legal & Governance
              </span>
            </div>

            <h1 className="font-heading text-3xl sm:text-4xl md:text-5xl lg:text-[52px] font-medium leading-[1.08] tracking-[-0.04em] text-[#11120e]">
              Draftva Legal & Compliance Hub
            </h1>

            <p className="font-content text-base sm:text-lg text-[#6d6e68] leading-relaxed max-w-2xl">
              Complete transparency into how Draftva operates, safeguards your credentials, respects your intellectual property, and adheres to official partner platform terms.
            </p>
          </div>
        </div>
      </section>

      {/* Tabs Nav */}


      {/* ------------------------------------------------------------------ */}
      {/* Directory Grid                                                     */}
      {/* ------------------------------------------------------------------ */}
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14 space-y-12">
        {/* Core Commitments Bento */}
        <div className="rounded-2xl sm:rounded-3xl border border-black/[0.08] bg-white p-6 sm:p-8 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-black/[0.05]">
            <div className="flex items-center gap-2.5">
              <div className="flex size-7 items-center justify-center rounded-lg bg-[#3fda8a]/15 text-[#0f7a47]">
                <ShieldCheck className="size-4" />
              </div>
              <h2 className="font-heading text-lg sm:text-xl font-semibold text-[#11120e] tracking-tight">
                Our Core Legal & Privacy Commitments
              </h2>
            </div>
            <span className="font-subheading text-xs font-semibold uppercase tracking-wider text-neutral-500">
              Draftva Standards
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-xl bg-[#faf9f5] p-4 border border-black/[0.04] space-y-1.5">
              <div className="flex size-7 items-center justify-center rounded-md bg-white text-[#0f7a47] shadow-2xs border border-black/[0.05]">
                <Lock className="size-3.5" />
              </div>
              <h3 className="font-heading font-semibold text-neutral-900 text-sm">Official OAuth Only</h3>
              <p className="text-xs text-neutral-600 leading-relaxed">
                We never store passwords or use browser scraping. Authentication occurs exclusively via official developer APIs.
              </p>
            </div>

            <div className="rounded-xl bg-[#faf9f5] p-4 border border-black/[0.04] space-y-1.5">
              <div className="flex size-7 items-center justify-center rounded-md bg-white text-[#0f7a47] shadow-2xs border border-black/[0.05]">
                <Sparkles className="size-3.5" />
              </div>
              <h3 className="font-heading font-semibold text-neutral-900 text-sm">You Own Your Content</h3>
              <p className="text-xs text-neutral-600 leading-relaxed">
                You retain 100% intellectual property ownership of your drafts, posts, media assets, and ideas.
              </p>
            </div>

            <div className="rounded-xl bg-[#faf9f5] p-4 border border-black/[0.04] space-y-1.5">
              <div className="flex size-7 items-center justify-center rounded-md bg-white text-[#0f7a47] shadow-2xs border border-black/[0.05]">
                <ShieldCheck className="size-3.5" />
              </div>
              <h3 className="font-heading font-semibold text-neutral-900 text-sm">No Foundation Training</h3>
              <p className="text-xs text-neutral-600 leading-relaxed">
                Enterprise zero-data-retention agreements guarantee your private content is never used to train public LLMs.
              </p>
            </div>

            <div className="rounded-xl bg-[#faf9f5] p-4 border border-black/[0.04] space-y-1.5">
              <div className="flex size-7 items-center justify-center rounded-md bg-white text-[#0f7a47] shadow-2xs border border-black/[0.05]">
                <CheckCircle2 className="size-3.5" />
              </div>
              <h3 className="font-heading font-semibold text-neutral-900 text-sm">Strict Anti-Spam</h3>
              <p className="text-xs text-neutral-600 leading-relaxed">
                We prohibit automated voting, bot farms, and coordinated inauthentic activity on Reddit, X, and other networks.
              </p>
            </div>
          </div>
        </div>

        {/* Document Cards Grid */}
        <div className="space-y-6">
          <div>
            <h2 className="font-heading text-2xl sm:text-3xl font-semibold tracking-tight text-[#11120e]">
              Legal Documents & Policies
            </h2>
            <p className="font-content text-sm sm:text-base text-[#6d6e68] mt-1">
              Select any document below to view the full text and plain-English summary.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {LEGAL_DOCS.map((doc) => {
              const Icon =
                doc.id === "terms"
                  ? FileText
                  : doc.id === "privacy"
                  ? ShieldCheck
                  : doc.id === "cookies"
                  ? Cookie
                  : doc.id === "acceptable-use"
                  ? AlertTriangle
                  : doc.id === "dpa"
                  ? Database
                  : Server;

              return (
                <div
                  key={doc.id}
                  className="group flex flex-col justify-between rounded-2xl sm:rounded-3xl border border-black/[0.08] bg-white p-6 sm:p-7 shadow-sm transition-all duration-300 hover:border-black/[0.14] hover:shadow-md"
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex size-10 items-center justify-center rounded-xl bg-neutral-100 text-neutral-700 shadow-2xs group-hover:bg-[#3fda8a]/15 group-hover:text-[#0f7a47] transition-colors">
                        <Icon className="size-5" />
                      </div>
                      <span className="font-mono text-xs font-medium text-neutral-400">
                        v{doc.version}
                      </span>
                    </div>

                    <div>
                      <h3 className="font-heading text-xl font-semibold tracking-tight text-[#11120e] group-hover:text-[#0f7a47] transition-colors">
                        {doc.title}
                      </h3>
                      <p className="font-content text-xs sm:text-sm text-neutral-500 leading-relaxed mt-2 line-clamp-3">
                        {doc.description}
                      </p>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-neutral-400 font-content pt-2 border-t border-black/[0.04]">
                      <div className="flex items-center gap-1">
                        <Calendar className="size-3" />
                        <span>{doc.lastUpdated}</span>
                      </div>
                      <span>•</span>
                      <div className="flex items-center gap-1">
                        <Clock className="size-3" />
                        <span>{doc.readTime}</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-6">
                    <Link
                      href={doc.slug}
                      className="inline-flex w-full items-center justify-between rounded-xl border border-black/[0.08] bg-[#faf9f5] px-4 py-2.5 text-xs font-semibold text-neutral-800 transition-all group-hover:bg-[#3fda8a] group-hover:border-[#3fda8a] group-hover:text-neutral-950"
                    >
                      <span>Read Policy</span>
                      <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Bottom CTA */}
        <LegalCta />
      </div>
    </div>
  );
}
