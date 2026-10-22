"use client";

import {
  emailSchema,
  linkTokenSchema,
  verificationInputSchema,
} from "../contracts";
import { reloadAuthPage } from "../authFlow";

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { useTRPCClient } from "@/trpc/client";
import { authRetrySeconds, nextAuthPath } from "../authFlow";

export default function VerifyOTPForm({
  email: initialEmail = "",
  token = "",
  initialCooldown = 0,
  initialError = "",
}: {
  email?: string;
  token?: string;
  initialCooldown?: number;
  initialError?: string;
}) {
  const trpc = useTRPCClient();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState(/^[0-9]{6}$/.test(token) ? token : "");
  const [cooldown, setCooldown] = useState(initialCooldown);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState(
    token &&
      !/^[0-9]{6}$/.test(token) &&
      !linkTokenSchema.safeParse(token).success
      ? "This verification link is invalid. Request a new code below."
      : initialError,
  );
  const legacyLink = linkTokenSchema.safeParse(token).success;

  useEffect(() => {
    if (!cooldown) return;
    const timer = window.setInterval(
      () => setCooldown((value) => Math.max(0, value - 1)),
      1000,
    );
    return () => window.clearInterval(timer);
  }, [cooldown]);

  const verify = useMutation({
    mutationFn: (input: { email?: string; token: string }) =>
      trpc.user.verifyEmail.mutate(input),
    onSuccess(result) {
      toast.success("Email verified");
      queryClient.clear();
      reloadAuthPage(
        result.authenticated
          ? nextAuthPath(window.location.search)
          : "/login?verified=1",
      );
    },
    onError(err) {
      setNotice("");
      setError(err.message || "Code could not be verified");
    },
  });
  const resend = useMutation({
    mutationFn: (input: { email: string }) =>
      trpc.user.resendVerification.mutate(input),
    onSuccess(result) {
      if (result.already_verified) {
        queryClient.clear();
        reloadAuthPage(nextAuthPath(window.location.search));
        return;
      }
      if (result.email) setEmail(result.email);
      setNotice(result.delivery_status === "failed" ? "" : result.message);
      setCode("");
      setError(result.delivery_status === "failed" ? result.message : "");
      setCooldown(result.retry_after ?? 0);
    },
    onError(err) {
      setNotice("");
      setError(err.message || "Could not send a code");
      setCooldown(authRetrySeconds(err));
    },
  });
  const logout = useMutation({
    mutationFn: () => trpc.user.logout.mutate(),
    onSuccess() {
      queryClient.clear();
      reloadAuthPage("/login");
    },
    onError(err) {
      setNotice("");
      setError(err.message || "Could not sign out");
    },
  });

  const busy = verify.isPending || resend.isPending || logout.isPending;

  return (
    <div className="space-y-4">
      <form
        method="post"
        onSubmit={(event) => {
          event.preventDefault();
          if (busy) return;
          setError("");
          setNotice("");
          const parsed = verificationInputSchema.safeParse({
            email: email.trim() || undefined,
            token: legacyLink ? token : code,
          });
          if (!parsed.success) {
            setError(parsed.error.issues[0].message);
            return;
          }
          verify.mutate(parsed.data);
        }}
        className="space-y-4"
      >
        {!legacyLink && (
          <>
            <div>
              <label
                htmlFor="verification-email"
                className="mb-1.5 block text-xs font-medium"
              >
                Email address
              </label>
              <Input
                className="rounded-md border-border !bg-input/30"
                id="verification-email"
                type="email"
                autoComplete="email"
                required
                maxLength={254}
                value={email}
                disabled={busy}
                onChange={(event) => {
                  setEmail(event.target.value);
                  setCode("");
                  setError("");
                  setNotice("");
                }}
              />
            </div>
            <div>
              <label
                htmlFor="verification-token"
                className="mb-2 block text-xs font-medium"
              >
                6-digit code
              </label>
              <InputOTP
                id="verification-token"
                maxLength={6}
                pattern="^[0-9]*$"
                inputMode="numeric"
                autoComplete="one-time-code"
                disabled={busy}
                value={code}
                onChange={(value) => {
                  setCode(value.replace(/\D/g, ""));
                  setError("");
                  setNotice("");
                }}
                containerClassName="w-full"
              >
                <InputOTPGroup className="flex w-full gap-2">
                  {Array.from({ length: 6 }, (_, index) => (
                    <InputOTPSlot
                      key={index}
                      index={index}
                      className="h-11 flex-1 !rounded-md border border-border"
                    />
                  ))}
                </InputOTPGroup>
              </InputOTP>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                Use the latest code. Its expiry time is shown in the email.
              </p>
            </div>
          </>
        )}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        {notice && (
          <p role="status" className="text-sm text-muted-foreground">
            {notice}
          </p>
        )}
        <Button
          type="submit"
          disabled={
            busy || (!legacyLink && (code.length !== 6 || !email.trim()))
          }
          className="primary-btn w-full rounded-md"
        >
          {verify.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
          {verify.isPending
            ? "Verifying…"
            : legacyLink
              ? "Confirm email verification"
              : "Verify email"}
        </Button>
      </form>
      {!legacyLink && (
        <Button
          type="button"
          className="secondary-btn w-full rounded-md"
          disabled={busy || cooldown > 0 || !email.trim()}
          onClick={() => {
            if (busy || cooldown > 0) return;
            setNotice("");
            setError("");
            const parsed = emailSchema.safeParse(email);
            if (!parsed.success) {
              setError(parsed.error.issues[0].message);
              return;
            }
            resend.mutate({ email: parsed.data });
          }}
        >
          {resend.isPending
            ? "Sending code…"
            : cooldown > 0
              ? `Resend code in ${cooldown}s`
              : "Send a new code"}
        </Button>
      )}
      <button
        type="button"
        disabled={busy || logout.isPending}
        className="w-full text-center text-xs text-muted-foreground hover:underline"
        onClick={() => logout.mutate()}
      >
        Sign in with another account
      </button>
    </div>
  );
}
