"use client";

import { Component, Suspense, type ReactNode } from "react";
import Link from "next/link";
import {
  useMutation,
  useSuspenseQuery,
  QueryErrorResetBoundary,
} from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { CreditCard, ArrowUpRight, RefreshCw, Sparkles } from "lucide-react";
import toast from "react-hot-toast";
import { useTRPC } from "@/trpc/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  USAGE_QUERY_OPTIONS,
  usageReset,
  type BillingUsage,
} from "../usageModel";
import { UsageMeter } from "./UsageMeter";

export function BillingSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading plan and usage"
      className="mx-auto max-w-4xl space-y-6 p-8"
    >
      <Skeleton className="h-12 w-64" />
      <Skeleton className="h-40 rounded-2xl" />
      <Skeleton className="h-80 rounded-2xl" />
    </div>
  );
}
class BillingError extends Component<
  { children: ReactNode; reset: () => void },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed)
      return (
        <div role="alert" className="mx-auto max-w-xl p-10 text-center">
          <h1 className="font-heading text-2xl">Your plan couldn’t load</h1>
          <p className="my-4 text-sm text-muted-foreground">
            Try again to see your current allowance and subscription.
          </p>
          <Button
            className="primary-btn"
            onClick={() => {
              this.props.reset();
              this.setState({ failed: false });
            }}
          >
            Try again
          </Button>
        </div>
      );
    return this.props.children;
  }
}
export default function BillingView({ workspaceId }: { workspaceId?: string }) {
  return (
    <QueryErrorResetBoundary>
      {({ reset }) => (
        <BillingError reset={reset}>
          <Suspense fallback={<BillingSkeleton />}>
            <BillingContent workspaceId={workspaceId} />
          </Suspense>
        </BillingError>
      )}
    </QueryErrorResetBoundary>
  );
}
function BillingContent({ workspaceId }: { workspaceId?: string }) {
  const trpc = useTRPC();
  const params = useSearchParams();
  const query = useSuspenseQuery(
    trpc.studio.billingUsage.queryOptions(
      { workspace_id: workspaceId },
      USAGE_QUERY_OPTIONS,
    ),
  );
  const portal = useMutation(
    trpc.billing.portal.mutationOptions({
      onSuccess(data) {
        if (data?.link) window.location.assign(data.link);
      },
      onError(error) {
        toast.error(error.message || "Could not open billing management");
      },
    }),
  );
  return (
    <BillingOverview
      data={query.data}
      checkoutReturned={params.get("checkout") === "success"}
      refreshing={query.isFetching}
      refreshError={!!query.error}
      onRefresh={() => void query.refetch()}
      openingPortal={portal.isPending}
      onPortal={() => portal.mutate(undefined)}
    />
  );
}
export function BillingOverview({
  data,
  checkoutReturned = false,
  refreshing = false,
  refreshError = false,
  onRefresh,
  openingPortal = false,
  onPortal,
}: {
  data: BillingUsage;
  checkoutReturned?: boolean;
  refreshing?: boolean;
  refreshError?: boolean;
  onRefresh?: () => void;
  openingPortal?: boolean;
  onPortal?: () => void;
}) {
  const { usage, subscription: sub } = data;
  const status = sub?.status ?? "free";
  const currentPaid = usage.plan_code !== "free";
  const statusLabel = !currentPaid
    ? "Free plan"
    : status === "trialing"
      ? "Trial active"
      : sub?.cancel_at_period_end || status === "cancelled"
        ? "Cancels at period end"
        : status.replaceAll("_", " ");
  return (
    <div className="mx-auto max-w-4xl space-y-6 px-5 py-8 sm:px-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mb-2 text-[10px] uppercase tracking-[.18em] text-muted-foreground">
            Workspace settings
          </p>
          <h1 className="font-heading text-3xl font-semibold">Plan & usage</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Your allowance, shared across this workspace.
          </p>
        </div>
        <Button
          variant="outline"
          className="secondary-btn"
          disabled={refreshing}
          onClick={onRefresh}
        >
          <RefreshCw
            className={refreshing ? "size-4 animate-spin" : "size-4"}
          />
          Refresh
        </Button>
      </header>
      {checkoutReturned && (
        <p
          role="status"
          className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-4 text-sm"
        >
          Checkout completed. Your plan will update after payment confirmation.
          Refresh if it’s still pending.
        </p>
      )}
      {refreshError && (
        <p role="alert" className="text-sm text-amber-600">
          We couldn’t refresh your plan. Your last loaded usage is shown.
        </p>
      )}
      <section className="rounded-2xl border border-border bg-card p-6 shadow-xs">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs text-muted-foreground">Current plan</p>
            <h2 className="mt-2 font-heading text-2xl font-semibold capitalize">
              {usage.plan_code}
            </h2>
          </div>
          <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs capitalize text-emerald-700 dark:text-emerald-400">
            {statusLabel}
          </span>
        </div>
        {currentPaid && sub?.current_period_end && (
          <p className="mt-3 text-sm text-muted-foreground">
            {sub.cancel_at_period_end || status === "cancelled"
              ? "Access until"
              : status === "trialing"
                ? "Trial ends"
                : "Billing period ends"}{" "}
            {usageReset(sub.current_period_end)} (UTC).
          </p>
        )}
        <div className="mt-6 flex flex-wrap gap-3">
          {data.can_manage_billing ? (
            <>
              <Button asChild className="primary-btn">
                <Link href="/#pricing">
                  {currentPaid ? "Compare plans" : "Upgrade plan"}
                  <ArrowUpRight className="size-4" />
                </Link>
              </Button>
              {sub && (
                <Button
                  variant="outline"
                  className="secondary-btn"
                  onClick={onPortal}
                  disabled={openingPortal}
                >
                  <CreditCard className="size-4" />
                  {openingPortal ? "Opening…" : "Manage billing"}
                </Button>
              )}
            </>
          ) : (
            <p className="text-xs text-muted-foreground">
              Ask a workspace owner or billing admin to change the plan.
            </p>
          )}
        </div>
      </section>
      <section className="rounded-2xl border border-border bg-card p-6 shadow-xs">
        <h2 className="mb-2 flex items-center gap-2 font-heading text-xl font-semibold">
          <Sparkles className="size-5 text-violet-500" />
          Included usage
        </h2>
        <p className="mb-6 text-xs leading-5 text-muted-foreground">
          AI and post allowances reset {usageReset(usage.cycle_end)} (UTC),
          including on annual plans. Unused credits don’t roll over.
        </p>
        <div className="space-y-7">
          <UsageMeter
            title="AI credits"
            value={usage.ai_credits}
            note="One credit per successful request"
          />
          <UsageMeter
            title="Posts this month"
            value={usage.scheduled_posts}
            note="One post across all selected channels"
          />
          <UsageMeter
            title="Connected accounts"
            value={usage.connected_accounts}
            note="Connections needing reconnection keep their slot"
          />
        </div>
        <p className="mt-6 border-t border-border pt-4 text-xs leading-6 text-muted-foreground">
          Failed AI requests don’t use your allowance. Platform API fees, such
          as X’s API credits, are handled separately from AI credits.
        </p>
      </section>
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        Back to Home
        <ArrowUpRight className="size-4" />
      </Link>
    </div>
  );
}
