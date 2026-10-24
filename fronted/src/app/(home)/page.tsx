import React, { Suspense } from "react";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { getQueryClient, trpc } from "@/trpc/server";
import HomeView from "@/modules/home/view/HomeView";
import { connection } from "next/server";
import { Skeleton } from "@/components/ui/skeleton";

async function PreloadedLanding() {
  await connection();
  const queryClient = getQueryClient();
  await queryClient.prefetchQuery(trpc.billing.getPlans.queryOptions());
  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <HomeView />
    </HydrationBoundary>
  );
}

export default function Page() {
  return (
    <Suspense
      fallback={
        <div
          role="status"
          aria-label="Loading Draftva"
          className="mx-auto min-h-[80svh] max-w-6xl space-y-7 px-5 pb-16 pt-36"
        >
          <Skeleton className="mx-auto h-16 w-3/4 max-w-2xl" />
          <Skeleton className="mx-auto h-16 w-1/2 max-w-xl" />
          <Skeleton className="mx-auto h-6 w-3/4 max-w-2xl" />
          <Skeleton className="mx-auto h-10 w-40" />
          <Skeleton className="mx-auto h-72 w-full rounded-2xl" />
        </div>
      }
    >
      <PreloadedLanding />
    </Suspense>
  );
}
