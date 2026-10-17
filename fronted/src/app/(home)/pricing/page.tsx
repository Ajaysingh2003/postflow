import React, { Suspense } from "react";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { getQueryClient, trpc } from "@/trpc/server";
import PricingView from "@/modules/home/view/PricingView";

async function PreloadedPricing() {
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
    <Suspense>
      <PreloadedPricing />
    </Suspense>
  );
}