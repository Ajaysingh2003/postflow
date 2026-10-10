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

export default function VideoInfraIllustration() {
  const [active, setActive] = useState<FeatureItem>(items[0]);

  return (
    <section className="relative mx-auto w-full max-w-7xl px-0 zpy-8 sm:px-2">
      {/* App window */}
      <div className="relative overflow-hidden rounded-2xl border border-black/[0.06] bg-white shadow-[0_30px_80px_-30px_rgba(17,18,14,0.25)] sm:rounded-3xl">
        <div className="relative aspect-[18/10] w-full">
          <Image
            key={active.image}
            src={`/dashboard/${active.image}`}
            alt={`${active.label} dashboard preview`}
            fill
            priority
            sizes="(max-width: 1280px) 100vw, 1280px"
            className="object-cover object-top"
            unoptimized
          />
        </div>

        {/* Bottom fade stays inside the window */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[#f9f8f4]/80 to-transparent sm:h-24" />
      </div>

      {/* Tabs: fully below the image, no overlap */}
      <div
        role="tablist"
        aria-label="Core features"
        className="mt-5 flex items-center zgap-1 overflow-x-auto  [scrollbar-width:none] sm:gap-3 sm:px-4 [&::-webkit-scrollbar]:hidden"
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
                "group flex shrink-0 hover:bg-[#a6a6a622] items-center gap-2 rounded-lg px-1.5 py-1 font-heading text-[13px] font-medium transition-colors duration-150 sm:text-base",
                isActive
                  ? "text-[#11120e]"
                  : "text-[#85887e] hover:text-[#11120e]",
              )}
            >
              <Icon
                className={cn(
                  "size-4 transition-colors sm:size-[14px]",
                  isActive
                    ? "text-green-500"
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

      {/* Handwritten hint */}
      <div className="mt-2 hidden items-start gap-2 pl-24 text-[#a3a69c] sm:flex sm:pl-32">
        <svg
          className="mt-1 h-9 w-12 shrink-0"
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
        <span className={cn(hand.className, "pt-4 text-xl text-[#85887e]")}>
          click to switch between our core features
        </span>
      </div>
    </section>
  );
}