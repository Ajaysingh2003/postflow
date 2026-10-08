import React from "react";
import PlanCard from "./PlanCard";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { BillingConfigResponse, FeatureItem } from "@/modules/types";

import {
  WorkIcon,
  AnalysisTextLinkIcon,
  AiVideoIcon,
  ArrowDataTransferVerticalIcon,
} from "@hugeicons/core-free-icons";
import type { PlanConfig } from "@/modules/types";

export function planFeatures(plan: PlanConfig): FeatureItem[] {
  const limits = plan.limits;
  if (!limits)
    return [
      { label: "Workspace publishing and AI assistance", icon: WorkIcon },
    ];
  const allowance = (key: string) =>
    limits[key] === null
      ? "Unlimited"
      : (limits[key]?.toLocaleString("en-US") ?? "Included");
  return [
    {
      label: `${allowance("ai_credits")} AI credits / month`,
      icon: AiVideoIcon,
    },
    {
      label: `${allowance("scheduled_posts")} posts / month`,
      icon: ArrowDataTransferVerticalIcon,
    },
    {
      label: `${allowance("connected_accounts")} connected accounts`,
      icon: WorkIcon,
    },
    { label: `${allowance("seats")} workspace seats`, icon: WorkIcon },
    { label: `${allowance("workspaces")} workspaces`, icon: WorkIcon },
    { label: "Account analytics", icon: AnalysisTextLinkIcon },
    {
      label: "One post across its selected channels uses one slot",
      icon: ArrowDataTransferVerticalIcon,
    },
  ];
}

function PricingCardSection({
  timeLine,
}: {
  timeLine: "monthly" | "quarterly" | "annually";
}) {
  const trpc = useTRPC();
  const { data, isPending, isError, refetch } = useQuery(
    trpc.billing.getPlans.queryOptions(),
  );

  const plans = data as BillingConfigResponse;

  if (isPending) {
    return (
      <div
        role="status"
        className="mx-auto max-w-6xl py-16 text-center text-sm text-muted-foreground"
      >
        Loading plans…
      </div>
    );
  }

  if (isError) {
    return (
      <div
        role="alert"
        className="mx-auto max-w-6xl py-16 text-center text-sm text-muted-foreground"
      >
        Plans are temporarily unavailable.{" "}
        <button
          type="button"
          onClick={() => void refetch()}
          className="ml-1 font-medium text-foreground underline underline-offset-4"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="w-full h-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
      {plans?.["starter"] && (
        <PlanCard
          feature={planFeatures(plans["starter"])}
          timeLine={timeLine}
          plan={plans["starter"]}
        />
      )}
      {plans?.["pro"] && (
        <PlanCard
          feature={planFeatures(plans["pro"])}
          popular={true}
          plan={plans["pro"]}
          timeLine={timeLine}
        />
      )}
      {plans?.["business"] && (
        <PlanCard
          feature={planFeatures(plans["business"])}
          plan={plans["business"]}
          timeLine={timeLine}
        />
      )}
    </div>
  );
}

export default PricingCardSection;
