"use client";

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
import { AppSidebar } from "@/components/base/AppSidebar";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

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
      onSuccess: async () => {
        toast.success("Welcome back");
        await queryClient.clear();
        const nextPath = new URLSearchParams(window.location.search).get(
          "next",
        );
        window.location.assign(
          nextPath?.startsWith("/") && !nextPath.startsWith("//")
            ? nextPath
            : "/onboarding/connect-account",
        );
      },
      onError: (error) => toast.error(error.message),
    }),
  );

  const onSubmit = async (values: LoginFormValues) => login.mutate(values);

  return (
    <div className="w-full max-w-sm">
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="space-y-4"
        noValidate
      >
        <div>
          <label
            htmlFor="login-email"
            className="mb-1.5 block text-xs font-medium text-foreground"
          >
            Email address
          </label>
          <Input
            id="login-email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            className="rounded-md border-border !bg-input/30   text-foreground placeholder:text-muted-foreground focus-visible:ring-1"
            {...form.register("email")}
          />
          {form.formState.errors.email && (
            <p className="mt-1 text-xs text-destructive">
              {form.formState.errors.email.message}
            </p>
          )}
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label
              htmlFor="login-password"
              className="block text-xs font-medium text-foreground"
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
            type="text"
            autoComplete="current-password"
            placeholder="Your password"
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
          disabled={login.isPending}
          className="w-full !rounded-md primary-btn  font-medium"
        >
          {login.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {login.isPending ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      <p className="mt-4 text-center text-xs text-muted-foreground">
        Don&apos;t have an account?{" "}
        <Link
          href="/register"
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          Sign up
        </Link>
      </p>
    </div>
  );
}
