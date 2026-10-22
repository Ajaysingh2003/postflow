"use client";

import { useQuery } from "@tanstack/react-query";
import { SiX } from "@icons-pack/react-simple-icons";
import { useSearchParams } from "next/navigation";
import { useTRPC } from "@/trpc/client";
import { Button } from "@/components/ui/button";
import GoogleAuthButton from "./GoogleAuthButton";
import { safeAuthRedirect } from "../authFlow";
import type { AuthProviderConfig } from "../types";
import { socialErrorMessage, xLoginStartPath } from "../socialAuth";

export function SocialAuthChoices({
  googleClientId,
  xEnabled = false,
  loading = false,
  error,
  register = false,
  next = "/dashboard",
}: {
  googleClientId?: string | null;
  xEnabled?: boolean;
  loading?: boolean;
  error?: string | null;
  register?: boolean;
  next?: string;
}) {
  return (
    <div className="mb-5 space-y-3">
      {error && (
        <p
          role="alert"
          className="rounded-md border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive"
        >
          {error}
        </p>
      )}

      <div className="grid grid-cols-2 items-center justify-center gap-3">
        <GoogleAuthButton clientId={googleClientId} loading={loading} />
        {xEnabled && !loading ? (
          <Button asChild className="secondary-btn h-10 w-full rounded-md">
            <a
              aria-label="Continue with X"
              href={xLoginStartPath(next, register)}
            >
              <SiX className="size-4" />
            </a>
          </Button>
        ) : (
          <Button
            type="button"
            className="secondary-btn h-10 w-full rounded-md"
            aria-label="Continue with X"
            disabled
            title="X sign-in is currently unavailable"
          >
            <SiX className="size-4" />
          </Button>
        )}
      </div>
      {!loading && (!googleClientId || !xEnabled) && (
        <p className="text-center text-xs leading-5 text-muted-foreground">
          {!googleClientId && !xEnabled
            ? "Social sign-in is currently unavailable. You can use email below."
            : !xEnabled
              ? "X sign-in is currently unavailable. You can use Google or email."
              : "Google sign-in is currently unavailable. You can use X or email."}
        </p>
      )}
      <div className="relative pt-2 text-center">
        <div className="absolute inset-x-0 top-[calc(50%+4px)] border-t border-border" />
        <span className="relative bg-background px-3 text-xs text-muted-foreground">
          or use email
        </span>
      </div>
    </div>
  );
}

export default function SocialAuthButtons({
  register = false,
  initialConfig,
}: {
  register?: boolean;
  initialConfig?: AuthProviderConfig | null;
}) {
  const trpc = useTRPC();
  const search = useSearchParams();
  const config = useQuery(
    trpc.user.authConfig.queryOptions(undefined, {
      retry: false,
      staleTime: 300_000,
      initialData: initialConfig || undefined,
      enabled: !initialConfig,
    }),
  );
  const providers = initialConfig || config.data;
  return (
    <SocialAuthChoices
      register={register}
      googleClientId={providers?.google_client_id}
      xEnabled={providers?.x_login_enabled}
      loading={!providers && config.isPending}
      next={safeAuthRedirect(search.get("next") || search.get("redirect"))}
      error={socialErrorMessage(search.get("social_error"))}
    />
  );
}
