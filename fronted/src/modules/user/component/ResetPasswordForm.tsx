"use client";

import { reloadAuthPage } from "../authFlow";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTRPCClient } from "@/trpc/client";
import { passwordSchema } from "../authFlow";

export default function ResetPasswordForm({ token }: { token: string }) {
  const trpc = useTRPCClient();
  const queryClient = useQueryClient();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const reset = useMutation({
    mutationFn: (input: { token: string; password: string }) =>
      trpc.user.resetPassword.mutate(input),
    onSuccess() {
      queryClient.clear();
      toast.success("Password updated. Sign in with your new password");
      reloadAuthPage("/login?password_reset=1");
    },
    onError(err) {
      setError(err.message || "Could not update your password");
    },
  });
  if (!token)
    return (
      <div className="space-y-4">
        <p role="alert" className="text-sm text-muted-foreground">
          This reset link is missing or incomplete. Request a new one.
        </p>
        <Link
          href="/forgot-password"
          className="secondary-btn inline-flex rounded-md"
        >
          Get a new reset link
        </Link>
      </div>
    );
  return (
    <form
      method="post"
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        const parsed = passwordSchema.safeParse(password);
        if (!parsed.success) {
          setError(parsed.error.issues[0].message);
          return;
        }
        if (password !== confirm) {
          setError("Passwords don’t match");
          return;
        }
        setError("");
        reset.mutate({ token, password });
      }}
    >
      <div>
        <label
          htmlFor="new-password"
          className="mb-1.5 block text-xs font-medium"
        >
          New password
        </label>
        <Input
          className="rounded-md border-border !bg-input/30"
          id="new-password"
          type="password"
          autoComplete="new-password"
          minLength={10}
          maxLength={200}
          required
          disabled={reset.isPending}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="At least 10 characters"
        />
      </div>
      <div>
        <label
          htmlFor="confirm-password"
          className="mb-1.5 block text-xs font-medium"
        >
          Confirm password
        </label>
        <Input
          className="rounded-md border-border !bg-input/30"
          id="confirm-password"
          type="password"
          autoComplete="new-password"
          required
          disabled={reset.isPending}
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
        />
      </div>
      {error && (
        <div role="alert" className="space-y-2">
          <p className="text-sm text-destructive">{error}</p>
          <Link href="/forgot-password" className="text-xs underline">
            Request another reset link
          </Link>
        </div>
      )}
      <Button
        type="submit"
        disabled={reset.isPending || !password || !confirm}
        className="primary-btn w-full rounded-md"
      >
        {reset.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
        {reset.isPending ? "Updating…" : "Update password"}
      </Button>
    </form>
  );
}
