import React, { Suspense } from "react";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { getQueryClient, trpc } from "@/trpc/server";
import ChannelsView from "@/modules/channels/view/ChannelsView";
import ChannelSkeleton from "@/modules/channels/component/ChannelSkeleton";

async function PreloadedChannels() {
  const queryClient = getQueryClient();
  await queryClient.prefetchQuery(trpc.studio.accounts.queryOptions());
  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ChannelsView />
    </HydrationBoundary>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<ChannelSkeleton />}>
      <PreloadedChannels />
    </Suspense>
  );
}
