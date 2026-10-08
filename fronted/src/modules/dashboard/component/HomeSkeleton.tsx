import { Skeleton } from "@/components/ui/skeleton";

export default function HomeSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading your workspace home"
      className="@container/home mx-auto max-w-7xl space-y-6 px-5 py-7 sm:px-8 lg:px-10"
    >
      <span className="sr-only">Loading your workspace home…</span>
      <div aria-hidden="true" className="space-y-6">
        <div className="flex justify-between gap-4">
          <div className="space-y-3">
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-4 w-64 max-w-full" />
          </div>
          <Skeleton className="h-9 w-24" />
        </div>
        <div className="grid grid-cols-1 gap-3 @xl/home:grid-cols-2 @3xl/home:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-40 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-52 rounded-2xl" />
        <div className="grid gap-6 @3xl/home:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <div className="@container/drafts flex flex-col gap-4 rounded-2xl border border-border/80 bg-card p-5">
            <Skeleton className="h-6 w-44" />
            <div className="grid flex-1 gap-3 @sm/drafts:grid-cols-2 @lg/drafts:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-44 rounded-2xl" />
              ))}
            </div>
          </div>
          <div className="flex flex-col rounded-2xl border border-border/80 bg-card p-5 shadow-xs">
            <div className="flex items-center gap-3">
              <Skeleton className="size-9 rounded-xl" />
              <div className="space-y-2">
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-3 w-40" />
              </div>
            </div>
            <div className="flex flex-1 flex-wrap items-center justify-center gap-6 py-6">
              <Skeleton className="size-32 shrink-0 rounded-full [mask-image:radial-gradient(circle,transparent_54%,black_55%,black_64%,transparent_65%)]" />
              <div className="flex-1 basis-28 space-y-3">
                <Skeleton className="h-8 w-20" />
                <Skeleton className="h-3 w-28" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
            <div className="flex flex-wrap justify-between gap-3 border-t border-border/70 pt-4">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-8 w-28 rounded-lg" />
            </div>
          </div>
          <Skeleton className="h-80 rounded-2xl" />
          <Skeleton className="h-80 rounded-2xl" />
          <Skeleton className="h-52 rounded-2xl" />
          <Skeleton className="h-52 rounded-2xl" />
        </div>
      </div>
    </div>
  );
}
