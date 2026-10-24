"use client";

import { Button } from "@/components/ui/button";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { FeatureItem, PlanConfig } from "@/modules/types";
import React, { useRef, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { useTRPC } from "@/trpc/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  checkoutLoginPath,
  hasPurchasedSubscription,
  startPlanCheckout,
} from "../checkout";
import { canonicalPlan, priceLabel } from "../upgradeModel";
function PlanCard({
  plan,
  timeLine,
  popular = false,
  feature,
  workspaceId,
}: {
  plan: PlanConfig;
  timeLine: "monthly" | "quarterly" | "annually";
  popular?: boolean;
  feature?: FeatureItem[];
  workspaceId?: string;
}) {
  const [hoverSeeAll, sethoverSeeAll] = useState(false);

  return (
    <div
      className={cn(
        "rounded-xl border shadow-sm flex flex-col  border-zinc-200 p-1 overflow-hidden bg-whitee/50",
        popular && "bg-background-card-popular",
      )}
    >
      <PlanCardHeader
        popular={popular}
        timeLine={timeLine}
        plan={plan}
        workspaceId={workspaceId}
      />
      <div
        className={cn(
          "px-5 mt-4 pb-2 flex flex-col flex-1 justify-between",
          !popular && "",
        )}
      >
        <ul className="flex flex-col  gap-3">
          {feature?.map((e, i) => (
            <li key={i} className="flex items-center gap-3 font-medium ">
              <HugeiconsIcon
                icon={e.icon}
                size={14}
                className={cn("text-accent", popular && "text-white/80")}
                strokeWidth={1.5}
              />
              <span
                className={cn(
                  "text-accent text-[13px] tracking-wide",
                  popular && "text-white",
                )}
              >
                {e.label}
              </span>
            </li>
          ))}
        </ul>
        <Button
          asChild
          // key={i}
          onMouseEnter={() => {
            sethoverSeeAll(true);
          }}
          onMouseLeave={() => sethoverSeeAll(false)}
          variant={"outline"}
          className={`rounded-xl text-xs md:text-[13px] mt-4 capitalizez md:text-md font-semibold  cursor-pointer border px-3 py-1.5  transition-all duration-200 ${
            !popular
              ? "bg-white/90 text-accent shadow-sm  hover:bg-white/60  hover:border-zinc-200 hover:text-accent"
              : "border-zinc-800 hover:bg-transparent bg-transparent  text-stone-300 duration-300 transition-all  hover:text-stone-300   hover:shadow-2xs"
          }
                         relative
                        `}
        >
          <Link href="/pricing#compare-plans">
            Explore all features{" "}
            <span
              className={cn(
                "bg-gray-300 overflow-hidden rounded-full size-5 text-center flex items-center justify-center ",
                popular && "bg-stone-700",
              )}
            >
              <motion.div
                initial={{ x: 10 }}
                animate={{ x: hoverSeeAll ? [0, 20, 0] : 0 }}
                transition={{
                  duration: 0.3,
                  ease: "easeInOut",
                }}
                className="w-full flex items-start justify-center gap-1"
              >
                <ArrowRight
                  className={cn("size-4", popular && "text-stone-300")}
                />
              </motion.div>
            </span>
          </Link>
        </Button>
      </div>
    </div>
  );
}

export default PlanCard;

function PlanCardHeader({
  plan,
  timeLine,
  popular,
  workspaceId,
}: {
  plan: PlanConfig;
  timeLine: "monthly" | "quarterly" | "annually";
  popular: boolean;
  workspaceId?: string;
}) {
  const trpc = useTRPC();
  const router = useRouter();
  const queryClient = useQueryClient();
  const starting = useRef(false);
  const [checkingSession, setCheckingSession] = useState(false);
  const mutate = useMutation(trpc.billing.createCheckout.mutationOptions());
  const portal = useMutation(trpc.billing.portal.mutationOptions());
  const profile = useQuery(trpc.user.profile.queryOptions());
  const billing = useQuery({
    ...trpc.studio.billingUsage.queryOptions({ workspace_id: workspaceId }),
    enabled: !!profile.data,
    retry: false,
    staleTime: 15_000,
  });
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const isCurrent =
    !!billing.data &&
    billing.data.usage.plan_code !== "free" &&
    canonicalPlan(billing.data.usage.plan_code) === canonicalPlan(plan.id);
  const cannotManage = !!billing.data && !billing.data.can_manage_billing;
  const actionLabel = isCurrent
    ? "Current plan"
    : hasPurchasedSubscription(billing.data)
      ? "Upgrade"
      : "Get started";
  const price = priceLabel(plan, timeLine);
  async function choosePlan() {
    if (starting.current) return;
    starting.current = true;
    setCheckingSession(true);
    setCheckoutError(null);
    const returnTo =
      window.location.pathname + window.location.search + window.location.hash;
    try {
      await startPlanCheckout({
        input: {
          plan_code: plan.id as "starter" | "pro" | "business",
          billing_cycle: timeLine,
        },
        getUser: () =>
          queryClient.fetchQuery({
            ...trpc.user.profile.queryOptions(),
            staleTime: 0,
            retry: false,
          }),
        checkout: (input) => mutate.mutateAsync(input),
        getBilling: async () => {
          if (workspaceId) {
            const workspace = await queryClient.fetchQuery({
              ...trpc.workspace.current.queryOptions(),
              staleTime: 0,
              retry: false,
            });
            if (workspace.id !== workspaceId)
              throw new Error(
                "Your workspace changed. Close this dialog and reopen it to choose a plan.",
              );
          }
          return queryClient.fetchQuery({
            ...trpc.studio.billingUsage.queryOptions({
              workspace_id: workspaceId,
            }),
            staleTime: 0,
            retry: false,
          });
        },
        openPortal: () => portal.mutateAsync(),
        push: (path) => router.push(path),
        open: (url) => window.location.assign(url),
        returnTo,
      });
    } catch (error) {
      if (
        (error as { data?: { code?: string } }).data?.code === "UNAUTHORIZED"
      ) {
        router.push(checkoutLoginPath(returnTo));
      } else {
        const message =
          error instanceof Error
            ? error.message
            : "Could not open checkout. Please try again.";
        setCheckoutError(message);
        toast.error(message);
      }
    } finally {
      starting.current = false;
      setCheckingSession(false);
    }
  }
  return (
    <div
      className={cn(
        "w-full px-5 py-6 flex flex-col gap-2 bg-[#fbfbfbz] bg-white rounded-xl border border-zinc-200 shadow-2xs",
        popular && "bg-transparent border-zinc-800 ",
      )}
    >
      <h3
        className={cn(
          "text-lg md:text-xl text-accent  font-heading font-semibold",
          popular && "text-white",
        )}
      >
        {plan.name}
      </h3>
      <p
        className={cn(
          "text-gray-900 capitalize tracking-wider text-sm font-normal leading-relaxed",
          popular && "text-white/80",
        )}
      >
        {plan.description}
      </p>

      <p className="font-bold space-x-2 items-center md:text-3xl lg:text-4xl text-accent">
        <span className={cn(popular && "text-white")}>{price.amount}</span>
        <span
          className={cn(
            "text-sm font-normal text-stone-500",
            popular && "text-white/80",
          )}
        >
          {price.suffix}
        </span>
      </p>

      {!!plan.billing_cycles[timeLine].discount_bps && (
        <p
          className={cn(
            "text-xs text-muted-foreground",
            popular && "text-white/70",
          )}
        >
          Base price. Product discounts are applied at checkout.
        </p>
      )}
      <div className="">
        <Button
          type="button"
          aria-label={`${actionLabel}: ${plan.name} ${price.interval.toLowerCase()}`}
          aria-busy={checkingSession || mutate.isPending || portal.isPending}
          disabled={
            isCurrent ||
            cannotManage ||
            checkingSession ||
            mutate.isPending ||
            portal.isPending
          }
          onClick={choosePlan}
          variant={"outline"}
          className={`rounded-md   w-full capitalize font-semibold  cursor-pointer border px-3 py-1.5 md:py-2 text-xs md:text-sm transition-all duration-200 ${
            popular
              ? "bg-white/90 text-black secondary-btn  shadow-2xs  hover:bg-white/90  hover:border-zinc-200 hover:text-zinc-800"
              : "bg-white/90z primary-btn text-accent  shadow-2xs  hover:bg-white/60  hover:border-zinc-200 hover:text-accent"
          }
             relative
            `}
        >
          {mutate.isPending
            ? "Opening checkout…"
            : portal.isPending
              ? "Opening billing…"
              : checkingSession
                ? "Checking your plan…"
                : actionLabel}
        </Button>
        {checkoutError && (
          <p
            role="alert"
            className={cn(
              "mt-2 text-sm text-red-600",
              popular && "text-red-300",
            )}
          >
            {checkoutError}
          </p>
        )}
        {cannotManage && (
          <p
            className={cn(
              "mt-2 text-xs text-muted-foreground",
              popular && "text-white/70",
            )}
          >
            Ask a workspace owner or billing admin to change the plan.
          </p>
        )}
      </div>
    </div>
  );
}
