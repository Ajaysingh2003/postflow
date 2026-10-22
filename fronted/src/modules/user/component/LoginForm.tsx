"use client";

import { reloadAuthPage } from "../authFlow";

import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTRPC } from "@/trpc/client";

import { loginSchema, nextAuthPath, verificationPath } from "../authFlow";

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginForm() {
  const queryClient = useQueryClient();
  const trpc = useTRPC();

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const login = useMutation(
    trpc.user.login.mutationOptions({
      onSuccess: async (result) => {
        toast.success(
          result.verification_required
            ? "Verify your email to continue"
            : "Welcome back",
        );
        await queryClient.clear();
        const next = nextAuthPath(window.location.search);
        reloadAuthPage(
          result.verification_required
            ? verificationPath(result.user.email, next)
            : next,
        );
      },
      onError: (error) =>
        form.setError("root.server", { message: error.message }),
    }),
  );

  const onSubmit = (values: LoginFormValues) => {
    if (login.isPending) return;
    form.clearErrors("root");
    login.mutate(values);
  };

  return (
    <div className="w-full ">
      <form
        method="post"
        onSubmit={form.handleSubmit(onSubmit)}
        className="space-y-4"
        noValidate
      >
        <div>
          <label
            htmlFor="login-email"
            className="mb-1.5 block text-[14px] font-medium text-foreground"
          >
            Email address
          </label>
          <Input
            id="login-email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            className="rounded-md border-border !bg-input/30   text-foreground placeholder:text-muted-foreground focus-visible:ring-1"
            disabled={login.isPending}
            aria-invalid={!!form.formState.errors.email}
            aria-describedby={
              form.formState.errors.email ? "email-error" : undefined
            }
            {...form.register("email")}
          />
          {form.formState.errors.email && (
            <p
              id="email-error"
              role="alert"
              className="mt-1 text-xs text-destructive"
            >
              {form.formState.errors.email.message}
            </p>
          )}
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label
              htmlFor="login-password"
              className="block text-[14px] font-medium text-foreground"
            >
              Password
            </label>
            <Link
              href="/forgot-password"
              className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground hover:underline"
            >
              Forgot password?
            </Link>
          </div>

          <Input
            id="login-password"
            type="password"
            autoComplete="current-password"
            placeholder="Your password"
            className="rounded-md border-border !bg-input/30 text-foreground placeholder:text-muted-foreground focus-visible:ring-1"
            disabled={login.isPending}
            aria-invalid={!!form.formState.errors.password}
            aria-describedby={
              form.formState.errors.password ? "password-error" : undefined
            }
            {...form.register("password")}
          />
          {form.formState.errors.password && (
            <p
              id="password-error"
              role="alert"
              className="mt-1 text-xs text-destructive"
            >
              {form.formState.errors.password.message}
            </p>
          )}
        </div>

        {form.formState.errors.root?.server && (
          <p role="alert" className="text-sm text-destructive">
            {form.formState.errors.root.server.message}
          </p>
        )}
        <Button
          type="submit"
          disabled={login.isPending}
          className="w-full !rounded-md primary-btn  font-medium"
        >
          {login.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {login.isPending ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </div>
  );
}
