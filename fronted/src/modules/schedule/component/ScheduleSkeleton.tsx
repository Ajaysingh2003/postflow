import React from "react";
import { Skeleton } from "@/components/ui/skeleton";

export function ScheduleSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading schedule"
      className="flex h-full min-h-0 flex-col font-content bg-background"
    >
      <span className="sr-only">Loading schedule…</span>

      {/* Header */}
      <header className="shrink-0 border-b border-border/60">
        <div className="flex items-center justify-between gap-3 px-4 pt-4 sm:px-6">
          <div className="min-w-0 space-y-1">
            <Skeleton className="h-6 w-28 rounded-md" />
            <Skeleton className="h-3.5 w-72 max-w-full rounded hidden sm:block" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-9 w-28 rounded-xl" />
            <Skeleton className="h-9 w-24 rounded-xl" />
          </div>
        </div>

        {/* Command bar */}
        <div className="flex flex-wrap items-center gap-2 px-4 py-3 sm:px-6">
          {/* Today + Nav Arrows */}
          <div className="inline-flex items-center rounded-lg border border-border/60 bg-background p-0.5">
            <Skeleton className="h-7 w-12 rounded-md" />
            <span className="mx-0.5 h-4 w-px bg-border/60" />
            <Skeleton className="size-7 rounded-md" />
            <Skeleton className="size-7 rounded-md" />
          </div>

          {/* Date jump */}
          <Skeleton className="h-8 w-36 rounded-lg" />

          {/* View switcher */}
          <div className="ml-auto inline-flex items-center rounded-lg border border-border/60 bg-background p-0.5">
            <Skeleton className="h-7 w-12 rounded-md" />
            <Skeleton className="h-7 w-14 rounded-md" />
            <Skeleton className="h-7 w-14 rounded-md" />
          </div>

          <span className="hidden h-5 w-px bg-border/60 md:block" />

          {/* Filter pills */}
          <Skeleton className="h-8 w-32 rounded-full" />
          <Skeleton className="h-8 w-28 rounded-full" />
        </div>
      </header>

      {/* Week Calendar Grid */}
      <div className="min-h-0 flex-1 overflow-hidden">
        <div className="min-w-[840px] h-full flex flex-col">
          {/* Day header columns */}
          <div
            className="sticky top-0 z-30 grid border-b border-border/40 bg-background/90 backdrop-blur-md"
            style={{ gridTemplateColumns: "64px repeat(7, minmax(0, 1fr))" }}
          >
            <span className="flex items-end justify-center pb-3">
              <Skeleton className="h-3 w-8 rounded" />
            </span>
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
              <div
                key={day}
                className="flex flex-col items-center gap-1 border-l border-border/40 py-2.5"
              >
                <Skeleton className="h-3 w-7 rounded" />
                <Skeleton className="size-7 rounded-full" />
              </div>
            ))}
          </div>

          {/* 24-Hour time grid slots */}
          <div
            className="grid flex-1 overflow-hidden"
            style={{ gridTemplateColumns: "64px repeat(7, minmax(0, 1fr))" }}
          >
            {/* Time labels column */}
            <div className="relative border-r border-border/40">
              {Array.from({ length: 9 }).map((_, hour) => (
                <div
                  key={hour}
                  className="h-[84px] pr-3 pt-1 text-right"
                >
                  <Skeleton className="ml-auto h-3 w-8 rounded" />
                </div>
              ))}
            </div>

            {/* 7 Columns with placeholder cards */}
            {Array.from({ length: 7 }).map((_, colIdx) => (
              <div
                key={colIdx}
                className="relative border-r border-border/20 last:border-r-0"
                style={{
                  backgroundImage: `repeating-linear-gradient(to bottom, color-mix(in srgb, var(--border) 55%, transparent) 0 1px, transparent 1px 84px), repeating-linear-gradient(to bottom, transparent 0 42px, color-mix(in srgb, var(--border) 22%, transparent) 42px 43px, transparent 43px 84px)`,
                }}
              >
                {colIdx === 1 && (
                  <div
                    className="absolute left-1 right-1 rounded-xl border border-border/70 bg-card/80 p-2.5 shadow-xs"
                    style={{ top: 90, height: 74 }}
                  >
                    <div className="flex items-center gap-1.5">
                      <Skeleton className="size-3.5 rounded-full" />
                      <Skeleton className="h-3 w-12 rounded" />
                    </div>
                    <Skeleton className="mt-2 h-3.5 w-3/4 rounded" />
                  </div>
                )}
                {colIdx === 3 && (
                  <div
                    className="absolute left-1 right-1 rounded-xl border border-border/70 bg-card/80 p-2.5 shadow-xs"
                    style={{ top: 220, height: 74 }}
                  >
                    <div className="flex items-center gap-1.5">
                      <Skeleton className="size-3.5 rounded-full" />
                      <Skeleton className="h-3 w-12 rounded" />
                    </div>
                    <Skeleton className="mt-2 h-3.5 w-4/5 rounded" />
                  </div>
                )}
                {colIdx === 4 && (
                  <div
                    className="absolute left-1 right-1 rounded-xl border border-border/70 bg-card/80 p-2.5 shadow-xs"
                    style={{ top: 140, height: 74 }}
                  >
                    <div className="flex items-center gap-1.5">
                      <Skeleton className="size-3.5 rounded-full" />
                      <Skeleton className="h-3 w-12 rounded" />
                    </div>
                    <Skeleton className="mt-2 h-3.5 w-2/3 rounded" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ScheduleSkeleton;
