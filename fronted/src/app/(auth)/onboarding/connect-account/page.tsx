import React, { Suspense } from "react";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { getQueryClient, trpc } from "@/trpc/server";
import ConnectAccountView from "@/modules/user/view/ConnectAccountView";

async function PreloadedConnectAccount() {
  const queryClient = getQueryClient();
  await queryClient.prefetchQuery(trpc.user.me.queryOptions());
  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ConnectAccountView />
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
      <PreloadedConnectAccount />
    </Suspense>
  );
}