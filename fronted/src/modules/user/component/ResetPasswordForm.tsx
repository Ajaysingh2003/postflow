"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTRPCClient } from "@/trpc/client";

export default function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const trpc = useTRPCClient();
  const [password, setPassword] = useState("");

  const reset = useMutation({
    mutationFn: (input: { token: string; password: string }) =>
      trpc.user.resetPassword.mutate(input),
    onSuccess: () => {
      toast.success("Password updated");
      router.replace("/login");
    },
    onError: (error) => toast.error(error.message || "Failed to update password"),
  });

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    reset.mutate({ token, password });
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
      <div>
        <label
          htmlFor="new-password"
          className="mb-1.5 block text-xs font-medium text-foreground"
        >
          New password
        </label>
        <Input
          id="new-password"
          type="password"
          minLength={8}
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="At least 8 characters"
          className="rounded-md border-border bg-background text-foreground placeholder:text-muted-foreground focus-visible:ring-1"
        />
      </div>

      <Button
        type="submit"
        disabled={reset.isPending || !token}
        className="w-full rounded-md font-medium"
      >
        {reset.isPending && (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        )}
        {reset.isPending ? "Updating…" : "Update password"}
      </Button>
    </form>
  );
}