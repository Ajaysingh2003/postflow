import React, { Suspense } from "react";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { getQueryClient, trpc } from "@/trpc/server";
import ContentStudio from "@/modules/content/studio/ContentStudio";
import ContentStudioSkeleton from "@/modules/content/studio/ContentStudioSkeleton";

async function PreloadedContent() {
  const queryClient = getQueryClient();
  await Promise.all([
    queryClient.prefetchQuery(trpc.workspace.current.queryOptions()),
    queryClient.prefetchQuery(trpc.studio.accounts.queryOptions()),
  ]);
  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ContentStudio />
    </HydrationBoundary>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<ContentStudioSkeleton />}>
      <PreloadedContent />
    </Suspense>
  );
}
