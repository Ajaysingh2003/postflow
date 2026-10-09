import React, { Suspense } from "react";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { getQueryClient, trpc } from "@/trpc/server";
import PostsView from "@/modules/dashboard/view/PostsView";
import PostsSkeleton from "@/modules/dashboard/component/PostsSkeleton";

const historyOptions = {
  staleTime: 30_000,
  refetchOnWindowFocus: false,
  retry: false,
} as const;

async function PreloadedPosts() {
  const queryClient = getQueryClient();
  await queryClient.prefetchQuery(
    trpc.studio.accounts.queryOptions(undefined, historyOptions),
  );
  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <PostsView />
    </HydrationBoundary>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<PostsSkeleton />}>
      <PreloadedPosts />
    </Suspense>
  );
}