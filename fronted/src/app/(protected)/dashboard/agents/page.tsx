import { Suspense } from "react";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { getQueryClient, trpc } from "@/trpc/server";
import AgentsPage from "@/modules/agents/AgentsPage";

function AgentsSkeleton() {
  return (
    <div className="p-8 space-y-4">
      <div className="h-8 w-48 rounded-lg bg-muted/60 animate-pulse" />
      <div className="h-4 w-72 rounded-lg bg-muted/40 animate-pulse" />
    </div>
  );
}

export default async function Page() {
  const queryClient = getQueryClient();
  const workspace = await queryClient.fetchQuery(
    trpc.workspace.current.queryOptions(),
  );
  await queryClient.prefetchQuery(
    trpc.agents.settings.queryOptions({ workspace_id: workspace.id }),
  );
  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <Suspense fallback={<AgentsSkeleton />}>
        <AgentsPage />
      </Suspense>
    </HydrationBoundary>
  );
}
