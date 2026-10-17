"use client";

import React, { useState } from "react";
import Image from "next/image";
import { Caveat } from "next/font/google";
import {
  LayoutDashboard,
  Share2,
  FileText,
  Calendar,
  BarChart3,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

const hand = Caveat({ subsets: ["latin"], weight: ["500"] });

interface FeatureItem {
  id: string;
  label: string;
  image: string;
  icon: LucideIcon;
}

const items: FeatureItem[] = [
  { id: "home", label: "Dashboard", image: "home.png", icon: LayoutDashboard },
  { id: "channels", label: "Channels", image: "channels.png", icon: Share2 },
  { id: "content", label: "Content", image: "content.png", icon: FileText },
  { id: "schedule", label: "Schedule", image: "schedule.png", icon: Calendar },
  { id: "analytics", label: "Analytics", image: "analytics.png", icon: BarChart3 },
];

export default function VideoInfraIllustration({
  currentActive = 0,
}: {
  currentActive?: number;
}) {
  const [active, setActive] = useState<FeatureItem>(items[currentActive] ?? items[0]);

  return (
    <section className="relative mx-auto w-full max-w-7xl px-0 py-4 sm:px-2 sm:py-8">
      {/* App window */}
      <div className="relative overflow-hidden rounded-xl border border-black/[0.08] bg-white shadow-[0_30px_80px_-30px_rgba(17,18,14,0.22)] sm:rounded-3xl">
        <div className="relative aspect-[16/10] sm:aspect-[18/10] w-full">
          <Image
            key={active.image}
            src={`/dashboard/${active.image}`}
            alt={`${active.label} dashboard preview`}
            fill
            priority
            sizes="(max-width: 1280px) 100vw, 1280px"
            className="object-cover object-left"
            unoptimized
          />
        </div>

        {/* Bottom fade stays inside the window */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[#f9f8f4]/80 to-transparent sm:h-24" />
      </div>

      {/* Tabs: scrollable on mobile, spaced cleanly on desktop */}
      <div
        role="tablist"
        aria-label="Core features"
        className="mt-4 flex items-center gap-1.5 overflow-x-auto px-1 py-1 [scrollbar-width:none] sm:mt-5 sm:gap-2 sm:px-4 [&::-webkit-scrollbar]:hidden"
      >
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = active.id === item.id;

          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActive(item)}
              className={cn(
                "group flex shrink-0 items-center gap-2 rounded-lg px-3 py-1.5 font-heading text-[13px] font-medium transition-all duration-150 sm:text-[15px]",
                isActive
                  ? "bg-black/[0.05] text-[#11120e]"
                  : "text-[#85887e] hover:bg-black/[0.03] hover:text-[#11120e]",
              )}
            >
              <Icon
                className={cn(
                  "size-4 shrink-0 transition-colors",
                  isActive
                    ? "text-[#0f7a47]"
                    : "text-[#a3a69c] group-hover:text-[#6d7066]",
                )}
                strokeWidth={2}
                aria-hidden="true"
              />
              {item.label}
            </button>
          );
        })}
      </div>

      {/* Handwritten hint — now visible and scaled properly on mobile */}
      <div className="mt-1.5 flex items-start gap-1.5 pl-8 text-[#a3a69c] sm:mt-2 sm:gap-2 sm:pl-36">
        <svg
          className="mt-0.5 h-7 w-9 shrink-0 sm:mt-1 sm:h-9 sm:w-12"
          viewBox="0 0 48 40"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M44 36C22 36 8 28 6 6" />
          <path d="M1 12L6 5L12 11" />
        </svg>
        <span className={cn(hand.className, "pt-2.5 text-lg leading-none text-[#85887e] sm:pt-4 sm:text-xl")}>
          tap to switch between our core features
        </span>
      </div>
    </section>
  );
}