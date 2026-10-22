import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { caller, getQueryClient, trpc } from "@/trpc/server";
import { verificationPath } from "@/modules/user/authFlow";
import OnboardingView from "@/modules/home/view/OnboardingView";
import OnboardingSkeleton from "@/modules/home/component/OnboardingSkeleton";

export const metadata: Metadata = {
  title: "Welcome to Draftva",
  robots: { index: false, follow: false },
};

async function PreloadedOnboarding({
  step,
  failed,
}: {
  step?: string;
  failed: boolean;
}) {
  await connection();
  const user = await caller.user.profile();
  if (!user) redirect("/login?next=%2Fonboarding");
  if (!user.email_verified)
    redirect(verificationPath(user.email, "/onboarding"));
  if (user.onboarding_completed_at) redirect("/dashboard");
  const queryClient = getQueryClient();
  const setup = await queryClient.fetchQuery(
    trpc.user.onboarding.queryOptions(),
  );
  if (setup.completed_at) redirect("/dashboard");
  await queryClient.prefetchQuery(trpc.studio.accounts.queryOptions());
  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <OnboardingView
        name={user.name}
        initialStep={step === "connect" ? "connect" : "welcome"}
        connectionFailed={failed}
      />
    </HydrationBoundary>
  );
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ step?: string; error?: string }>;
}) {
  const { step, error } = await searchParams;
  return (
    <Suspense fallback={<OnboardingSkeleton />}>
      <PreloadedOnboarding step={step} failed={error !== undefined} />
    </Suspense>
  );
}
