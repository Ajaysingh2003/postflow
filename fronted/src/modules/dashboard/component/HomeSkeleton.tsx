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
        <div className="grid grid-cols-1 gap-3 @xl/home:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-52 rounded-2xl" />
        <div className="grid gap-6 @3xl/home:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <div className="@container/drafts space-y-4">
            <Skeleton className="h-6 w-44" />
            <div className="grid gap-3 @sm/drafts:grid-cols-2 @lg/drafts:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-44 rounded-2xl" />
              ))}
            </div>
            <Skeleton className="h-56 rounded-2xl" />
          </div>
          <Skeleton className="h-80 rounded-2xl" />
        </div>
      </div>
    </div>
  );
}
