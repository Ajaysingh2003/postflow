import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { getQueryClient, trpc } from "@/trpc/server";
import AgentsPage from "@/modules/agents/AgentsPage";

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
      <AgentsPage />
    </HydrationBoundary>
  );
}
