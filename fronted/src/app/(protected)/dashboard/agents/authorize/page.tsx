import { redirect } from "next/navigation";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { getAccessToken } from "@/lib/http-error";
import { getQueryClient, trpc } from "@/trpc/server";
import AgentAuthorization from "@/modules/agents/AgentAuthorization";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ request?: string }>;
}) {
  const { request } = await searchParams;
  if (!request || request.length > 128) redirect("/dashboard");
  if (!(await getAccessToken()))
    redirect(
      `/login?next=${encodeURIComponent(`/dashboard/agents/authorize?request=${encodeURIComponent(request)}`)}`,
    );
  const queryClient = getQueryClient();
  await Promise.all([
    queryClient.prefetchQuery(
      trpc.agents.authorization.queryOptions({ request }),
    ),
    queryClient.prefetchQuery(trpc.workspace.current.queryOptions()),
    queryClient.prefetchQuery(trpc.workspace.list.queryOptions()),
  ]);
  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <AgentAuthorization request={request} />
    </HydrationBoundary>
  );
}
