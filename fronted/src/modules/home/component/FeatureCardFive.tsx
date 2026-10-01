"use client";

import { useEffect, useState } from "react";
import { BentoCard, CardBottomFade } from "./FeatureSection";
import {
  Check,
  ChevronRight,
  CloudUpload,
  Globe2,
  Layers3,
  Loader2,
  ShieldCheck,
  Video,
} from "lucide-react";

export function FeatureCardFive() {
  const [activeStep, setActiveStep] = useState<number>(1);

  // Cycling active step animation along the 4-step pipeline
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % 4);
    }, 2000);
    return () => clearInterval(timer);
  }, []);

  return (
    <BentoCard className="min-h-[440px] overflow-hidden bg-white">
      <div className="grid grid-cols-1 lg:grid-cols-12">
        {/* Left Column: Copy & Checklist */}
        <div className="space-y-6 p-6 sm:p-8 lg:col-span-5 lg:border-r lg:border-black/[0.06]">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex size-8 items-center justify-center rounded-lg bg-neutral-100 text-neutral-700">
                <CloudUpload className="size-4" />
              </div>
              <span className="font-subheading rounded-full border border-neutral-200/90 bg-neutral-50/80 px-2.5 py-0.5 text-[11px] font-semibold tracking-wide uppercase text-neutral-500">
                fully managed
              </span>
            </div>

            <h3 className="font-heading text-xl font-bold tracking-tight text-neutral-900 sm:text-2xl">
              Video hosting &amp; transcoding
            </h3>
            <p className="text-xs leading-relaxed text-neutral-500 sm:text-sm">
              Upload once. We handle multi-rendition AV1/HLS encoding, thumbnail
              generation, DRM encryption, and global CDN asset distribution
              automatically.
            </p>
          </div>

          <div className="space-y-2.5 pt-2">
            {[
              "Direct resumable S3/NVMe uploads",
              "Multi-rendition AV1 / H.264 transcoding",
              "Sub-second HLS adaptive delivery",
              "Signed DRM playback tokens",
            ].map((feature) => (
              <div
                key={feature}
                className="flex items-center gap-2.5 text-xs font-medium text-neutral-700"
              >
                <span className="flex size-4 items-center justify-center rounded-full bg-[#B3E61D] text-neutral-950">
                  <Check className="size-2.5 stroke-[3]" />
                </span>
                <span>{feature}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: Ingest Pipeline & Library Table */}
        <div className="relative space-y-4 border-t border-black/[0.06] p-3 sm:p-8 lg:col-span-7 lg:border-t-0">
          {/* 4-Step Animated Pipeline Bar */}
          <div className="flex items-center justify-between rounded-xl border border-black/[0.06] bg-neutral-50 p-3 gap-0.5 text-xs">
            <PipelineStep
              icon={CloudUpload}
              label="Upload"
              active={activeStep >= 0}
              isCurrent={activeStep === 0}
            />
            <ChevronRight className="size-3 text-neutral-300" />
            <PipelineStep
              icon={Layers3}
              label="Transcode"
              active={activeStep >= 1}
              isCurrent={activeStep === 1}
            />
            <ChevronRight className="size-3 text-neutral-300" />
            <PipelineStep
              icon={ShieldCheck}
              label="Encrypt"
              active={activeStep >= 2}
              isCurrent={activeStep === 2}
            />
            <ChevronRight className="size-3 text-neutral-300" />
            <PipelineStep
              icon={Globe2}
              label="Deliver"
              active={activeStep >= 3}
              isCurrent={activeStep === 3}
            />
          </div>

          {/* Recent Video Library Table with live processing asset */}
          <div className="overflow-hidden rounded-xl border border-black/[0.06] bg-white shadow-2xs">
            <div className="flex items-center justify-between border-b border-neutral-100 bg-[#faf9f6] px-4 py-2.5 text-xs">
              <span className="font-heading font-bold text-neutral-900">
                Processed Video Assets
              </span>
              <span className="font-subheading text-[11px] text-neutral-400">
                142 assets · 18.4 GB
              </span>
            </div>

            <div className="divide-y divide-neutral-100">
              {/* Actively Processing Asset */}
              <div className="flex items-center justify-between px-4 py-2.5 text-xs transition-colors hover:bg-neutral-50/60">
                <div className="flex min-w-0 items-center gap-2.5">
                  <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-neutral-900 text-[#B3E61D]">
                    <Video className="size-3.5" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-heading truncate font-semibold text-neutral-900">
                      Product Keynote 2026 — Master Ingest
                    </p>
                    <p className="font-subheading text-[11px] text-neutral-400">
                      08:42 · 4K UHD
                    </p>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-3">
                  <span className="font-subheading flex items-center gap-1 rounded-full bg-lime-50 px-2 py-0.5 text-[11px] font-semibold text-[#557506]">
                    <Loader2 className="size-2.5 animate-spin" />
                    Encoding 78%
                  </span>
                </div>
              </div>

              {/* Ready Assets */}
              {[
                {
                  name: "Developer API Platform Walkthrough",
                  time: "14:18",
                  views: "8.9K",
                  quality: "1080p",
                },
                {
                  name: "Customer Onboarding Interactive Tour",
                  time: "03:15",
                  views: "4.1K",
                  quality: "1080p",
                },
              ].map((video) => (
                <div
                  key={video.name}
                  className="flex items-center justify-between px-4 py-2.5 text-xs transition-colors hover:bg-neutral-50/60"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-neutral-100 text-neutral-700">
                      <Video className="size-3.5" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-heading truncate font-semibold text-neutral-900">
                        {video.name}
                      </p>
                      <p className="font-subheading text-[11px] text-neutral-400">
                        {video.time}
                      </p>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-3">
                    <span className="hidden text-[11px] text-neutral-500 sm:inline">
                      {video.views}
                    </span>
                    <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[11px] font-semibold text-neutral-700">
                      {video.quality}
                    </span>
                    <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                      <Check className="size-2.5" />
                      Ready
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Card Bleed Fade */}
          <CardBottomFade height="h-16" />
        </div>
      </div>
    </BentoCard>
  );
}

function PipelineStep({
  icon: Icon,
  label,
  active = false,
  isCurrent = false,
}: {
  icon: React.ElementType;
  label: string;
  active?: boolean;
  isCurrent?: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <div
        className={`flex size-6 items-center justify-center rounded-md transition-all duration-300 ${
          isCurrent
            ? "scale-110 bg-[#B3E61D] text-neutral-950 shadow-xs"
            : active
            ? "bg-neutral-900 text-[#B3E61D]"
            : "bg-neutral-200 text-neutral-500"
        }`}
      >
        <Icon className="size-3" />
      </div>
      <span
        className={`font-subheading text-[11px] transition-colors ${
          isCurrent
            ? "font-heading font-bold text-neutral-950"
            : "font-semibold text-neutral-600"
        }`}
      >
        {label}
      </span>
    </div>
  );
}