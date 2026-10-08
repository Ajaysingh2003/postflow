import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { Suspense } from "react";
import { getActiveWorkspaceId } from "@/lib/http-error";
import { getQueryClient, trpc } from "@/trpc/server";
import HomeView from "@/modules/dashboard/view/HomeView";
import { HOME_QUERY_OPTIONS } from "@/modules/dashboard/homeModel";
import HomeSkeleton from "@/modules/dashboard/component/HomeSkeleton";

async function PreloadedHome() {
  const workspaceId = await getActiveWorkspaceId();
  const queryClient = getQueryClient();
  await queryClient.prefetchQuery(
    trpc.studio.home.queryOptions(
      { workspace_id: workspaceId },
      HOME_QUERY_OPTIONS,
    ),
  );
  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <HomeView key={workspaceId ?? "current"} workspaceId={workspaceId} />
    </HydrationBoundary>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<HomeSkeleton />}>
      <PreloadedHome />
    </Suspense>
  );
}
