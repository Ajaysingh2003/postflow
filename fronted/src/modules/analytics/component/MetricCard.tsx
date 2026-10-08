"use client";

import React, { useId } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowDownRight, ArrowUpRight, Minus, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type MetricCardProps = {
  label: string;
  value: string | number;
  badge?: React.ReactNode;
  hint?: string;
  color?: string; // retained for compatibility with existing analytics callers
  icon?: LucideIcon; // retained for compatibility; reference cards don't use icons
  suffix?: string;
  featured?: boolean;
  className?: string;
  index?: number;
  /** Percentage change calculated by your backend, NOT a string inferred from the value. */
  changePercent?: number | null;
  /** Actual ordered historical metric samples; omit if unavailable. */
  chartData?: readonly number[] | null;
  loading?: boolean;
};

const CARD_CLASS =
  "relative isolate flex h-[116px] min-w-0 flex-col overflow-hidden rounded-[14px] border border-[#e7ebef] bg-white text-[#12171e] " +
  "shadow-[0_1px_1px_rgba(16,24,40,0.045),0_2px_5px_rgba(16,24,40,0.025)] " +
  "transition-[border-color,box-shadow] duration-200 hover:border-[#d7dee5] hover:shadow-[0_3px_12px_rgba(16,24,40,0.06)] " +
  "dark:border-white/10 dark:bg-[#17191c] dark:text-white dark:hover:border-white/20";

function Sparkline({ data }: { data: readonly number[] }) {
  const uid = useId().replace(/:/g, "");
  const reducedMotion = useReducedMotion();
  const finite = data.every(Number.isFinite);
  if (!finite || data.length < 2) return null;

  const width = 240;
  const height = 32;
  const top = 3;
  const bottom = 3;
  const lo = Math.min(...data);
  const hi = Math.max(...data);
  const range = hi - lo;
  // Keep a level series visually level, rather than a spurious fluctuation.
  const points = data.map((v, i) => ({
    x: (i / (data.length - 1)) * width,
    y: range === 0 ? height / 2 : height - bottom - ((v - lo) / range) * (height - top - bottom),
  }));

  // Smooth quadratic curve through midpoints, with exact start/end positions.
  let line = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const midX = (prev.x + curr.x) / 2;
    const midY = (prev.y + curr.y) / 2;
    line += ` Q ${prev.x} ${prev.y} ${midX} ${midY}`;
  }
  const last = points[points.length - 1];
  line += ` T ${last.x} ${last.y}`;
  const fill = `${line} L ${width} ${height} L 0 ${height} Z`;
  const gradientId = `metric-spark-${uid}`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="h-[34px] w-full" aria-hidden="true">
      <defs>
        <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#a9b5c1" stopOpacity=".19" />
          <stop offset="100%" stopColor="#a9b5c1" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={fill} fill={`url(#${gradientId})`} />
      <motion.path
        d={line}
        fill="none"
        stroke="#b5bec8"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
        initial={reducedMotion ? false : { opacity: 0, pathLength: 0 }}
        animate={{ opacity: 1, pathLength: 1 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      />
    </svg>
  );
}

export function MetricCardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn(CARD_CLASS, "pointer-events-none", className)} role="status" aria-label="Loading metric">
      <div className="flex items-center justify-between px-[13px] pt-[13px]">
        <div className="h-[13px] w-[46%] max-w-28 animate-pulse rounded-[4px] bg-[#e9eef2] dark:bg-white/10" />
      </div>
      <div className="mt-[12px] flex items-center gap-2 px-[13px]">
        <div className="h-[22px] w-[65px] animate-pulse rounded-[5px] bg-[#e4eaf0] dark:bg-white/10" />
        <div className="h-[12px] w-[38px] animate-pulse rounded-[4px] bg-[#eef1f4] dark:bg-white/10" />
      </div>
      <svg className="absolute inset-x-[12px] bottom-[10px] h-[34px] w-[calc(100%-24px)] opacity-60" viewBox="0 0 240 34" preserveAspectRatio="none" aria-hidden="true">
        <path d="M 0 26 Q 15 29 30 25 T 60 20 T 90 24 T 120 16 T 150 20 T 180 12 T 210 17 T 240 13" fill="none" stroke="#e1e7ec" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <span className="sr-only">Loading…</span>
    </div>
  );
}

export function MetricsGridSkeleton({ count = 7, className }: { count?: number; className?: string }) {
  return (
    <div className={cn("grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5", className)} aria-label="Loading analytics metrics">
      {Array.from({ length: count }, (_, i) => <MetricCardSkeleton key={i} />)}
    </div>
  );
}

export function MetricCard({
  label, value, badge, hint, suffix, featured = false, className, index = 0,
  changePercent, chartData, loading = false,
}: MetricCardProps) {
  const reducedMotion = useReducedMotion();
  if (loading) return <MetricCardSkeleton className={className} />;

  const hasChange = changePercent !== null && changePercent !== undefined && Number.isFinite(changePercent);
  const isUp = hasChange && changePercent > 0;
  const isDown = hasChange && changePercent < 0;
  const TrendIcon = isUp ? ArrowUpRight : isDown ? ArrowDownRight : Minus;
  const hasChart = Boolean(chartData && chartData.length >= 2 && chartData.every(Number.isFinite));

  return (
    <motion.article
      initial={reducedMotion ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, delay: Math.min(index, 10) * 0.035, ease: [0.22, 1, 0.36, 1] }}
      className={cn(CARD_CLASS, className)}
      aria-label={`${label}: ${value}${suffix ? ` ${suffix}` : ""}${hasChange ? `, ${changePercent > 0 ? "up" : changePercent < 0 ? "down" : "unchanged"} ${Math.abs(changePercent)} percent` : ""}`}
      title={hint || undefined}
    >
      <div className="relative z-10 flex items-center justify-between gap-2 px-[13px] pt-[12px]">
        <span className="min-w-0 truncate text-[13.5px] font-medium leading-5 tracking-[-0.1px] text-[#607385] dark:text-[#9caab7]">{label}</span>
        {badge && <span className="inline-flex shrink-0 items-center">{badge}</span>}
      </div>
      <div className="relative z-10 mt-[5px] flex min-w-0 flex-wrap items-baseline gap-x-[7px] gap-y-[3px] px-[13px]">
        <span className={cn("min-w-0 font-semibold leading-none tracking-[-0.7px] tabular-nums", featured ? "text-[24px]" : "text-[22px]")}>{value}</span>
        {suffix && <span className="text-[12px] font-medium text-[#91a0af] dark:text-[#8c99a6]">{suffix}</span>}
        {hasChange && (
          <span className={cn("inline-flex shrink-0 items-center gap-[1px] text-[12px] font-medium tabular-nums", isUp ? "text-[#22b84b]" : isDown ? "text-[#f04452]" : "text-[#8a98a7]")}>
            <TrendIcon aria-hidden="true" className="size-[13px]" strokeWidth={2.25} />
            {Math.abs(changePercent).toLocaleString(undefined, { maximumFractionDigits: 1 })}%
          </span>
        )}
      </div>
      {hasChart ? (
        <div className="absolute inset-x-[12px] bottom-[9px] h-[34px]">
          <Sparkline data={chartData!} />
        </div>
      ) : (
        <div className="absolute inset-x-[13px] bottom-[13px]">
          <span className="block truncate text-[11px] leading-4 text-[#a0acb7] dark:text-[#8995a1]">{hint || "No trend data available"}</span>
        </div>
      )}
    </motion.article>
  );
}
