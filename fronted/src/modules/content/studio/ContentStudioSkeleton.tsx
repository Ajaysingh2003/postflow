import React from "react";
import { Skeleton } from "@/components/ui/skeleton";

export function ContentStudioSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading workspace"
      className="flex h-full min-h-0 flex-col overflow-hidden bg-background"
    >
      <span className="sr-only">Opening writing workspace…</span>

      {/* Top Header Bar */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4 sm:px-6">
        {/* Left: Account switcher / platform pill */}
        <div className="flex items-center gap-3">
          <Skeleton className="size-8 rounded-full" />
          <div className="space-y-1">
            <Skeleton className="h-3.5 w-24 rounded" />
            <Skeleton className="h-2.5 w-16 rounded" />
          </div>
          <Skeleton className="h-6 w-16 rounded-full ml-1" />
        </div>

        {/* Center: Save state indicator */}
        <div className="hidden items-center gap-2 sm:flex">
          <Skeleton className="size-2 rounded-full" />
          <Skeleton className="h-3 w-16 rounded" />
        </div>

        {/* Right: Action buttons (Your posts, Schedule, Publish) */}
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-24 rounded-lg" />
          <Skeleton className="h-8 w-20 rounded-lg" />
          <Skeleton className="h-8 w-28 rounded-lg" />
        </div>
      </header>

      {/* Main Studio Body: Editor + Preview columns */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Editor Pane (Left / Center) */}
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-6 sm:px-8 lg:px-12">
          <div className="mx-auto w-full max-w-[640px] space-y-5">
            {/* Target / Channel destination pill */}
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-16 rounded" />
              <Skeleton className="h-7 w-40 rounded-lg" />
            </div>

            {/* Composer Editor Card */}
            <div className="rounded-2xl border border-border bg-card p-4 sm:p-6 shadow-xs space-y-4">
              {/* Author header */}
              <div className="flex items-center gap-3 pb-2 border-b border-border/50">
                <Skeleton className="size-9 rounded-full" />
                <div className="space-y-1">
                  <Skeleton className="h-3.5 w-28 rounded" />
                  <Skeleton className="h-2.5 w-20 rounded" />
                </div>
              </div>

              {/* Textarea lines placeholder */}
              <div className="space-y-3 py-4 min-h-[180px]">
                <Skeleton className="h-4 w-full rounded" />
                <Skeleton className="h-4 w-11/12 rounded" />
                <Skeleton className="h-4 w-4/5 rounded" />
                <Skeleton className="h-4 w-2/3 rounded" />
              </div>

              {/* Media upload dropzone placeholder */}
              <div className="rounded-xl border border-dashed border-border/80 bg-muted/20 p-6 flex flex-col items-center justify-center gap-2">
                <Skeleton className="size-8 rounded-lg" />
                <Skeleton className="h-3 w-40 rounded" />
              </div>

              {/* Bottom editor toolbar: Icons + Char counter */}
              <div className="flex items-center justify-between pt-3 border-t border-border/60">
                <div className="flex items-center gap-2">
                  <Skeleton className="size-7 rounded-md" />
                  <Skeleton className="size-7 rounded-md" />
                  <Skeleton className="size-7 rounded-md" />
                  <Skeleton className="h-7 w-20 rounded-md" />
                </div>
                <Skeleton className="h-3 w-16 rounded" />
              </div>
            </div>

            {/* AI Assistant suggestion bar */}
            <div className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/30 p-3.5">
              <div className="flex items-center gap-2.5">
                <Skeleton className="size-4 rounded-full" />
                <Skeleton className="h-3.5 w-48 rounded" />
              </div>
              <Skeleton className="h-7 w-20 rounded-lg" />
            </div>
          </div>
        </div>

        {/* Live Preview Pane (Desktop Right) */}
        <div className="hidden w-[380px] xl:w-[420px] shrink-0 border-l border-border bg-muted/10 p-6 lg:flex lg:flex-col">
          <div className="flex items-center justify-between pb-4">
            <Skeleton className="h-4 w-24 rounded" />
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>

          {/* Social post mockup card */}
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm space-y-3">
            <div className="flex items-center gap-2.5">
              <Skeleton className="size-9 rounded-full" />
              <div className="space-y-1">
                <Skeleton className="h-3 w-24 rounded" />
                <Skeleton className="h-2.5 w-16 rounded" />
              </div>
            </div>
            <div className="space-y-2 py-2">
              <Skeleton className="h-3.5 w-full rounded" />
              <Skeleton className="h-3.5 w-5/6 rounded" />
              <Skeleton className="h-3.5 w-3/4 rounded" />
            </div>
            <Skeleton className="h-40 w-full rounded-xl" />
            <div className="flex items-center justify-between pt-2 border-t border-border/40">
              <Skeleton className="h-3 w-12 rounded" />
              <Skeleton className="h-3 w-12 rounded" />
              <Skeleton className="h-3 w-12 rounded" />
              <Skeleton className="h-3 w-12 rounded" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ContentStudioSkeleton;
