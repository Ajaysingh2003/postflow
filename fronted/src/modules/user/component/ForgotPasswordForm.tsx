"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTRPCClient } from "@/trpc/client";

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const trpc = useTRPCClient();

  const request = useMutation({
    mutationFn: (input: { email: string }) =>
      trpc.user.forgotPassword.mutate(input),
    onSuccess: () =>
      toast.success("If the account exists, a reset email has been sent"),
    onError: (error) => toast.error(error.message || "Request failed"),
  });

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    request.mutate({ email });
  };

  return (
    <div className="w-full max-w-sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="forgot-email"
            className="mb-1.5 block text-xs font-medium text-foreground"
          >
            Email address
          </label>
          <Input
            id="forgot-email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            className="rounded-md border-border !bg-input/30 text-foreground placeholder:text-muted-foreground focus-visible:ring-1"
          />
        </div>

        <Button
          type="submit"
          disabled={request.isPending}
          className="w-full primary-btn rounded-md font-medium"
        >
          {request.isPending && (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          )}
          {request.isPending ? "Sending…" : "Send reset link"}
        </Button>
      </form>

      <p className="mt-4 text-center text-xs text-muted-foreground">
        Remember your password?{" "}
        <Link
          href="/login"
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          Back to sign in
        </Link>
      </p>
    </div>
  );
}