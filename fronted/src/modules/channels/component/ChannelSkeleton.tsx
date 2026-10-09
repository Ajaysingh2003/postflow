import { Skeleton } from "@/components/ui/skeleton";
import { ShieldCheck } from "lucide-react";

export function ChannelSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading channels"
      className="mx-auto max-w-[1240px] px-5 py-8 sm:px-8 lg:px-10 lg:py-10"
    >
      <span className="sr-only">Loading channels…</span>

      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-5">
        <div className="space-y-2">
          <Skeleton className="h-10 w-64 rounded-xl sm:h-12 sm:w-80" />
          <Skeleton className="h-4 w-80 max-w-full rounded-md sm:w-96" />
        </div>
        <Skeleton className="h-10 w-36 rounded-xl" />
      </header>

      {/* Toolbar */}
      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        {/* Segmented filter pills */}
        <div className="flex items-center gap-1 rounded-lg border-[0.5px] border-neutral-200 bg-neutral-100/80 p-0.5 dark:border-white/10 dark:bg-white/[0.04]">
          <Skeleton className="h-8 w-24 rounded-md" />
          <Skeleton className="h-8 w-24 rounded-md" />
          <Skeleton className="h-8 w-28 rounded-md" />
        </div>

        {/* Search & Refresh */}
        <div className="flex w-full items-center gap-2 sm:w-auto">
          <Skeleton className="h-9 w-full rounded-lg sm:w-60" />
          <Skeleton className="size-9 shrink-0 rounded-lg" />
        </div>
      </div>

      {/* Channels Cards Grid */}
      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="flex flex-col overflow-hidden rounded-2xl border-[0.5px] border-neutral-200 bg-white shadow-xs dark:border-white/10 dark:bg-white/[0.025]"
          >
            {/* Card Body */}
            <div className="flex flex-1 flex-col p-5">
              <div className="flex items-start justify-between gap-3">
                <Skeleton className="size-12 rounded-2xl" />
                <Skeleton className="h-5 w-20 rounded-full" />
              </div>

              <Skeleton className="mt-4 h-5 w-28 rounded-md" />
              <div className="mt-2 min-h-[3.5rem] space-y-1.5">
                <Skeleton className="h-3.5 w-full rounded" />
                <Skeleton className="h-3.5 w-4/5 rounded" />
              </div>

              {/* Feature tags */}
              <div className="mt-3.5 flex flex-wrap gap-1.5">
                <Skeleton className="h-5 w-16 rounded-md" />
                <Skeleton className="h-5 w-20 rounded-md" />
                <Skeleton className="h-5 w-14 rounded-md" />
              </div>
            </div>

            {/* Card Footer */}
            <div className="flex min-h-14 items-center justify-between gap-3 border-t-[0.5px] border-neutral-200 bg-neutral-50/50 px-5 py-3 dark:border-white/10 dark:bg-white/[0.01]">
              <Skeleton className="h-4 w-28 rounded" />
              <Skeleton className="h-5 w-9 rounded-full" />
            </div>
          </div>
        ))}
      </div>

      {/* Footer security note */}
      <div className="mt-7 flex items-center justify-center gap-2 text-muted-foreground/60">
        <ShieldCheck className="size-3.5 shrink-0" />
        <Skeleton className="h-3 w-72 rounded" />
      </div>
    </div>
  );
}

export default ChannelSkeleton;
