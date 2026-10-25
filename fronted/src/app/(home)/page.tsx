import { PageSeo } from "@/lib/seo/PageSeo";
import { seoMetadata } from "@/lib/seo/config";
import React, { Suspense } from "react";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { getQueryClient, trpc } from "@/trpc/server";
import HomeView from "@/modules/home/view/HomeView";
import { connection } from "next/server";
import PricingSection from "@/modules/billing/component/PricingSection";
import { PricingSkeleton } from "@/modules/billing/component/PricingCardSection";

async function PreloadedPricing() {
  await connection();
  const queryClient = getQueryClient();
  await queryClient.prefetchQuery(trpc.billing.getPlans.queryOptions());
  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <PageSeo
        path="/"
        plans={queryClient.getQueryData(
          trpc.billing.getPlans.queryOptions().queryKey,
        )}
      />
      <PricingSection />
    </HydrationBoundary>
  );
}

export default function Page() {
  return (
    <HomeView
      pricingSection={
        <Suspense
          fallback={
            <div className="py-16 sm:py-24">
              <PricingSkeleton />
            </div>
          }
        >
          <PreloadedPricing />
        </Suspense>
      }
    />
  );
}

export const metadata = seoMetadata("/");
