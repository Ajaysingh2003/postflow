"use client";

import { reloadAuthPage } from "../authFlow";

import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useMutation } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTRPCClient } from "@/trpc/client";

import { registerSchema, nextAuthPath, verificationPath } from "../authFlow";

type RegisterFormValues = z.infer<typeof registerSchema>;

export default function RegisterForm() {
  const trpc = useTRPCClient();

  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { display_name: "", email: "", password: "" },
  });

  const registerMutation = useMutation({
    mutationFn: (values: RegisterFormValues) =>
      trpc.user.register.mutate(values),
    onSuccess: (result) => {
      if (result.verification_required) {
        toast.success(
          result.verification_sent
            ? "Check your email for the verification code"
            : "Account created. Request a verification code to continue",
        );
        reloadAuthPage(
          verificationPath(
            result.user.email,
            nextAuthPath(window.location.search),
            result.verification_sent,
          ),
        );
        return;
      }

      toast.success("Account created. You can sign in now.");
      reloadAuthPage(nextAuthPath(window.location.search));
    },
    onError: (error) => toast.error(error.message || "Registration failed"),
  });

  const submitRegistration = (values: RegisterFormValues) => {
    registerMutation.mutate(values);
  };

  return (
    <div className="w-full max-w-sm">
      <form
        method="post"
        onSubmit={form.handleSubmit(submitRegistration)}
        className="space-y-4"
        noValidate
      >
        <div>
          <label
            htmlFor="register-name"
            className="mb-1.5 block text-xs font-medium text-foreground"
          >
            Name
          </label>
          <Input
            id="register-name"
            autoComplete="name"
            placeholder="Your name"
            className="rounded-md border-border !bg-input/30 text-foreground placeholder:text-muted-foreground focus-visible:ring-1"
            {...form.register("display_name")}
          />
          {form.formState.errors.display_name && (
            <p className="mt-1 text-xs text-destructive">
              {form.formState.errors.display_name.message}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="register-email"
            className="mb-1.5 block text-xs font-medium text-foreground"
          >
            Email address
          </label>
          <Input
            id="register-email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            className="rounded-md border-border !bg-input/30 text-foreground placeholder:text-muted-foreground focus-visible:ring-1"
            {...form.register("email")}
          />
          {form.formState.errors.email && (
            <p className="mt-1 text-xs text-destructive">
              {form.formState.errors.email.message}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="register-password"
            className="mb-1.5 block text-xs font-medium text-foreground"
          >
            Password
          </label>
          <Input
            id="register-password"
            type="password"
            autoComplete="new-password"
            placeholder="At least 10 characters"
            className="rounded-md border-border !bg-input/30 text-foreground placeholder:text-muted-foreground focus-visible:ring-1"
            {...form.register("password")}
          />
          {form.formState.errors.password && (
            <p className="mt-1 text-xs text-destructive">
              {form.formState.errors.password.message}
            </p>
          )}
        </div>

        <Button
          type="submit"
          disabled={registerMutation.isPending}
          className="w-full !rounded-md primary-btn font-medium"
        >
          {registerMutation.isPending && (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          )}
          {registerMutation.isPending ? "Creating account…" : "Create account"}
        </Button>
      </form>

      <p className="mt-4 text-center text-xs text-muted-foreground">
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
