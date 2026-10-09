import React, { Suspense } from "react";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { getQueryClient, trpc } from "@/trpc/server";
import AnalyticsView from "@/modules/analytics/view/AnalyticsView";
import AnalyticsSkeleton from "@/modules/analytics/component/AnalyticsSkeleton";

async function PreloadedAnalytics() {
  const queryClient = getQueryClient();
  await queryClient.prefetchQuery(trpc.studio.accounts.queryOptions());
  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <AnalyticsView />
    </HydrationBoundary>
  );
}

export default function AnalyticsPage() {
  return (
    <Suspense fallback={<AnalyticsSkeleton />}>
      <PreloadedAnalytics />
    </Suspense>
  );
}