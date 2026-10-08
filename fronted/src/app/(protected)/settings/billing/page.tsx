import { Suspense } from "react";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { getActiveWorkspaceId } from "@/lib/http-error";
import { getQueryClient, trpc } from "@/trpc/server";
import { USAGE_QUERY_OPTIONS } from "@/modules/billing/usageModel";
import BillingView, {
  BillingSkeleton,
} from "@/modules/billing/component/BillingView";

async function PreloadedBilling() {
  const workspaceId = await getActiveWorkspaceId();
  const client = getQueryClient();
  await client.prefetchQuery(
    trpc.studio.billingUsage.queryOptions(
      { workspace_id: workspaceId },
      USAGE_QUERY_OPTIONS,
    ),
  );
  return (
    <HydrationBoundary state={dehydrate(client)}>
      <BillingView key={workspaceId ?? "current"} workspaceId={workspaceId} />
    </HydrationBoundary>
  );
}
export default function Page() {
  return (
    <Suspense fallback={<BillingSkeleton />}>
      <PreloadedBilling />
    </Suspense>
  );
}
