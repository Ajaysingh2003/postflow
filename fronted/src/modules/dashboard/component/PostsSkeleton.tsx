import React from "react";
import { Skeleton } from "@/components/ui/skeleton";

export function PostsSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading posts"
      className="mx-auto max-w-6xl space-y-6 p-5 sm:p-8"
    >
      <span className="sr-only">Loading posts…</span>

      {/* Header */}
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <Skeleton className="h-3 w-32 rounded uppercase tracking-wider" />
          <Skeleton className="h-8 w-28 rounded-md" />
          <Skeleton className="h-4 w-72 rounded text-muted-foreground" />
        </div>
        <Skeleton className="h-9 w-28 rounded-xl" />
      </header>

      {/* Category Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex max-w-full gap-1 overflow-x-auto rounded-xl bg-muted/60 p-1">
          <Skeleton className="h-8 w-24 rounded-lg" />
          <Skeleton className="h-8 w-24 rounded-lg" />
          <Skeleton className="h-8 w-20 rounded-lg" />
        </div>
      </div>

      {/* Overview Cards (Published, Scheduled, Drafts) */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="rounded-2xl border border-border bg-card p-3 sm:p-4"
          >
            <div className="flex items-center justify-between">
              <Skeleton className="size-8 rounded-lg" />
              <Skeleton className="size-4 rounded" />
            </div>
            <Skeleton className="mt-3 h-7 w-12 rounded" />
            <Skeleton className="mt-1 h-3.5 w-20 rounded" />
            <Skeleton className="mt-1 hidden h-3 w-32 rounded sm:block" />
          </div>
        ))}
      </div>

      {/* Toolbar: Title + Search + Refresh */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <Skeleton className="h-5 w-28 rounded" />
          <Skeleton className="h-3.5 w-56 rounded" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-44 rounded-lg sm:w-52" />
          <Skeleton className="size-9 rounded-lg" />
        </div>
      </div>

      {/* Post cards list */}
      <div className="space-y-3">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="rounded-2xl border border-border bg-card p-5"
          >
            {/* Header: Platform Mark, Account Name, Status Badge */}
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Skeleton className="size-5 rounded-full" />
                <Skeleton className="h-3.5 w-28 rounded" />
              </div>
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>

            {/* Post text preview */}
            <div className="space-y-2 py-1">
              <Skeleton className="h-4 w-full rounded" />
              <Skeleton className="h-4 w-5/6 rounded" />
              <Skeleton className="h-4 w-3/5 rounded" />
            </div>

            {/* Footer: Date, Media badge, View action */}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-3">
              <Skeleton className="h-3.5 w-32 rounded" />
              <div className="flex items-center gap-2">
                <Skeleton className="h-3.5 w-20 rounded" />
                <Skeleton className="size-3.5 rounded" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default PostsSkeleton;
