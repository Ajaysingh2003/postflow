"use client";

import { useEffect, useState } from "react";
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import {
  isSafeAuthUrl,
  type ChannelConfig,
} from "@/modules/channels/channel-config";
import ConnectChannelDialog from "@/modules/channels/component/ConnectChannelDialog";
import { reloadAuthPage } from "@/modules/user/authFlow";
import OnboardingPanel, {
  type OnboardingStep,
} from "../component/OnboardingPanel";

export default function OnboardingView({
  name,
  initialStep = "welcome",
  connectionFailed = false,
}: {
  name: string;
  initialStep?: OnboardingStep;
  connectionFailed?: boolean;
}) {
  
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { data: setup } = useSuspenseQuery(trpc.user.onboarding.queryOptions());
  const { data: accounts } = useSuspenseQuery(
    trpc.studio.accounts.queryOptions(),
  );
  const [step, setStep] = useState<OnboardingStep>(initialStep);
  const [prompt, setPrompt] = useState<ChannelConfig | null>(null);
  const [error, setError] = useState(
    connectionFailed
      ? "Connection wasn’t completed. Try again, or connect later from Channels."
      : "",
  );
  const [redirecting, setRedirecting] = useState<string | null>(null);
  const connect = useMutation(trpc.studio.connect.mutationOptions());
  const complete = useMutation(trpc.user.completeOnboarding.mutationOptions());

  useEffect(() => {
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        // A browser Back from the provider can restore the pending redirect state.
        setRedirecting(null);
        void queryClient.invalidateQueries({
          queryKey: trpc.studio.accounts.queryKey(),
        });
      }
    };
    window.addEventListener("pageshow", onPageShow);
    const url = new URL(window.location.href);
    if (url.searchParams.has("connected"))
      void queryClient.invalidateQueries({
        queryKey: trpc.studio.accounts.queryKey(),
      });
    if (url.searchParams.has("connected") || url.searchParams.has("error")) {
      url.searchParams.delete("connected");
      url.searchParams.delete("error");
      window.history.replaceState(null, "", url.pathname + url.search);
    }
    return () => window.removeEventListener("pageshow", onPageShow);
  }, [queryClient, trpc]);

  function changeStep(next: OnboardingStep) {
    setError("");
    setStep(next);
    window.history.replaceState(
      null,
      "",
      next === "connect" ? "/onboarding?step=connect" : "/onboarding",
    );
    requestAnimationFrame(() =>
      document.getElementById("onboarding-heading")?.focus(),
    );
  }

  async function finish() {
    if (complete.isPending || connect.isPending || redirecting) return;
    setError("");
    try {
      await complete.mutateAsync();
      reloadAuthPage("/dashboard");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Couldn’t save setup. Please try again.",
      );
    }
  }

  async function startConnection(
    channel: ChannelConfig,
    options: Record<string, string> = {},
  ) {
    if (
      channel.comingSoon ||
      channel.id === "tiktok" ||
      !setup.can_connect ||
      complete.isPending ||
      connect.isPending ||
      redirecting
    )
      return;
    setError("");
    try {
      const result = await connect.mutateAsync({
        platform: channel.id,
        options,
        return_to: "/onboarding?step=connect",
      });
      if (!isSafeAuthUrl(result.auth_url))
        throw new Error("Couldn’t open the connection. Please try again.");
      setRedirecting(channel.id);
      window.location.assign(result.auth_url);
    } catch (err) {
      setPrompt(null);
      setRedirecting(null);
      setError(
        err instanceof Error
          ? err.message
          : "Couldn’t connect. Please try again.",
      );
    }
  }

  return (
    <>
      <OnboardingPanel
        name={name}
        step={step}
        accounts={accounts}
        canConnect={setup.can_connect}
        connectingPlatform={
          redirecting ?? (connect.isPending ? connect.variables.platform : null)
        }
        finishing={complete.isPending}
        error={error}
        onStep={changeStep}
        onFinish={() => void finish()}
        onConnect={(channel) => {
          if (channel.id === "bluesky" || channel.id === "mastodon")
            setPrompt(channel);
          else void startConnection(channel);
        }}
      />
      {prompt && (
        <ConnectChannelDialog
          key={prompt.id}
          channel={prompt}
          loading={connect.isPending || !!redirecting}
          onClose={() => setPrompt(null)}
          onSubmit={(options) => void startConnection(prompt, options)}
        />
      )}
    </>
  );
}
