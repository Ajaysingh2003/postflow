import React, { Suspense } from "react";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { getQueryClient, trpc } from "@/trpc/server";
import HomeView from "@/modules/home/view/HomeView";

async function PreloadedLanding() {
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
    <Suspense>
      <PreloadedLanding />
    </Suspense>
  );
}