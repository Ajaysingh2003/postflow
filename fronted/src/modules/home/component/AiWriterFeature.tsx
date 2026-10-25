"use client";

import React, { useState } from "react";
import {
  Sparkles,
  Wand2,
  RefreshCw,
  MessageSquareText,
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function AiWriterFeature() {
  // Card 1 State: Inline Polish popover
  const [isPolished, setIsPolished] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [altVersion, setAltVersion] = useState(0);

  const polishedTexts = [
    "Career update: I'm joining Palantir Technologies.",
    "Excited to share that I'm starting a new chapter at Palantir Technologies.",
  ];

  const handleRetry = () => {
    setIsRetrying(true);
    setTimeout(() => {
      setAltVersion((prev) => (prev + 1) % polishedTexts.length);
      setIsPolished(true);
      setIsRetrying(false);
    }, 400);
  };

  // Card 2 State: Sidebar Assistant response
  const [isApplied, setIsApplied] = useState(false);

  // Card 3 State: Brand Voice tone switcher
  const [activeVoice, setActiveVoice] = useState<
    "founder" | "concise" | "technical"
  >("founder");

  return (
    <section className="mx-auto w-full max-w-7xl  py-16   lg:py-24">
      {/* Exact Requested Header */}
      <div className="max-w-2xl">
        <div className="inline-flex items-center gap-2 rounded-full border border-[#3fda8a]/40 bg-[#3fda8a]/10 px-3 py-1">
          <span className="size-2 rounded-full bg-[#3fda8a]" />
          <span className="font-subheading text-xs font-medium tracking-wide text-[#11120e]">
            Draftva AI Engine
          </span>
        </div>

        <h2 className="font-heading mt-4 text-3xl font-semibold tracking-tight text-[#11120e] sm:text-5xl">
          Write like an expert.{" "}
          <span className="underline decoration-[#3fda8a] decoration-[3px] underline-offset-8">
            In one click.
          </span>
        </h2>

        <p className="mt-4 text-base leading-relaxed text-[#6d7066] sm:text-lg">
          Stop staring at a blank cursor. Draftva’s AI editor fixes grammar,
          expands raw notes into viral threads, and matches your personal brand
          voice.
        </p>
      </div>

      {/* 3-Column Architectural Grid */}
      <div className="mt-12 grid grid-cols-1 divide-y divide-black/[0.07] overflow-hidden rounded-3xl border border-black/[0.08] bg-white shadow-[0_24px_60px_-20px_rgba(17,18,14,0.07)] lg:mt-16 lg:grid-cols-3 lg:divide-x lg:divide-y-0">
        {/* =====================================================================
            CARD 01: FIX TYPOS & SHARPEN HOOKS (Inline Popover from Screenshot 1)
        ===================================================================== */}
        <div className="flex flex-col justify-between p-6 sm:p-8 lg:p-10">
          <div>
            <div className="flex items-center justify-between">
              <span className="font-subheading inline-flex size-7 items-center justify-center rounded-lg bg-[#3fda8a] text-xs font-bold text-[#11120e]">
                01
              </span>
              <span className="font-subheading text-xs text-[#85887e]">
                Inline Correction
              </span>
            </div>

            <h3 className="font-heading mt-6 text-xl font-semibold tracking-tight text-[#11120e]">
              Fix typos & sharpen hooks
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-[#6d7066]">
              Highlight any sentence to instantly clean up spelling, fix awkward
              phrasing, and keep your post punchy for X and LinkedIn.
            </p>
          </div>

          {/* Visual: Interactive Inline Editor Mockup */}
          <div className="mt-8 pt-6 border-t border-black/[0.05]">
            <div className="rounded-2xl border border-black/[0.08] bg-[#faf9f5] p-4">
              <div className="flex items-center justify-between border-b border-black/[0.06] pb-2.5">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-[#11120e]">
                  <Wand2 className="size-3.5 text-[#0f7a47]" />
                  <span>Improve writing</span>
                </div>
                <span className="font-subheading text-[10px] text-[#85887e]">
                  44 / 280
                </span>
              </div>

              {/* Text box with diff preview */}
              <div className="mt-3 rounded-xl border border-black/[0.06] bg-white p-3 shadow-2xs">
                <p className="text-xs text-[#11120e]">
                  {isPolished ? (
                    <span className="bg-[#3fda8a]/30 px-1 py-0.5 rounded font-medium">
                      {polishedTexts[altVersion]}
                    </span>
                  ) : (
                    <span className="text-[#6d7066]">
                      career update i am joining palantir techlogy
                    </span>
                  )}
                </p>
              </div>

              {/* Action Toolbar */}
              <div className="mt-3 flex items-center gap-2">
                <button
                  style={{ minHeight: "32px" }}
                  type="button"
                  onClick={() => setIsPolished(!isPolished)}
                  className={cn(
                    isPolished ? "secondary-btn" : "primary-btn",
                    "font-subheading flex-1 rounded-xl px-3 py-1.5 text-xs font-medium transition-all",
                  )}
                >
                  {isPolished ? "Reset text" : "Replace ✨"}
                </button>
                <button
                  style={{ minHeight: "32px" }}
                  type="button"
                  disabled={isRetrying}
                  onClick={handleRetry}
                  className="secondary-btn font-subheading flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-medium"
                >
                  <RefreshCw
                    className={cn("size-3", isRetrying && "animate-spin")}
                  />
                  Retry
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* =====================================================================
            CARD 02: TURN NOTES INTO THREADS (Assistant Sidebar from Screenshot 2)
        ===================================================================== */}
        <div className="flex flex-col justify-between bg-[#faf9f5]/50 p-6 sm:p-8 lg:p-10">
          <div>
            <div className="flex items-center justify-between">
              <span className="font-subheading inline-flex size-7 items-center justify-center rounded-lg bg-[#3fda8a] text-xs font-bold text-[#11120e]">
                02
              </span>
              <span className="font-subheading inline-flex items-center gap-1 text-xs text-[#11120e]">
                <Sparkles className="size-3 text-[#3fda8a] fill-[#3fda8a]" />
                Sidebar Copilot
              </span>
            </div>

            <h3 className="font-heading mt-6 text-xl font-semibold tracking-tight text-[#11120e]">
              Turn raw notes into full threads
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-[#6d7066]">
              Ask the AI assistant to expand messy bullet points into
              multi-tweet threads, professional carousels, or engaging hooks.
            </p>
          </div>

          {/* Visual: Assistant Suggestion Card */}
          <div className="mt-8 pt-6 border-t border-black/[0.05]">
            <div className="rounded-2xl border border-black/[0.08] bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between border-b border-black/[0.06] pb-2">
                <span className="font-subheading text-xs font-semibold text-[#11120e] flex items-center gap-1.5">
                  <MessageSquareText className="size-3.5 text-[#0f7a47]" />
                  Assistant suggestion
                </span>
                <span className="font-subheading rounded bg-[#3fda8a]/20 px-2 py-0.5 text-[10px] font-semibold text-[#0f7a47]">
                  Ready
                </span>
              </div>

              <div className="mt-3 rounded-xl bg-[#faf9f5] p-3 border border-black/[0.05]">
                <p className="text-xs leading-relaxed text-[#11120e]">
                  {isApplied
                    ? "✓ Draft applied to your main editor. Ready to schedule!"
                    : "Career update: I'm joining Palantir Technologies. Excited to get to work on mission-critical systems."}
                </p>
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-black/[0.06] pt-3">
                <span className="font-subheading text-[10px] text-[#85887e]">
                  AI Credits: 12 / 20
                </span>
                <button
                  style={{ minHeight: "32px" }}
                  type="button"
                  onClick={() => setIsApplied(!isApplied)}
                  className={cn(
                    isApplied ? "secondary-btn" : "primary-btn",
                    "font-subheading rounded-xl px-3 py-1.5 text-xs font-medium",
                  )}
                >
                  {isApplied ? "Applied ✓" : "Apply Draft"}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* =====================================================================
            CARD 03: BRAND VOICE & AGENTS (Persona Engine)
        ===================================================================== */}
        <div className="flex flex-col justify-between p-6 sm:p-8 lg:p-10">
          <div>
            <div className="flex items-center justify-between">
              <span className="font-subheading inline-flex size-7 items-center justify-center rounded-lg bg-[#3fda8a] text-xs font-bold text-[#11120e]">
                03
              </span>
              <span className="font-subheading inline-flex items-center gap-1.5 text-xs text-[#11120e]">
                <span className="size-2 rounded-full bg-[#3fda8a] animate-pulse" />
                Persona Engine
              </span>
            </div>

            <h3 className="font-heading mt-6 text-xl font-semibold tracking-tight text-[#11120e]">
              Trained on your writing style
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-[#6d7066]">
              Draftva analyzes your past posts to learn your exact cadence,
              vocabulary, and formatting rules so it never sounds like generic
              AI.
            </p>
          </div>

          {/* Visual: Voice Tone Switcher & Preview */}
          <div className="mt-8 pt-6 border-t border-black/[0.05]">
            <div className="rounded-2xl border border-black/[0.08] bg-[#faf9f5] p-4">
              <div className="grid grid-cols-3 gap-1.5">
                {(
                  [
                    { id: "founder", label: "Founder" },
                    { id: "concise", label: "Concise" },
                    { id: "technical", label: "Technical" },
                  ] as const
                ).map((voice) => (
                  <button
                    style={{ minHeight: "32px" }}
                    key={voice.id}
                    type="button"
                    onClick={() => setActiveVoice(voice.id)}
                    className={cn(
                      activeVoice === voice.id
                        ? "primary-btn"
                        : "secondary-btn",
                      "font-subheading rounded-xl py-1.5 text-center text-xs font-medium transition-all",
                    )}
                  >
                    {voice.label}
                  </button>
                ))}
              </div>

              <div className="mt-3.5 rounded-xl border border-black/[0.06] bg-white p-3 shadow-2xs">
                <span className="font-subheading text-[10px] text-[#85887e]">
                  Active Persona Output
                </span>
                <p className="mt-1 text-xs italic leading-normal text-[#11120e]">
                  {activeVoice === "founder" &&
                    `"We spent 6 months rebuilding our backend. Here's what we learned about scaling microservices..."`}
                  {activeVoice === "concise" &&
                    `"Shipped v2.4 today. Faster queries, zero downtime."`}
                  {activeVoice === "technical" &&
                    `"Configured Go Gin microservices with Redis Pub/Sub for sub-10ms trading event streams."`}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
