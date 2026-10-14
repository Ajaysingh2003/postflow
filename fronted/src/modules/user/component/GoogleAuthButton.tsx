"use client";

import { reloadAuthPage } from "../authFlow";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTRPC } from "@/trpc/client";
import { nextAuthPath, verificationPath } from "../authFlow";
import { SiGoogle } from "@icons-pack/react-simple-icons";
import { Button } from "@/components/ui/button";

interface GoogleIdentity {
  initialize(options: {
    client_id: string;
    callback: (response: { credential: string }) => void;
  }): void;
  renderButton(
    container: HTMLElement,
    options: { theme: string; size: string; width: number; text: string },
  ): void;
  cancel(): void;
}
function googleIdentity(): GoogleIdentity | undefined {
  return (
    window as Window & { google?: { accounts?: { id?: GoogleIdentity } } }
  ).google?.accounts?.id;
}

export default function GoogleAuthButton({
  clientId,
  loading = false,
}: {
  clientId?: string | null;
  loading?: boolean;
}) {
  const trpc = useTRPC();
  const [ready, setReady] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const holder = useRef<HTMLDivElement>(null);
  const signIn = useMutation(
    trpc.user.google.mutationOptions({
      onSuccess(result) {
        reloadAuthPage(
          result.verification_required
            ? verificationPath(
                result.user.email,
                nextAuthPath(window.location.search),
              )
            : nextAuthPath(window.location.search),
        );
      },
      onError(error) {
        toast.error(error.message || "Google sign-in failed");
      },
    }),
  );
  const mutate = signIn.mutate;

  useEffect(() => {
    const identity = googleIdentity();
    if (!ready || !clientId || !identity || !holder.current) return;
    const container = holder.current;
    let active = true;
    identity.initialize({
      client_id: clientId,
      callback: ({ credential }) => {
        if (active) mutate({ id_token: credential });
      },
    });
    identity.renderButton(container, {
      theme: "outline",
      size: "large",
      width: Math.min(384, container.clientWidth || 320),
      text: "continue_with",
    });
    return () => {
      active = false;
      identity.cancel();
      container.replaceChildren();
    };
  }, [ready, clientId, mutate]);

  if (!clientId || loading || loadFailed)
    return (
      <Button
        className="secondary-btn h-10 w-full rounded-md"
        disabled
        title={
          loading
            ? "Loading sign-in options"
            : "Google sign-in is currently unavailable"
        }
      >
        <SiGoogle className="size-4" />
      </Button>
    );
  return (
    <div className="space-y-2">
      <Script
        src="https://accounts.google.com/gsi/client"
        strategy="afterInteractive"
        onReady={() => setReady(true)}
        onError={() => {
          setLoadFailed(true);
          toast.error(
            "Google sign-in could not load. You can use email instead.",
          );
        }}
      />
      {!ready && (
        <Button className="secondary-btn h-10 w-full rounded-md" disabled>
          <SiGoogle className="size-4" /> Continue with Google
        </Button>
      )}
      <div
        ref={holder}
        className={
          signIn.isPending ? "pointer-events-none opacity-60" : "w-full"
        }
        aria-busy={signIn.isPending}
      />
      {signIn.isPending && (
        <p className="text-xs text-muted-foreground" role="status">
          Signing in with Google…
        </p>
      )}
    </div>
  );
}
