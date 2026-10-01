"use client";

import React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, CreditCard, ExternalLink, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTRPC } from "@/trpc/client";
import { useMutation, useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";

export default function BillingSettingsPage() {
  const searchParams = useSearchParams();
  const checkoutSuccess = searchParams.get("checkout") === "success";
  const planParam = searchParams.get("plan");

  const trpc = useTRPC();
  const subscriptionQuery = useQuery(trpc.billing.subscription.queryOptions());
  const portalMutation = useMutation(
    trpc.billing.portal.mutationOptions({
      onSuccess(data) {
        if (data?.link) {
          window.location.href = data.link;
        }
      },
      onError(err) {
        toast.error(err.message || "Failed to open billing customer portal");
      },
    }),
  );

  const sub = subscriptionQuery.data;
  const planName = sub?.plan_code || planParam || "Starter";

  return (
    <div className="max-w-4xl mx-auto py-10 px-4 sm:px-6">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-heading font-bold text-neutral-900">
          Billing & Subscription
        </h1>
        <p className="text-sm text-neutral-600 mt-1">
          Manage your plan, active 3-day trial, and payment details via Dodo Payments.
        </p>
      </div>

      {checkoutSuccess && (
        <div className="mb-6 p-4 rounded-xl border border-lime-200 bg-lime-50/80 flex items-start gap-3">
          <CheckCircle2 className="size-5 text-lime-700 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-sm text-lime-900">
              3-Day Free Trial Activated!
            </p>
            <p className="text-xs text-lime-800 mt-0.5">
              Welcome to the {planName.toUpperCase()} plan. Your trial is active for the next 3 days. You will not be charged until the trial ends, and you can cancel anytime.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 p-6 rounded-2xl border border-zinc-200 bg-white shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-zinc-100">
              <div className="flex items-center gap-2">
                <Sparkles className="size-5 text-lime-600" />
                <span className="font-heading font-semibold text-base capitalize">
                  {planName} Plan
                </span>
              </div>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-lime-100 text-lime-800">
                {sub?.status === "active" ? "Active" : "3-Day Trial Active"}
              </span>
            </div>

            <div className="py-4 space-y-3">
              <div className="flex items-center gap-2 text-xs text-neutral-600">
                <CheckCircle2 className="size-4 text-lime-600" />
                <span>Full access to streaming infra, CDN, and high-performance encoding</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-neutral-600">
                <CheckCircle2 className="size-4 text-lime-600" />
                <span>All workspaces & team collaboration enabled</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-neutral-600">
                <ShieldCheck className="size-4 text-lime-600" />
                <span>Secure payment management powered by Dodo Payments</span>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-zinc-100 flex flex-wrap items-center gap-3">
            <Button
              variant="outline"
              disabled={portalMutation.isPending}
              onClick={() => portalMutation.mutate(undefined)}
              className="gap-2 text-xs"
            >
              <CreditCard className="size-4" />
              {portalMutation.isPending ? "Opening Portal..." : "Manage In Dodo Portal"}
              <ExternalLink className="size-3 text-neutral-400" />
            </Button>
            <Link href="/dashboard">
              <Button variant="ghost" className="text-xs">
                Back to Dashboard
              </Button>
            </Link>
          </div>
        </div>

        <div className="p-6 rounded-2xl border border-zinc-200 bg-zinc-50/70 flex flex-col justify-between">
          <div>
            <h3 className="font-heading font-semibold text-sm text-neutral-900">
              Need to switch tiers?
            </h3>
            <p className="text-xs text-neutral-600 mt-2 leading-relaxed">
              Explore Starter, Pro, or Business tiers with 3-day trials. Upgrade or downgrade seamlessly anytime.
            </p>
          </div>
          <Link href="/#pricing" className="mt-4">
            <Button variant="outline" className="w-full text-xs">
              View All Plans
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
