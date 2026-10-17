import React from "react";
import Link from "next/link";
import { ArrowRight, ShieldCheck, Mail } from "lucide-react";

export function LegalCta() {
  return (
    <div className="my-16 sm:my-20">
      <div className="relative isolate overflow-hidden rounded-[24px] sm:rounded-[32px] border border-black/[0.08] bg-white p-8 sm:p-12 shadow-sm">
        {/* Subtle decorative glow */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-[#3fda8a]/15 blur-3xl"
        />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div className="max-w-xl space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-neutral-200/90 bg-neutral-50 px-3 py-1 text-xs font-semibold text-neutral-600">
              <ShieldCheck className="size-3.5 text-[#0f7a47]" />
              <span>Official APIs • Encrypted Tokens • No Spam</span>
            </div>

            <h3 className="font-heading text-2xl sm:text-3xl font-semibold tracking-tight text-[#11120e]">
              Publish with confidence across 8 major networks
            </h3>

            <p className="font-content text-sm sm:text-base text-[#6d6e68] leading-relaxed">
              Connect your official accounts on X, LinkedIn, Reddit, Bluesky, Mastodon, Facebook, Instagram, and Threads with full peace of mind.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row md:flex-col lg:flex-row items-stretch sm:items-center gap-3 shrink-0">
            <Link
              href="/register"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#3fda8a] px-6 py-3.5 text-sm font-semibold text-neutral-950 shadow-sm transition-all hover:bg-[#3fda8ae6] hover:translate-y-[-1px] active:translate-y-0"
            >
              <span>Start 3-Day Free Trial</span>
              <ArrowRight className="size-4" />
            </Link>

            <a
              href="mailto:legal@draftva.com"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-black/[0.08] bg-white px-5 py-3.5 text-sm font-medium text-neutral-700 shadow-2xs transition-all hover:bg-neutral-50"
            >
              <Mail className="size-4 text-neutral-500" />
              <span>Contact Legal</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
