"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useMutation } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTRPCClient } from "@/trpc/client";
import { authRetrySeconds } from "../authFlow";

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const trpc = useTRPCClient();
  useEffect(() => {
    if (!cooldown) return;
    const timer = window.setInterval(
      () => setCooldown((value) => Math.max(0, value - 1)),
      1000,
    );
    return () => window.clearInterval(timer);
  }, [cooldown]);
  const request = useMutation({
    mutationFn: (input: { email: string }) =>
      trpc.user.forgotPassword.mutate(input),
    onSuccess(result) {
      setNotice(result.message);
      setError("");
      setCooldown(result.retry_after || 60);
    },
    onError(err) {
      setError(err.message || "Could not request a reset link");
      setCooldown(authRetrySeconds(err));
    },
  });
  return (
    <div className="space-y-4">
      <form
        method="post"
        onSubmit={(event) => {
          event.preventDefault();
          request.mutate({ email: email.trim() });
        }}
        className="space-y-4"
      >
        <div>
          <label
            htmlFor="forgot-email"
            className="mb-1.5 block text-xs font-medium"
          >
            Email address
          </label>
          <Input
            className="rounded-md border-border !bg-input/30"
            id="forgot-email"
            type="email"
            required
            autoComplete="email"
            value={email}
            disabled={request.isPending}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
          />
        </div>
        {notice && (
          <p role="status" className="text-sm leading-6 text-muted-foreground">
            {notice}. Check your inbox and spam folder. Reset links expire after
            20 minutes.
          </p>
        )}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <Button
          type="submit"
          disabled={request.isPending || cooldown > 0 || !email.trim()}
          className="primary-btn w-full rounded-md"
        >
          {request.isPending && (
            <Loader2 className="mr-2 size-4 animate-spin" />
          )}
          {request.isPending
            ? "Sending…"
            : cooldown
              ? `Send again in ${cooldown}s`
              : "Send reset link"}
        </Button>
      </form>
      <Link
        href="/login"
        className="secondary-btn flex w-full justify-center rounded-md"
      >
        Back to sign in
      </Link>
    </div>
  );
}
