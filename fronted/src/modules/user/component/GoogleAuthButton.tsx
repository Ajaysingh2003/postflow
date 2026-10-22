"use client";

import { reloadAuthPage } from "../authFlow";
import Script from "next/script";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTRPC } from "@/trpc/client";
import { nextAuthPath, verificationPath } from "../authFlow";
import { Button } from "@/components/ui/button";

interface GoogleIdentity {
  initialize(options: {
    client_id: string;
    callback: (response: { credential: string }) => void;
  }): void;
  renderButton(
    container: HTMLElement,
    options: {
      type: "standard";
      theme: string;
      size: string;
      text: string;
      width: number;
    },
  ): void;
  cancel(): void;
}

function googleIdentity(): GoogleIdentity | undefined {
  return (
    window as Window & { google?: { accounts?: { id?: GoogleIdentity } } }
  ).google?.accounts?.id;
}

function GoogleMark() {
  return (
    <Image
      src="/google.png"
      width={20}
      height={20}
      alt=""
      aria-hidden="true"
      className="size-5 shrink-0 object-contain"
    />
  );
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
    let lastWidth = 0;
    const render = () => {
      const width = Math.min(400, Math.floor(container.clientWidth));
      if (width <= 0 || width === lastWidth) return;
      lastWidth = width;
      identity.renderButton(container, {
        type: "standard",
        theme: "outline",
        size: "large",
        text: "continue_with",
        width,
      });
    };
    render();
    const observer = new ResizeObserver(render);
    observer.observe(container);
    return () => {
      active = false;
      observer.disconnect();
      identity.cancel();
      container.replaceChildren();
    };
  }, [ready, clientId, mutate]);

  if (!clientId || loading || loadFailed)
    return (
      <Button
        className="secondary-btn h-10 w-full rounded-md"
        aria-label="Continue with Google"
        disabled
        title={
          loading
            ? "Loading sign-in options"
            : "Google sign-in is currently unavailable"
        }
      >
        <GoogleMark />
      </Button>
    );
  return (
    <div
      className={`relative h-10 w-full min-w-0 rounded-md focus-within:ring-2 focus-within:ring-ring/50 ${signIn.isPending ? "pointer-events-none opacity-60" : ""}`}
      aria-busy={signIn.isPending}
    >
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
        <Button
          className="secondary-btn h-10 w-full rounded-md"
          aria-label="Continue with Google"
          disabled
        >
          <GoogleMark />
        </Button>
      )}
      {ready && (
        <div
          aria-hidden="true"
          className="secondary-btn pointer-events-none flex h-10 w-full justify-center rounded-md"
        >
          <GoogleMark />
        </div>
      )}
      {/* The official control receives the click and keyboard input directly.
          Its full-width hit area sits over our decorative icon-only face. */}
      <div
        ref={holder}
        className="absolute inset-0 h-10 w-full opacity-0"
        aria-disabled={signIn.isPending || undefined}
        aria-busy={signIn.isPending}
      />
      {signIn.isPending && (
        <p className="sr-only" role="status">
          Signing in with Google…
        </p>
      )}
    </div>
  );
}
