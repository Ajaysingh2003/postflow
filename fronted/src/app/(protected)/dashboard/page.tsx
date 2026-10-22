import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getActiveWorkspaceId } from "@/lib/http-error";
import { caller, getQueryClient, trpc } from "@/trpc/server";
import HomeView from "@/modules/dashboard/view/HomeView";
import { HOME_QUERY_OPTIONS } from "@/modules/dashboard/homeModel";
import HomeSkeleton from "@/modules/dashboard/component/HomeSkeleton";
import { USAGE_QUERY_OPTIONS } from "@/modules/billing/usageModel";

async function PreloadedHome({ settings }: { settings?: string }) {
  const user = await caller.user.profile();
  if (user?.onboarding_completed_at === null && !settings) {
    // Confirm against durable state: another server may still cache the old profile.
    const setup = await caller.user.onboarding();
    if (!setup.completed_at) redirect("/onboarding");
  }
  const workspaceId = await getActiveWorkspaceId();
  const queryClient = getQueryClient();
  await Promise.all([
    queryClient.prefetchQuery(
      trpc.studio.home.queryOptions(
        { workspace_id: workspaceId },
        HOME_QUERY_OPTIONS,
      ),
    ),
    settings === "billing"
      ? queryClient.prefetchQuery(
          trpc.studio.billingUsage.queryOptions(
            { workspace_id: workspaceId },
            USAGE_QUERY_OPTIONS,
          ),
        )
      : Promise.resolve(),
  ]);
  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <HomeView key={workspaceId ?? "current"} workspaceId={workspaceId} />
    </HydrationBoundary>
  );
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ settings?: string }>;
}) {
  const { settings } = await searchParams;
  return (
    <Suspense fallback={<HomeSkeleton />}>
      <PreloadedHome settings={settings} />
    </Suspense>
  );
}
