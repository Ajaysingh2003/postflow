"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { Button } from "@/components/ui/button";
import { reloadAuthPage } from "@/modules/user/authFlow";
import OnboardingShell from "@/modules/home/component/OnboardingShell";

export default function Error({ reset }: { reset: () => void }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const complete = useMutation(trpc.user.completeOnboarding.mutationOptions());
  const [message, setMessage] = useState("");
  async function skip() {
    try {
      await complete.mutateAsync();
      reloadAuthPage("/dashboard");
    } catch {
      setMessage(
        "We couldn’t save that just yet. Please try again in a moment.",
      );
    }
  }
  return (
    <OnboardingShell>
      <section
        role="alert"
        className="rounded-3xl border border-border bg-card p-8 text-center shadow-sm"
      >
        <h1 className="font-heading text-3xl">Let’s try that again</h1>
        <p className="my-4 text-sm text-muted-foreground">
          We couldn’t load your setup. Your account is safe.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Button
            className="secondary-btn"
            disabled={complete.isPending}
            onClick={() => void skip()}
          >
            Set up later
          </Button>
          <Button
            className="primary-btn"
            disabled={complete.isPending}
            onClick={async () => {
              await queryClient.resetQueries({
                queryKey: trpc.user.onboarding.queryKey(),
              });
              await queryClient.resetQueries({
                queryKey: trpc.studio.accounts.queryKey(),
              });
              reset();
            }}
          >
            Try again
          </Button>
        </div>
        {message && <p className="mt-4 text-xs text-destructive">{message}</p>}
      </section>
    </OnboardingShell>
  );
}
