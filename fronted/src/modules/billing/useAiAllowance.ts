"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { USAGE_QUERY_OPTIONS, aiExhausted } from "./usageModel";

export function useAiAllowance(workspaceId?: string) {
  const trpc = useTRPC();
  const query = useQuery(
    trpc.studio.usage.queryOptions(
      { workspace_id: workspaceId },
      { ...USAGE_QUERY_OPTIONS, enabled: !!workspaceId },
    ),
  );
  return {
    ...query,
    blocked: !query.data || !!query.error || aiExhausted(query.data),
  };
}
export function useRefreshUsage() {
  const trpc = useTRPC();
  const cache = useQueryClient();
  return () =>
    Promise.all([
      cache.invalidateQueries({ queryKey: trpc.studio.usage.queryKey() }),
      cache.invalidateQueries({
        queryKey: trpc.studio.billingUsage.queryKey(),
      }),
      cache.invalidateQueries({ queryKey: trpc.studio.home.queryKey() }),
    ]);
}
