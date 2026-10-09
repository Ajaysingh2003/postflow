import React from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { MetricCardSkeleton } from "./MetricCard";

export function AnalyticsSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading analytics"
      className="flex h-full flex-col space-y-5 overflow-y-auto bg-background px-4 py-5 md:px-8 md:py-6"
    >
      <span className="sr-only">Loading analytics…</span>

      {/* Page heading and actions */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1.5">
          <Skeleton className="h-3 w-20 rounded" />
          <Skeleton className="h-7 w-32 rounded-md" />
          <Skeleton className="h-3.5 w-80 max-w-full rounded" />
        </div>

        {/* Action pills: status, refresh, share */}
        <div className="flex items-center gap-2">
          <Skeleton className="h-7 w-28 rounded-full" />
          <Skeleton className="h-8 w-24 rounded-lg" />
          <Skeleton className="h-8 w-20 rounded-lg" />
        </div>
      </div>

      {/* Metrics Cards Grid (7 cards) */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
        {Array.from({ length: 7 }).map((_, i) => (
          <MetricCardSkeleton key={i} />
        ))}
      </div>

      {/* Controls row: Presets + Date Range + Sort + Export */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Quick presets (desktop) */}
          <div className="hidden items-center gap-0.5 rounded-xl border-[0.5px] border-border bg-muted/50 p-0.5 sm:flex">
            <Skeleton className="h-7 w-12 rounded-[10px]" />
            <Skeleton className="h-7 w-12 rounded-[10px]" />
            <Skeleton className="h-7 w-12 rounded-[10px]" />
            <Skeleton className="h-7 w-12 rounded-[10px]" />
          </div>

          {/* Date range trigger */}
          <Skeleton className="h-8 w-44 rounded-xl" />
        </div>

        <div className="flex items-center gap-2">
          {/* Sort dropdown trigger */}
          <Skeleton className="h-8 w-32 rounded-xl" />
          {/* Export page button */}
          <Skeleton className="h-8 w-28 rounded-xl" />
        </div>
      </div>

      {/* Posts table skeleton */}
      <div className="min-h-[360px] overflow-hidden rounded-xl border-[0.5px] border-border bg-card">
        {/* Table header */}
        <div className="flex items-center justify-between border-b-[0.5px] border-border px-4 py-3">
          <Skeleton className="h-4 w-16 rounded" />
          <div className="flex items-center gap-8">
            <Skeleton className="h-4 w-14 rounded" />
            <Skeleton className="h-4 w-16 rounded" />
            <Skeleton className="h-4 w-12 rounded" />
            <Skeleton className="h-4 w-16 rounded" />
          </div>
        </div>

        {/* Table rows */}
        <div className="divide-y-[0.5px] divide-border">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between px-4 py-3.5">
              {/* Post col with thumbnail + text */}
              <div className="flex items-center gap-3">
                <Skeleton className="size-10 shrink-0 rounded-lg" />
                <div className="space-y-1.5">
                  <Skeleton className="h-3.5 w-56 sm:w-80 rounded" />
                  <Skeleton className="h-3 w-32 rounded" />
                </div>
              </div>

              {/* Numbers */}
              <div className="flex items-center gap-8">
                <Skeleton className="h-4 w-10 rounded" />
                <Skeleton className="h-4 w-12 rounded" />
                <Skeleton className="h-4 w-10 rounded" />
                <Skeleton className="h-4 w-12 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default AnalyticsSkeleton;
