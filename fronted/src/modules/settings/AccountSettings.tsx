"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { Check, LogOut, Mail, Monitor, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useTRPC } from "@/trpc/client";
import type { AuthUser } from "@/modules/user/types";

function initials(user: Pick<AuthUser, "name" | "email">) {
  const words = (user.name || user.email).trim().split(/\s+/).filter(Boolean);
  const letters =
    words.length > 1 ? words[0][0] + words[1][0] : (words[0] ?? "?").slice(0, 2);
  return letters.toUpperCase();
}

function SectionHeading({
  icon,
  children,
}: {
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <h3 className="flex items-center gap-2 text-sm font-semibold tracking-tight">
      {icon}
      {children}
    </h3>
  );
}

export function ProfileForm({
  user,
  saving,
  onSave,
  onDirty,
}: {
  user: AuthUser;
  saving: boolean;
  onSave: (name: string) => void;
  onDirty?: (dirty: boolean) => void;
}) {
  const [name, setName] = useState(user.name);
  const unchanged = name.trim() === user.name;

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <div
          aria-hidden
          className="flex size-14 shrink-0 items-center justify-center rounded-full bg-violet-500/10 text-lg font-semibold tracking-wide text-violet-600 ring-1 ring-violet-500/20"
        >
          {initials(user)}
        </div>
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold tracking-tight">
            {user.name}
          </h3>
          <p className="mt-0.5 break-all text-[13px] text-muted-foreground">
            {user.email}
          </p>
        </div>
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (name.trim()) onSave(name.trim());
        }}
        className="space-y-2.5"
      >
        <label
          htmlFor="settings-name"
          className="block text-sm font-semibold tracking-tight"
        >
          Your name
        </label>
        <Input
        
          id="settings-name"
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            onDirty?.(event.target.value.trim() !== user.name);
          }}
          maxLength={160}
          required
          autoComplete="name"
          disabled={saving}
          aria-describedby="settings-name-hint"
          className="h-10 max-w-md rounded-lg"
        />
        <p id="settings-name-hint" className="text-[13px] text-muted-foreground">
          Shown to people in your workspace.
        </p>
        <div className="pt-1.5">
          <Button
            type="submit"
            className="primary-btn"
            disabled={saving || !name.trim() || unchanged}
          >
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </form>

      <section className="space-y-3 border-t border-border/70 pt-6">
        <div className="space-y-1">
          <SectionHeading>Email</SectionHeading>
          <p className="text-[13px] leading-5 text-muted-foreground">
            Your sign-in and account email.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/70 bg-muted/20 px-4 py-3">
          <span className="min-w-0 break-all text-sm">{user.email}</span>
          <span
            className={cn(
              "flex items-center gap-1.5 text-xs font-medium",
              user.email_verified ? "text-emerald-700" : "text-amber-700",
            )}
          >
            {user.email_verified ? (
              <>
                <Check aria-hidden className="size-3.5" />
                Verified
              </>
            ) : (
              "Verification required"
            )}
          </span>
        </div>
      </section>
    </div>
  );
}

export function ProfileSettings({
  onDirty,
}: {
  onDirty?: (dirty: boolean) => void;
}) {
  const trpc = useTRPC();
  const client = useQueryClient();
  const router = useRouter();
  const { data: user } = useSuspenseQuery(trpc.user.me.queryOptions());

  const save = useMutation(
    trpc.user.updateProfile.mutationOptions({
      onSuccess: async () => {
        onDirty?.(false);
        await Promise.all([
          client.invalidateQueries({ queryKey: trpc.user.me.queryKey() }),
          client.invalidateQueries({ queryKey: trpc.user.profile.queryKey() }),
          client.invalidateQueries({
            queryKey: trpc.workspace.members.queryKey(),
          }),
        ]);
        router.refresh();
        toast.success("Name updated");
      },
      onError: (error) => toast.error(error.message),
    }),
  );

  return (
    <ProfileForm
      key={`${user.id}:${user.name}`}
      user={user}
      saving={save.isPending}
      onSave={(name) => save.mutate({ name })}
      onDirty={onDirty}
    />
  );
}

const sessionDate = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

export function SecuritySettings() {
  const trpc = useTRPC();
  const client = useQueryClient();
  const router = useRouter();
  const { data: user } = useSuspenseQuery(trpc.user.me.queryOptions());
  const { data: sessions } = useSuspenseQuery(
    trpc.user.listSessions.queryOptions(undefined, { staleTime: 15000 }),
  );
  const [confirmAll, setConfirmAll] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (!cooldown) return;
    const timer = window.setTimeout(
      () => setCooldown((value) => Math.max(0, value - 1)),
      1000,
    );
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  const error = (err: { message: string }) => toast.error(err.message);
  const finish = () => {
    client.clear();
    router.replace("/login");
    router.refresh();
  };

  const logout = useMutation(
    trpc.user.logout.mutationOptions({ onSuccess: finish, onError: error }),
  );
  const logoutAll = useMutation(
    trpc.user.logoutAll.mutationOptions({
      onSuccess: finish,
      onError: () => {
        toast.error(
          "Couldn’t end every session. Please sign in and try again.",
        );
        finish();
      },
    }),
  );
  const revoke = useMutation(
    trpc.user.revokeSession.mutationOptions({
      onSuccess: () => {
        void client.invalidateQueries({
          queryKey: trpc.user.listSessions.queryKey(),
        });
        toast.success("Session ended");
      },
      onError: error,
    }),
  );
  const reset = useMutation(
    trpc.user.forgotPassword.mutationOptions({
      onSuccess: (data) => {
        setResetSent(true);
        setCooldown(data.retry_after || 60);
      },
      onError: error,
    }),
  );
  const pending = logout.isPending || logoutAll.isPending || revoke.isPending;

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <div className="space-y-1">
          <SectionHeading
            icon={<ShieldCheck aria-hidden className="size-4 text-violet-500" />}
          >
            Password
          </SectionHeading>
          <p className="text-[13px] leading-5 text-muted-foreground">
            Send a secure link to{" "}
            <span className="break-all font-medium text-foreground">
              {user.email}
            </span>{" "}
            to set or reset your password.
          </p>
        </div>
        <Button
          className="secondary-btn"
          variant="outline"
          disabled={reset.isPending || cooldown > 0}
          onClick={() => reset.mutate({ email: user.email })}
        >
          <Mail aria-hidden className="size-4" />
          {reset.isPending
            ? "Sending…"
            : cooldown > 0
              ? `Resend in ${cooldown}s`
              : "Send password reset email"}
        </Button>
        {resetSent && (
          <p
            role="status"
            className="flex items-center gap-1.5 text-[13px] text-emerald-700"
          >
            <Check aria-hidden className="size-3.5" />
            Check your inbox for the reset link.
          </p>
        )}
      </section>

      <section className="space-y-3 border-t border-border/70 pt-6">
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-3">
            <SectionHeading>Active sessions</SectionHeading>
            <span className="text-xs tabular-nums text-muted-foreground">
              {sessions.length} active
            </span>
          </div>
          <p className="text-[13px] text-muted-foreground">
            End a session to sign out that device.
          </p>
        </div>
        <ul className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border/70">
          {sessions.map((session) => (
            <li
              key={session.id}
              className="flex flex-wrap items-center gap-3 px-4 py-3.5"
            >
              <span
                aria-hidden
                className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted/50 text-muted-foreground"
              >
                <Monitor className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium">
                  {session.current ? "This session" : "Signed-in session"}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Started {sessionDate.format(new Date(session.created_at))}
                </p>
              </div>
              {session.current ? (
                <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-700">
                  Current
                </span>
              ) : (
                <Button
                  variant="outline"
                  className="secondary-btn !text-xs"
                  disabled={pending}
                  onClick={() => revoke.mutate({ sessionId: session.id })}
                >
                  {revoke.isPending &&
                  revoke.variables?.sessionId === session.id
                    ? "Ending…"
                    : "End session"}
                </Button>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3 border-t border-border/70 pt-6">
        <SectionHeading>Sign out</SectionHeading>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            className="secondary-btn"
            disabled={pending}
            onClick={() => logout.mutate()}
          >
            <LogOut aria-hidden className="size-4" />
            {logout.isPending ? "Signing out…" : "Sign out"}
          </Button>
          <Button
            variant="outline"
            className="secondary-btn"
            disabled={pending}
            aria-expanded={confirmAll}
            onClick={() => setConfirmAll(true)}
          >
            Sign out everywhere
          </Button>
        </div>
        {confirmAll && (
          <div
            role="alert"
            className="space-y-3 rounded-xl border border-amber-500/25 bg-amber-500/5 p-4"
          >
            <p className="flex items-start gap-2 text-[13px] leading-5">
              <span
                aria-hidden
                className="mt-[7px] size-1.5 shrink-0 rounded-full bg-amber-500"
              />
              End all sessions, including this one? You’ll need to sign in again
              on every device.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                className="secondary-btn"
                disabled={pending}
                onClick={() => setConfirmAll(false)}
              >
                Cancel
              </Button>
              <Button
                className="primary-btn"
                disabled={pending}
                onClick={() => logoutAll.mutate()}
              >
                {logoutAll.isPending ? "Signing out…" : "Confirm sign out"}
              </Button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}