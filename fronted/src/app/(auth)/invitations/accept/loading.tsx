import { Skeleton } from "@/components/ui/skeleton";
export default function Loading() {
  return (
    <div
      aria-label="Loading invitation"
      className="mx-auto my-20 w-full max-w-md space-y-5 rounded-2xl border p-8"
    >
      <Skeleton className="h-8 w-32" />
      <Skeleton className="h-12 w-12 rounded-2xl" />
      <Skeleton className="h-9 w-3/4" />
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-11 w-full" />
    </div>
  );
}
