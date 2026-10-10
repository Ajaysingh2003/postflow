import React, { Suspense } from "react";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { getQueryClient, trpc } from "@/trpc/server";
import StatusView from "@/modules/user/view/StatusView";

async function PreloadedStatus() {
  const queryClient = getQueryClient();
  await Promise.all([
    queryClient.prefetchQuery(trpc.studio.accounts.queryOptions()),
    queryClient.prefetchQuery(trpc.workspace.current.queryOptions()),
  ]);
  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <StatusView />
    </HydrationBoundary>
  );
}

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[calc(100dvh-5rem)] w-full items-center justify-center p-8">
          <div className="h-48 w-full max-w-md rounded-2xl bg-muted/40 animate-pulse" />
        </div>
      }
    >
      <PreloadedStatus />
    </Suspense>
  );
}