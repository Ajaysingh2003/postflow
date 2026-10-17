"use client";
import Link from "next/link";
import { reloadAuthPage } from "@/modules/user/authFlow";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Mail, Users, CircleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTRPC } from "@/trpc/client";

export default function InvitationView({
  token,
  preview,
  email,
  error,
}: {
  token: string;
  preview?: {
    status: "pending" | "accepted";
    workspace_name?: string;
    role?: string;
    email_hint?: string;
    expires_at?: string;
  } | null;
  email?: string | null;
  error?: string | null;
}) {
  const trpc = useTRPC();
  const cache = useQueryClient();
  const next = `/invitations/accept?${new URLSearchParams({ token })}`;
  const accept = useMutation(
    trpc.workspace.acceptInvitation.mutationOptions({
      onSuccess: () => {
        cache.clear();
        reloadAuthPage("/dashboard");
      },
    }),
  );
  const logout = useMutation(
    trpc.user.logout.mutationOptions({
      onSuccess: () => {
        cache.clear();
        reloadAuthPage(`/login?${new URLSearchParams({ next })}`);
      },
    }),
  );
  const message = error || accept.error?.message || logout.error?.message;
  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#faf9f5] px-4 py-12 dark:bg-background">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-7 shadow-sm sm:p-9">
        <Link href="/" className="font-heading text-xl font-semibold">
          draftva.
        </Link>
        <div className="mb-5 mt-9 flex size-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-700">
          <Users className="size-6" />
        </div>
        <h1 className="font-heading text-3xl font-semibold tracking-tight">
          {error
            ? "Invitation unavailable"
            : preview?.status === "accepted"
              ? "Invitation already accepted"
              : `Join ${preview?.workspace_name ?? "your team"}`}
        </h1>
        {preview?.status === "pending" && (
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            You’ve been invited to collaborate as{" "}
            <strong className="font-medium text-foreground">
              {preview.role}
            </strong>
            . Accept with the email address that received this invitation.
          </p>
        )}
        {preview?.email_hint && (
          <p className="my-5 flex items-center gap-2 rounded-lg bg-muted/50 p-3 text-sm">
            <Mail className="size-4 shrink-0" />
            {preview.email_hint}
          </p>
        )}
        {message && (
          <p
            role="alert"
            className="my-5 flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-sm leading-6"
          >
            <CircleAlert className="mt-1 size-4 shrink-0" />
            {message}
          </p>
        )}
        {preview?.status === "pending" &&
          !error &&
          (email ? (
            <div className="mt-6 space-y-3">
              <p className="break-all text-xs text-muted-foreground">
                Signed in as {email}
              </p>
              <Button
                className="primary-btn w-full"
                disabled={accept.isPending || logout.isPending}
                onClick={() => accept.mutate({ token })}
              >
                {accept.isPending ? "Joining workspace…" : "Accept invitation"}
                <ArrowRight className="size-4" />
              </Button>
              <Button
                variant="outline"
                className="secondary-btn w-full"
                disabled={accept.isPending || logout.isPending}
                onClick={() => logout.mutate()}
              >
                {logout.isPending ? "Signing out…" : "Use a different account"}
              </Button>
            </div>
          ) : (
            <div className="mt-6 grid gap-3">
              <Link
                className="primary-btn justify-center rounded-lg"
                href={`/login?${new URLSearchParams({ next })}`}
              >
                Sign in to accept
                <ArrowRight className="size-4" />
              </Link>
              <Link
                className="secondary-btn justify-center rounded-lg"
                href={`/register?${new URLSearchParams({ next })}`}
              >
                Create an account
              </Link>
            </div>
          ))}
        {preview?.status === "accepted" && (
          <p className="mt-4 text-sm leading-6 text-muted-foreground">
            This link has already been used. Sign in to your account to open
            your workspaces.
          </p>
        )}
        {(error || preview?.status === "accepted") && (
          <Link href="/dashboard" className="secondary-btn mt-6 justify-center">
            {email ? "Go to workspace" : "Sign in"}
          </Link>
        )}
        {error?.includes("retry") && (
          <Button
            variant="ghost"
            className="mt-3 w-full"
            onClick={() => window.location.reload()}
          >
            Try again
          </Button>
        )}
        <p className="mt-7 text-xs leading-5 text-muted-foreground">
          Invitations expire after 7 days. Need another link? Ask your workspace
          owner.
        </p>
      </div>
    </main>
  );
}
