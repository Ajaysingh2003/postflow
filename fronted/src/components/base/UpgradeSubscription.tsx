"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, RefreshCw, Sparkles } from "lucide-react";
import { useSidebar } from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { SettingsLink } from "@/modules/settings/SettingsProvider";
import { USAGE_QUERY_OPTIONS } from "@/modules/billing/usageModel";
import { canonicalPlan, planName } from "@/modules/billing/upgradeModel";
import { useTRPC } from "@/trpc/client";

const UpgradeSubscriptionDialog = dynamic(
  () => import("./UpgradeSubscriptionDialog"),
  { ssr: false },
);

export function UpgradeSubscription() {
  const { open, isMobile } = useSidebar();
  const trpc = useTRPC();
  const workspace = useQuery(trpc.workspace.current.queryOptions());
  const billing = useQuery({
    ...trpc.studio.billingUsage.queryOptions(
      { workspace_id: workspace.data?.id },
      USAGE_QUERY_OPTIONS,
    ),
    enabled: !!workspace.data?.id,
  });
  const [dialogOpen, setDialogOpen] = useState(false);
  const expanded = open || isMobile;

  if (workspace.isError || billing.isError) {
    return (
      <div className="rounded-xl border border-border bg-background p-3">
        {expanded && (
          <p className="mb-2 text-xs text-muted-foreground">
            Your plan couldn’t load.
          </p>
        )}
        <button
          type="button"
          aria-label="Retry loading your plan"
          className="secondary-btn w-full justify-center rounded-lg"
          onClick={() => {
            void workspace.refetch();
            void billing.refetch();
          }}
        >
          <RefreshCw className="size-3.5" aria-hidden="true" />
          {expanded && "Retry"}
        </button>
      </div>
    );
  }
  if (!billing.data || !workspace.data) {
    return (
      <div
        role="status"
        aria-label="Loading workspace plan"
        className="space-y-2 rounded-xl border border-border p-3"
      >
        <Skeleton className="h-4 w-2/3" />
        {expanded && <Skeleton className="h-8 w-full rounded-lg" />}
      </div>
    );
  }
  const code = canonicalPlan(billing.data.usage.plan_code);
  const highestPlan = code === "business";
  const canManage = billing.data.can_manage_billing;
  const label = highestPlan || !canManage ? "Plan & usage" : "Explore plans";
  const buttonClass =
    "primary-btn w-full justify-center rounded-lg text-xs! focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2";

  return (
    <>
      <div className="rounded-xl border border-border bg-background p-3 shadow-xs">
        {expanded && (
          <>
            <div className="flex items-center gap-2 text-[13px] font-semibold">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
                <Sparkles className="size-3.5" aria-hidden="true" />
              </span>
              {planName(code)} plan
            </div>
            <p className="mb-3 mt-2 text-xs leading-5 text-muted-foreground">
              {!canManage
                ? "See this workspace’s allowance and usage."
                : code === "free"
                  ? "More room for your ideas, channels, and AI drafts."
                  : highestPlan
                    ? "Your workspace is on our most complete plan."
                    : "Find more room for your growing workspace."}
            </p>
          </>
        )}
        {highestPlan || !canManage ? (
          <SettingsLink
            section="billing"
            aria-label={label}
            className={buttonClass}
          >
            {expanded ? (
              label
            ) : (
              <Sparkles className="size-4" aria-hidden="true" />
            )}
            {expanded && (
              <ArrowUpRight className="size-3.5" aria-hidden="true" />
            )}
          </SettingsLink>
        ) : (
          <button
            type="button"
            aria-label={label}
            aria-haspopup="dialog"
            className={buttonClass}
            onClick={() => setDialogOpen(true)}
          >
            {expanded ? (
              label
            ) : (
              <Sparkles className="size-4" aria-hidden="true" />
            )}
            {expanded && (
              <ArrowUpRight className="size-3.5" aria-hidden="true" />
            )}
          </button>
        )}
      </div>
      {dialogOpen && (
        <UpgradeSubscriptionDialog
          key={workspace.data.id}
          workspaceId={workspace.data.id}
          workspaceName={workspace.data.name}
          onClose={() => setDialogOpen(false)}
        />
      )}
    </>
  );
}
