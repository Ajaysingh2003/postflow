"use client";

import { Component, Suspense, type ReactNode } from "react";
import Link from "next/link";
import {
  useMutation,
  useSuspenseQuery,
  QueryErrorResetBoundary,
} from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { CreditCard, ArrowUpRight, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useTRPC } from "@/trpc/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  USAGE_QUERY_OPTIONS,
  bonusCreditNote,
  usageReset,
  type BillingUsage,
} from "../usageModel";
import { UsageCircle } from "./UsageCircle";
import { cn } from "@/lib/utils";

export function BillingSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading plan and usage"
      className="mx-auto max-w-4xl space-y-6 p-8"
    >
      <Skeleton className="h-12 w-64" />
      <Skeleton className="h-40 rounded-2xl" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[1, 2, 3].map((key) => (
          <Skeleton key={key} className="h-60 rounded-xl" />
        ))}
      </div>
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
export default function BillingView({
  workspaceId,
  embedded = false,
}: {
  workspaceId?: string;
  embedded?: boolean;
}) {
  return (
    <QueryErrorResetBoundary>
      {({ reset }) => (
        <BillingError reset={reset}>
          <Suspense fallback={<BillingSkeleton />}>
            <BillingContent workspaceId={workspaceId} embedded={embedded} />
          </Suspense>
        </BillingError>
      )}
    </QueryErrorResetBoundary>
  );
}
function BillingContent({
  workspaceId,
  embedded,
}: {
  workspaceId?: string;
  embedded: boolean;
}) {
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
      embedded={embedded}
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
  embedded = false,
  data,
  checkoutReturned = false,
  refreshing = false,
  refreshError = false,
  onRefresh,
  openingPortal = false,
  onPortal,
}: {
  embedded?: boolean;
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
    <div
      className={
        embedded ? "space-y-6" : "mx-auto max-w-4xl space-y-6 px-5 py-8 sm:px-8"
      }
    >
      {!embedded && (
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div className={embedded ? "hidden" : undefined}>
            <p className="mb-2 text-[10px] uppercase tracking-[.18em] text-muted-foreground">
              Workspace settings
            </p>
            <h1 className="font-heading text-3xl font-semibold">
              Plan & usage
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Your plan and usage for this workspace.
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
      )}
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
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "rounded-full px-3 py-1 text-xs capitalize",
                ["on_hold", "failed", "expired"].includes(status)
                  ? "bg-amber-500/10 text-amber-700"
                  : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
              )}
            >
              {statusLabel}
            </span>
            {embedded && (
              <Button
                variant="outline"
                size="icon-sm"
                className="secondary-btn !px-2"
                aria-label="Refresh billing usage"
                title="Refresh usage"
                disabled={refreshing}
                onClick={onRefresh}
              >
                <RefreshCw
                  className={refreshing ? "size-3.5 animate-spin" : "size-3.5"}
                />
              </Button>
            )}
          </div>
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
                <Link href="/pricing">
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
      <section>
        <h2 className="mb-2 text-sm font-semibold">Monthly usage</h2>
        <p className="mb-6 text-xs leading-5 text-muted-foreground">
          {usage.scheduled_posts.limit === null
            ? "AI credits reset "
            : "AI and post allowances reset "}
          {usageReset(usage.cycle_end)} (UTC).{" "}
          {currentPaid && "Credits renew monthly, including on yearly plans. "}
          Unused monthly credits don’t roll over.
        </p>
        {bonusCreditNote(usage) && (
          <p className="mb-4 text-xs leading-5 text-muted-foreground">{bonusCreditNote(usage)}</p>
        )}
        <div className="grid gap-3 sm:grid-cols-3">
          <UsageCircle
            title="AI credits"
            value={usage.ai_credits}
            note="One credit per successful request"
          />
          <UsageCircle
            title="Posts this month"
            value={usage.scheduled_posts}
            note={
              usage.scheduled_posts.limit === null
                ? "Publish now or schedule across your connected channels"
                : "One post across all selected channels"
            }
          />
          <UsageCircle
            title="Connected accounts"
            value={usage.connected_accounts}
            note="Connections needing reconnection keep their slot"
          />
        </div>
        <p className="mt-6 border-t border-border pt-4 text-xs leading-6 text-muted-foreground">
          Failed requests don’t use AI credits. Channel API limits still apply.
        </p>
      </section>
      {!embedded && (
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          Back to Home
          <ArrowUpRight className="size-4" />
        </Link>
      )}
    </div>
  );
}
