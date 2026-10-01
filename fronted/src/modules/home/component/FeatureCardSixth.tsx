"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  CheckCircle2,
  Mail,
  Megaphone,
  MousePointerClick,
  Sparkles,
  TrendingUp,
  UserCheck,
  Users,
  Webhook,
} from "lucide-react";
import { BentoCard, BentoHeader, CardBottomFade } from "./FeatureSection";

const CAMPAIGNS = [
  {
    name: "Enterprise Demo Funnel",
    trigger: "Video milestone: 75% watched",
    leads: "1,420",
    convRate: "14.2%",
    active: true,
  },
  {
    name: "Product Walkthrough CTA",
    trigger: "Mid-roll lead capture (02:15)",
    leads: "890",
    convRate: "11.8%",
    active: false,
  },
];

export function FeatureCardSixth() {
  const [selectedCampaign, setSelectedCampaign] = useState(0);
  const [formSubmitted, setFormSubmitted] = useState(false);

  return (
    <BentoCard className="relative flex h- flex-col overflow-hidden bg-white shadow-md">
      <BentoHeader
        icon={Megaphone}
        badge="Lead Generation & Growth"
        title="Turn video views into signed clients"
        description="Capture leads directly inside the player, trigger automated CRM workflows, and push qualified buyers straight down your sales funnel."
        linkText="Explore lead capture ↗"
      />

      <div className="relative mt-2 flex-1 px-4 pb-6 sm:px-6">
        <div className="relative z-10 mx-auto w-full max-w-[620px] space-y-3.5">
          {/* Main Funnel Simulator Window */}
          <div className="overflow-hidden rounded-2xl border border-black/[0.08] bg-[#fbfbf9] p-3.5 shadow-2xs sm:p-4">
            {/* Upper Interactive Preview: In-Player Lead Gate to Webhook */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-12">
              {/* Left Side: Mock Video Frame with Overlay */}
              <div className="relative flex aspect-video flex-col justify-between overflow-hidden rounded-xl border border-black/[0.08] bg-[#0d0f0c] p-3 text-white sm:col-span-7">
                {/* Micro Video Top Status */}
                <div className="flex items-center justify-between">
                  <span className="font-subheading flex items-center gap-1 rounded bg-white/10 px-1.5 py-0.5 text-[9px] font-medium text-white/70 backdrop-blur-md">
                    <span className="size-1.5 rounded-full bg-[#B3E61D] animate-pulse" />
                    Interactive Milestone 04:30
                  </span>
                  <span className="font-subheading text-[9px] text-white/40">Demo Video</span>
                </div>

                {/* Form Overlay Container */}
                <div className="my-auto rounded-lg border border-white/[0.08] bg-black/60 p-2.5 backdrop-blur-md">
                  <AnimatePresence mode="wait">
                    {!formSubmitted ? (
                      <motion.div
                        key="form"
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        className="space-y-1.5"
                      >
                        <p className="font-heading text-xs font-semibold text-white">
                          Unlock Full Product Demo
                        </p>
                        <p className="text-[10px] text-white/60">
                          Drop your work email to view pricing & book directly.
                        </p>
                        <div className="flex gap-1.5 pt-0.5">
                          <input
                            type="text"
                            readOnly
                            value="alex@acme.corp"
                            className="font-subheading h-7 w-full rounded border border-white/10 bg-white/5 px-2 text-[10px] text-white/80 focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => setFormSubmitted(true)}
                            className="font-heading flex h-7 shrink-0 items-center gap-1 rounded bg-[#B3E61D] px-2.5 text-[10px] font-bold text-neutral-950 transition hover:bg-[#a5db12]"
                          >
                            <span>Send</span>
                            <ArrowRight className="size-2.5" />
                          </button>
                        </div>
                      </motion.div>
                    ) : (
                      <motion.div
                        key="success"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="flex flex-col items-center py-1 text-center"
                      >
                        <CheckCircle2 className="size-5 text-[#B3E61D]" />
                        <p className="font-heading mt-1 text-xs font-semibold text-white">
                          Lead Dispatched
                        </p>
                        <p className="text-[10px] text-white/60">
                          Routed to HubSpot & Slack automatically
                        </p>
                        <button
                          type="button"
                          onClick={() => setFormSubmitted(false)}
                          className="font-subheading mt-1.5 text-[9px] text-[#B3E61D] hover:underline"
                        >
                          Reset Demo
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Micro timeline */}
                <div className="h-1 w-full overflow-hidden rounded-full bg-white/20">
                  <div className="h-full w-[65%] rounded-full bg-[#B3E61D]" />
                </div>
              </div>

              {/* Right Side: Step Execution Ladder */}
              <div className="flex flex-col justify-between space-y-2 sm:col-span-5">
                <div className="space-y-1.5">
                  <p className="font-subheading text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                    Lead Pipeline Automation
                  </p>

                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 rounded-lg border border-black/[0.05] bg-white p-2">
                      <div className="flex size-6 shrink-0 items-center justify-center rounded-md bg-neutral-100 text-neutral-800">
                        <MousePointerClick className="size-3" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-heading truncate text-[11px] font-semibold text-neutral-900">
                          1. Form Interaction
                        </p>
                        <p className="font-subheading text-[9px] text-neutral-400">
                          Triggered at high intent
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 rounded-lg border border-black/[0.05] bg-white p-2">
                      <div className="flex size-6 shrink-0 items-center justify-center rounded-md bg-lime-50 text-[#557506]">
                        <UserCheck className="size-3" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-heading truncate text-[11px] font-semibold text-neutral-900">
                          2. Buyer Verified
                        </p>
                        <p className="font-subheading text-[9px] text-neutral-400">
                          Company & watch-time enrich
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 rounded-lg border border-black/[0.05] bg-white p-2">
                      <div className="flex size-6 shrink-0 items-center justify-center rounded-md bg-neutral-900 text-[#B3E61D]">
                        <Webhook className="size-3" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-heading truncate text-[11px] font-semibold text-neutral-900">
                          3. Direct CRM Push
                        </p>
                        <p className="font-subheading text-[9px] text-neutral-400">
                          Webhook sync to sales
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Campaign Performance Bar */}
            <div className="mt-3.5 grid grid-cols-3 divide-x divide-neutral-200/80 border-t border-black/[0.06] pt-3">
              <div className="px-2">
                <span className="font-subheading text-[10px] text-neutral-400">
                  Total Captured
                </span>
                <p className="font-heading text-sm font-bold text-neutral-900 sm:text-base">
                  3,420 <span className="text-[10px] font-normal text-neutral-500">leads</span>
                </p>
              </div>

              <div className="px-2">
                <span className="font-subheading text-[10px] text-neutral-400">
                  Avg. Conversion
                </span>
                <div className="flex items-center gap-1">
                  <p className="font-heading text-sm font-bold text-neutral-900 sm:text-base">
                    12.8%
                  </p>
                  <TrendingUp className="size-3 text-[#557506]" />
                </div>
              </div>

              <div className="px-2">
                <span className="font-subheading text-[10px] text-neutral-400">
                  Pipeline Influenced
                </span>
                <p className="font-heading text-sm font-bold text-neutral-900 sm:text-base">
                  $48.2K
                </p>
              </div>
            </div>
          </div>
        </div>

        <CardBottomFade height="h-10" />
      </div>
    </BentoCard>
  );
}

export default FeatureCardSixth;