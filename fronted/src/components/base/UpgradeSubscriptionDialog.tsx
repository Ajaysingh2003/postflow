"use client";

import {
  Component,
  Suspense,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  QueryErrorResetBoundary,
  useSuspenseQueries,
} from "@tanstack/react-query";
import { Info, ShieldCheck } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import PricingCardSection, {
  PricingSkeleton,
} from "@/modules/billing/component/PricingCardSection";
import PricingPlan from "@/modules/billing/component/PricingPlan";
import {
  subscriptionNeedsManagement,
  type BillingCycle,
} from "@/modules/billing/checkout";
import { USAGE_QUERY_OPTIONS } from "@/modules/billing/usageModel";
import { catalogCycleLabel } from "@/modules/billing/upgradeModel";
import { CATALOG_QUERY_OPTIONS } from "@/modules/billing/catalogQuery";
import { useTRPC } from "@/trpc/client";

/* -------------------------------------------------------------------------- */
/* Error boundary                                                             */
/* -------------------------------------------------------------------------- */

class UpgradeError extends Component<
  { children: ReactNode; onRetry: () => void },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;

    return (
      <div role="alert" className="px-6 py-16 text-center">
        <h3 className="font-heading text-2xl">Plans couldn’t load</h3>
        <p className="mx-auto mt-2 mb-6 max-w-sm text-sm leading-6 text-muted-foreground">
          Please try again. Your current subscription hasn’t changed.
        </p>
        <button
          type="button"
          className="secondary-btn rounded-lg"
          onClick={() => {
            this.props.onRetry();
            this.setState({ failed: false });
          }}
        >
          Try again
        </button>
      </div>
    );
  }
}

/* -------------------------------------------------------------------------- */
/* Loading                                                                    */
/* -------------------------------------------------------------------------- */

export function UpgradePlansSkeleton() {
  return (
    <div role="status" aria-busy="true" className="p-5 sm:p-7">
      <span className="sr-only">Loading available plans</span>
      <PricingSkeleton />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Content                                                                    */
/* -------------------------------------------------------------------------- */

function UpgradeContent({ workspaceId }: { workspaceId: string }) {
  const trpc = useTRPC();

  // Fetch both in parallel. Two separate useSuspenseQuery calls would suspend
  // one after the other and delay the first paint.
  const [{ data: plans }, { data: billing }] = useSuspenseQueries({
    queries: [
      trpc.billing.getPlans.queryOptions(undefined, CATALOG_QUERY_OPTIONS),
      trpc.studio.billingUsage.queryOptions(
        { workspace_id: workspaceId },
        USAGE_QUERY_OPTIONS,
      ),
    ],
  });

  const [cycle, setCycle] = useState<BillingCycle>("monthly");

  // Stable reference so PricingPlan doesn't re-render on unrelated updates.
  const labels = useMemo(
    () => ({
      monthly: catalogCycleLabel(plans, "monthly"),
      quarterly: catalogCycleLabel(plans, "quarterly"),
      annually: catalogCycleLabel(plans, "annually"),
    }),
    [plans],
  );

  const managing = subscriptionNeedsManagement(billing);

  return (
    <div className="space-y-6 p-5 sm:p-7">
      <div className="flex flex-col items-center gap-3">
        <PricingPlan timeLine={cycle} setTimeLine={setCycle} labels={labels} />
        <p className="text-center text-xs text-muted-foreground">
          AI credits reset monthly on every billing frequency.
        </p>
      </div>

      {!billing.can_manage_billing && (
        <p
          role="status"
          className="flex items-start gap-2.5 rounded-xl border border-border bg-muted/40 p-4 text-sm leading-6"
        >
          <Info
            className="mt-0.5 size-4 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
          Ask a workspace owner or billing admin to change this plan.
        </p>
      )}

      <PricingCardSection maxWidth="max-w-5xl" timeLine={cycle} workspaceId={workspaceId} />

      <p className="flex items-start justify-center gap-2 text-center text-xs leading-5 text-muted-foreground">
        <ShieldCheck className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
        {managing
          ? "Plan changes are confirmed in your Dodo billing portal. No second subscription is created."
          : "Paid plans start immediately. Dodo shows the final total and applicable taxes before payment."}
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Dialog                                                                     */
/* -------------------------------------------------------------------------- */

export default function UpgradeSubscriptionDialog({
  workspaceId,
  workspaceName,
  onClose,
}: {
  workspaceId: string;
  workspaceName: string;
  onClose: () => void;
}) {
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="flex max-h-[min(90svh,900px)] w-[calc(100vw-24px)] max-w-[calc(100vw-24px)] flex-col gap-0 overflow-hidden rounded-2xl bg-background p-0 sm:max-w-[1200px]">
        {/* Stays pinned while the plans scroll. Also gives the dialog the
            accessible name and description it needs. */}
        <DialogHeader className="shrink-0 border-b border-border px-5 py-4 pr-14 text-left sm:px-7">
          <DialogTitle className="font-heading text-xl font-semibold tracking-tight">
            Upgrade your plan
          </DialogTitle>
          
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <QueryErrorResetBoundary>
            {({ reset }) => (
              <UpgradeError onRetry={reset}>
                <Suspense fallback={<UpgradePlansSkeleton />}>
                  <UpgradeContent workspaceId={workspaceId} />
                </Suspense>
              </UpgradeError>
            )}
          </QueryErrorResetBoundary>
        </div>
      </DialogContent>
    </Dialog>
  );
}