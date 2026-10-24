import React, { Suspense } from "react";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { getQueryClient, trpc } from "@/trpc/server";
import PricingView from "@/modules/home/view/PricingView";
import { connection } from "next/server";
import { PricingSkeleton } from "@/modules/billing/component/PricingCardSection";
import { Skeleton } from "@/components/ui/skeleton";

async function PreloadedPricing() {
  await connection();
  const queryClient = getQueryClient();
  await queryClient.prefetchQuery(trpc.billing.getPlans.queryOptions());
  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <PricingView />
    </HydrationBoundary>
  );
}

export default function Page() {
  return (
    <Suspense
      fallback={
        <div
          role="status"
          aria-label="Loading pricing"
          className="mx-auto max-w-6xl space-y-8 px-5 pb-16 pt-32"
        >
          <Skeleton className="mx-auto h-10 w-2/3 max-w-lg" />
          <Skeleton className="mx-auto h-5 w-3/4 max-w-xl" />
          <Skeleton className="mx-auto h-10 w-64" />
          <PricingSkeleton />
        </div>
      }
    >
      <PreloadedPricing />
    </Suspense>
  );
}
