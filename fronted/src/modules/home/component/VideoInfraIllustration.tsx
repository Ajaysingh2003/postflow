"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  Activity,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  HardDrive,
  Home,
  Layers,
  Lock,
  Sliders,
  Star,
  Tv,
  Upload,
  UserCheck,
  Video,
  Zap,
} from "lucide-react";

const VIRTUAL_WIDTH = 1024;
const VIRTUAL_HEIGHT = 680;

export default function VideoInfraDashboard() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [isScaled, setIsScaled] = useState(false);

  useEffect(() => {
    const updateDimensions = () => {
      if (!containerRef.current) return;
      const currentWidth = containerRef.current.offsetWidth;

      // Only scale down if viewport is narrower than 1024px
      if (currentWidth < VIRTUAL_WIDTH) {
        setScale(currentWidth / VIRTUAL_WIDTH);
        setIsScaled(true);
      } else {
        setScale(1);
        setIsScaled(false);
      }
    };

    updateDimensions();
    const observer = new ResizeObserver(updateDimensions);
    if (containerRef.current) observer.observe(containerRef.current);

    return () => observer.disconnect();
  }, []);


  return (
    <div
      ref={containerRef}
      className="relative w-full overflow-hidden rounded-2xl sm:rounded-3xl border border-black/[0.08] bg-white shadow-[25px_0_20px_-20px_#00000040,-25px_0_20px_-20px_rgba(0,0,0,0.25)]   select-none"
      style={{
        // Locks proportionate height only when scaled down on smaller screens
        height: isScaled ? `${VIRTUAL_HEIGHT * scale}px` : "auto",
      }}
    >
      {/* 
        Container switches between:
        1. Exact fixed 1024px canvas that scales down via CSS transform on mobile/tablet.
        2. 100% fluid responsive width on desktop screens (>1024px).
      */}
      <div
        className="origin-top-left  transition-transform duration-75 ease-out"
        style={{
          transform: isScaled ? `scale(${scale})` : "none",
          width: isScaled ? `${VIRTUAL_WIDTH}px` : "100%",
          minHeight: `${VIRTUAL_HEIGHT}px`,
        }}
      >
        {/* ── Dashboard App Header Bar ── */}
        <div className="flex h-13 w-full items-center justify-between border-b border-black/[0.06] bg-[#faf9f6] px-6">
          <div className="flex items-center gap-3">
            <div className="flex size-7.5 items-center justify-center rounded-xl bg-[#B3E61D] text-xs font-bold text-[#141b02] shadow-xs">
              V
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="font-heading font-semibold text-neutral-900 text-sm">
                Video Cloud
              </span>
              <span className="text-neutral-400">/</span>
              <span className="font-subheading text-neutral-500 text-xs">
                Production-Anycast
              </span>
            </div>
            <span className="font-subheading inline-flex items-center gap-1.5 rounded-full border border-emerald-200/60 bg-emerald-50 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-700">
              <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Global Mesh Healthy
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              className="font-subheading inline-flex items-center gap-1.5  border border-black/[0.08] bg-white px-3.5 py-1.5 text-xs font-semibold text-neutral-700 shadow-2xs hover:bg-neutral-50 !min-h-8 active:scale-95 transition-all cursor-pointer secondary-btn rounded-md"
            >
              <span>Import Asset</span>
            </button>
            <button
              type="button"
              className="font-heading rounded-lg inline-flex items-center gap-1.5  bg-neutral-900 px-4 py-1.5z text-xs !min-h-8 font-semibold text-white shadow-xs hover:bg-neutral-800 active:scale-95 transition-all cursor-pointer primary-btn"
            >
              <Upload className="size-3.5" />
              <span>Upload Video</span>
            </button>
          </div>
        </div>

        {/* ── Dashboard Body Canvas ── */}
        <div className="flex min-h-[calc(680px-52px)] w-full  text-neutral-800">
          {/* Left Console Navigation Sidebar */}
          <aside className="flex w-[215px] shrink-0 flex-col justify-between border-r border-black/[0.06] bg-[#f8f8f5] p-3.5">
            <div className="space-y-4">
              <div className="space-y-1">
                <p className="font-subheading px-2.5 text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                  Workspace
                </p>
                <nav className="space-y-0.5 text-xs">
                  <SidebarItem icon={Home} label="Overview" active />
                  <SidebarItem icon={Layers} label="Content Library" />
                  <SidebarItem icon={Video} label="Videos" badge="142" />
                  <SidebarItem icon={Tv} label="Channels" />
                  <SidebarItem icon={Activity} label="Telemetry" />
                </nav>
              </div>

              <div className="space-y-1">
                <p className="font-subheading px-2.5 text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                  Configure
                </p>
                <nav className="space-y-0.5 text-xs">
                  <SidebarItem icon={Sliders} label="Player Themes" />
                  <SidebarItem icon={Lock} label="Security & DRM" />
                  <SidebarItem icon={Star} label="Saved Filters" />
                </nav>
              </div>
            </div>

            {/* Sidebar Account & Resource Footer */}
            <div className="space-y-3 border-t border-black/[0.06] pt-3">
              <div className="space-y-2 rounded-xl border border-black/[0.06] bg-white p-3 shadow-2xs">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 font-medium text-neutral-700">
                    <HardDrive className="size-3.5 text-neutral-500" />
                    Storage
                  </span>
                  <span className="font-subheading text-[10px] font-bold text-neutral-600">
                    36.8%
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-100">
                  <div className="h-full w-[36.8%] rounded-full bg-[#B3E61D]" />
                </div>
                <div className="flex items-center justify-between text-[10px] text-neutral-500">
                  <span>18.4 GB / 50 GB</span>
                  <span className="font-heading font-semibold text-neutral-900 cursor-pointer hover:underline">
                    Upgrade
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2.5 px-1.5 text-xs">
                <div className="flex size-7 items-center justify-center rounded-full bg-neutral-900 font-heading text-[11px] font-bold text-white">
                  AS
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-heading truncate font-semibold text-neutral-900 leading-tight">
                    Ajay Singh
                  </p>
                  <p className="font-subheading truncate text-[10px] text-neutral-400 mt-0.5">
                    Pro Infrastructure Plan
                  </p>
                </div>
              </div>
            </div>
          </aside>

          {/* Core Content Area - Fully Fluid 100% Flex */}
          <main className="flex-1 w-full space-y-4 p-5 overflow-hidden">
            {/* Top Stat Row Header */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-heading text-base font-bold tracking-tight text-neutral-900">
                  Streaming Telemetry &amp; Resource Usage
                </h2>
                <p className="text-xs text-neutral-500 mt-0.5">
                  Real-time multi-bitrate delivery throughput across edge PoPs
                </p>
              </div>
              <span className="font-subheading inline-flex items-center gap-1.5 text-xs text-neutral-400">
                <Clock className="size-3.5 text-neutral-400" />
                <span>Synchronized real-time</span>
              </span>
            </div>

            {/* ── Row 1: Primary Metrics (Fluid Grid) ── */}
            <div className="grid grid-cols-3 gap-3.5 w-full">
              {/* Storage Capacity */}
              <div className="flex h-36 flex-col justify-between rounded-xl border border-black/[0.06] bg-white p-4 shadow-2xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex size-7 items-center justify-center rounded-lg bg-neutral-100 text-neutral-700">
                      <HardDrive className="size-3.5" />
                    </div>
                    <div>
                      <h3 className="font-heading text-xs font-bold text-neutral-900">
                        Ingest Storage
                      </h3>
                      <p className="font-subheading text-[10px] text-neutral-400">
                        Resumable NVMe
                      </p>
                    </div>
                  </div>
                  <span className="font-subheading rounded-md bg-neutral-100 px-1.5 py-0.5 text-[10px] font-semibold text-neutral-700">
                    50 GB Tier
                  </span>
                </div>

                <div className="flex items-baseline justify-between">
                  <div>
                    <span className="font-heading text-2xl font-bold tracking-tight text-neutral-900">
                      18.4
                    </span>
                    <span className="ml-1 text-xs font-semibold text-neutral-500">
                      GB
                    </span>
                  </div>
                  <span className="font-subheading text-xs font-semibold text-neutral-500">
                    36.8% consumed
                  </span>
                </div>

                <div className="space-y-1">
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-100">
                    <div className="h-full w-[36.8%] rounded-full bg-[#B3E61D]" />
                  </div>
                  <div className="font-subheading flex items-center justify-between text-[10px] text-neutral-400">
                    <span>Used: 18.4 GB</span>
                    <span>Remaining: 31.6 GB</span>
                  </div>
                </div>
              </div>

              {/* Bandwidth Throughput */}
              <div className="flex h-36 flex-col justify-between rounded-xl border border-black/[0.06] bg-white p-4 shadow-2xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex size-7 items-center justify-center rounded-lg bg-lime-50 text-[#547306]">
                      <Zap className="size-3.5" />
                    </div>
                    <div>
                      <h3 className="font-heading text-xs font-bold text-neutral-900">
                        Monthly Egress
                      </h3>
                      <p className="font-subheading text-[10px] text-neutral-400">
                        Active Billing Period
                      </p>
                    </div>
                  </div>
                  <span className="font-subheading flex items-center gap-0.5 rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                    <ArrowUpRight className="size-3" />
                    +12.4%
                  </span>
                </div>

                <div className="flex items-baseline justify-between">
                  <div>
                    <span className="font-heading text-2xl font-bold tracking-tight text-neutral-900">
                      1.42
                    </span>
                    <span className="ml-1 text-xs font-semibold text-neutral-500">
                      TB
                    </span>
                  </div>
                  <span className="font-subheading text-xs font-semibold text-neutral-500">
                    Allocation: 5.0 TB
                  </span>
                </div>

                {/* Micro Histogram */}
                <div className="flex h-6 items-end justify-between gap-1">
                  {[28, 42, 35, 55, 48, 65, 58, 72, 84, 68, 76, 92].map(
                    (val, idx) => (
                      <div key={idx} className="flex-1 h-full flex items-end">
                        <div
                          style={{ height: `${val}%` }}
                          className={`w-full rounded-xs transition-colors ${
                            idx >= 9 ? "bg-[#B3E61D]" : "bg-neutral-200"
                          }`}
                        />
                      </div>
                    ),
                  )}
                </div>
              </div>

              {/* Viewership Plays & Sparkline */}
              <div className="flex h-36 flex-col justify-between rounded-xl border border-black/[0.06] bg-white p-4 shadow-2xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex size-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                      <Activity className="size-3.5" />
                    </div>
                    <div>
                      <h3 className="font-heading text-xs font-bold text-neutral-900">
                        Audience Plays
                      </h3>
                      <p className="font-subheading text-[10px] text-neutral-400">
                        Trailing 28 Days
                      </p>
                    </div>
                  </div>
                  <span className="font-subheading flex items-center gap-0.5 rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                    <ArrowUpRight className="size-3" />
                    +14.8%
                  </span>
                </div>

                <div className="flex items-baseline justify-between">
                  <div>
                    <span className="font-heading text-2xl font-bold tracking-tight text-neutral-900">
                      48,250
                    </span>
                    <span className="ml-1 text-xs text-neutral-400">starts</span>
                  </div>
                  <span className="font-subheading text-[10px] font-medium text-emerald-600">
                    99.8% buffer-free
                  </span>
                </div>

                {/* SVG Area Vector */}
                <div className="h-7 w-full relative">
                  <svg
                    viewBox="0 0 160 36"
                    fill="none"
                    className="size-full overflow-visible"
                    preserveAspectRatio="none"
                  >
                    <defs>
                      <linearGradient
                        id="infraViewsGradFluid"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop offset="0%" stopColor="#10b981" stopOpacity="0.3" />
                        <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    <path
                      d="M0 26 Q 20 28, 40 22 T 80 18 T 120 10 T 160 3 L 160 36 L 0 36 Z"
                      fill="url(#infraViewsGradFluid)"
                    />
                    <path
                      d="M0 26 Q 20 28, 40 22 T 80 18 T 120 10 T 160 3"
                      stroke="#10b981"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                </div>
              </div>
            </div>

            {/* ── Row 2: In-Video Interactive Leads & Cloud Transcoder ── */}
            <div className="grid grid-cols-2 gap-3.5 w-full">
              {/* Lead Capture Module */}
              <div className="flex items-center justify-between rounded-xl border border-black/[0.06] bg-white p-3.5 shadow-2xs">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="flex size-6.5 items-center justify-center rounded-lg bg-neutral-100 text-neutral-700">
                      <UserCheck className="size-3.5" />
                    </div>
                    <span className="font-heading text-xs font-bold text-neutral-900">
                      Lead Capture In-Player Overlays
                    </span>
                  </div>
                  <div className="mt-2 flex items-baseline gap-1.5">
                    <span className="font-heading text-xl font-bold text-neutral-900">
                      1,284
                    </span>
                    <span className="text-[10px] text-neutral-400">
                      synced conversions
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="font-subheading rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700">
                    8.2% Conv. Rate
                  </span>
                  <p className="font-subheading mt-1 text-[10px] text-neutral-400">
                    12 Forms Dispatched
                  </p>
                </div>
              </div>

              {/* Distributed Encoding Workers */}
              <div className="flex items-center justify-between rounded-xl border border-black/[0.06] bg-white p-3.5 shadow-2xs">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="flex size-6.5 items-center justify-center rounded-lg bg-neutral-100 text-neutral-700">
                      <Video className="size-3.5" />
                    </div>
                    <span className="font-heading text-xs font-bold text-neutral-900">
                      Adaptive HLS Transcode Engine
                    </span>
                  </div>
                  <div className="mt-2 flex items-baseline gap-1.5">
                    <span className="font-heading text-xl font-bold text-neutral-900">
                      142
                    </span>
                    <span className="text-[10px] text-neutral-400">
                      master assets active
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="font-subheading rounded-md bg-neutral-100 px-2 py-0.5 text-xs font-bold text-neutral-800">
                    4K UHD / 60 FPS
                  </span>
                  <p className="font-subheading mt-1 flex items-center justify-end gap-1 text-[10px] text-emerald-600 font-semibold">
                    <CheckCircle2 className="size-3" />
                    Queue: 0 idle workers
                  </p>
                </div>
              </div>
            </div>

            {/* ── Row 3: Active Video Asset Registry (Fully Stretches) ── */}
            <div className="overflow-hidden rounded-xl border border-black/[0.06] bg-white shadow-2xs w-full">
              <div className="flex items-center justify-between border-b border-black/[0.05] bg-[#faf9f6] px-4 py-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-heading font-bold text-neutral-900">
                    Active Video Assets
                  </span>
                  <span className="font-subheading rounded-full bg-neutral-200 px-1.5 py-0.2 text-[10px] font-bold text-neutral-700">
                    142
                  </span>
                </div>
                <span className="font-subheading text-[10px] text-neutral-400">
                  Storage Allocation: 18.4 GB Used
                </span>
              </div>

              <div className="divide-y divide-neutral-100 text-xs w-full">
                {[
                  {
                    name: "Product Keynote 2026 — Master Ingest",
                    duration: "08:42",
                    renditions: ["4K", "1080p", "720p"],
                    views: "14,240 plays",
                    bandwidth: "420 GB",
                    status: "Ready",
                  },
                  {
                    name: "Developer API Platform Walkthrough",
                    duration: "14:18",
                    renditions: ["1080p", "720p", "480p"],
                    views: "8,920 plays",
                    bandwidth: "185 GB",
                    status: "Ready",
                  },
                ].map((video, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between px-4 py-2.5 hover:bg-neutral-50/70 transition-colors w-full"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-neutral-900 text-white">
                        <Video className="size-3.5 text-[#B3E61D]" />
                      </div>
                      <div className="min-w-0">
                        <span className="font-heading truncate font-semibold text-neutral-900 block leading-tight">
                          {video.name}
                        </span>
                        <span className="font-subheading text-[10px] text-neutral-400 mt-0.5 block">
                          {video.duration} · Encoded with AES-128 DRM
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3.5 shrink-0 text-[10px]">
                      <div className="flex gap-1">
                        {video.renditions.map((r) => (
                          <span
                            key={r}
                            className="font-subheading rounded bg-neutral-100 px-1.5 py-0.5 text-neutral-600 font-semibold"
                          >
                            {r}
                          </span>
                        ))}
                      </div>
                      <span className="font-heading font-semibold text-neutral-800">
                        {video.views}
                      </span>
                      <span className="font-subheading rounded-full border border-emerald-200/50 bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700">
                        {video.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

function SidebarItem({
  icon: Icon,
  label,
  active = false,
  badge,
}: {
  icon: React.ElementType;
  label: string;
  active?: boolean;
  badge?: string;
}) {
  return (
    <div
      className={`flex items-center justify-between rounded-lg px-2.5 py-1.5 transition-all cursor-pointer ${
        active
          ? "secondary-btn !min-h-7 rounded-md w-full font-heading font-bold text-neutral-950 shadow-2xs"
          : "text-neutral-600 hover:bg-black/[0.04] hover:text-neutral-900"
      }`}
    >
      <div className="flex items-center gap-2 min-w-0">
        <Icon
          className={`size-3.5 shrink-0 ${
            active ? "text-neutral-950" : "text-neutral-400"
          }`}
        />
        <span className="truncate text-xs">{label}</span>
      </div>

      {badge && (
        <span
          className={`font-subheading rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
            active ? "bg-black/15 text-neutral-950" : "bg-neutral-200 text-neutral-700"
          }`}
        >
          {badge}
        </span>
      )}
    </div>
  );
}