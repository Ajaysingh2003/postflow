import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Check,
  CheckCheck,
  Loader2,
  PenLine,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  CHANNELS,
  type ChannelConfig,
} from "@/modules/channels/channel-config";
import ChannelIcon from "@/modules/channels/component/ChannelIcon";
import type { Account } from "@/modules/studio/types";
import OnboardingShell from "./OnboardingShell";

export type OnboardingStep = "welcome" | "connect";
export const ONBOARDING_CHANNELS = CHANNELS.filter(
  (channel) => !channel.comingSoon,
);

function DraftPreview() {
  return (
    <div
      aria-hidden="true"
      className="relative hidden min-h-[380px] items-center justify-center overflow-hidden rounded-2xl bg-[#edf2e9] px-7 py-10 md:flex dark:bg-muted/40"
    >
      <div className="absolute -right-16 -top-16 size-64 rounded-full border border-emerald-900/10" />
      <div className="absolute -bottom-24 -left-12 size-72 rounded-full border border-emerald-900/10" />
      <div className="relative w-full max-w-[285px]">
        <div className="absolute inset-0 translate-x-2 translate-y-3 rotate-3 rounded-2xl border border-border bg-white/65 dark:bg-card" />
        <div className="relative rounded-2xl border border-border/60 bg-card p-6 shadow-sm">
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <PenLine className="size-3" /> Your next good idea
            </span>
            <span className="size-1.5 rounded-full bg-brand-primary" />
          </div>
          <p className="mb-5 mt-6 font-heading text-[25px] leading-tight">
            Small ideas can start
            <br />
            big conversations.
          </p>
          <div className="space-y-2">
            <div className="h-1.5 w-full rounded bg-muted" />
            <div className="h-1.5 w-5/6 rounded bg-muted" />
            <div className="h-1.5 w-2/3 rounded bg-muted" />
          </div>
          <div className="mt-7 flex items-center justify-between border-t border-border/60 pt-4">
            <div className="flex -space-x-2">
              {["x", "linkedin", "threads"].map((id) => (
                <span key={id} className="rounded-2xl border-2 border-card">
                  <ChannelIcon
                    small
                    channel={CHANNELS.find((channel) => channel.id === id)!}
                  />
                </span>
              ))}
            </div>
            <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-medium text-emerald-800">
              <CheckCheck className="size-3" /> Ready when you are
            </span>
          </div>
        </div>
        <p className="mt-7 text-center text-xs text-muted-foreground">
          One idea. Your voice. More places.
        </p>
      </div>
    </div>
  );
}

type Props = {
  name: string;
  step: OnboardingStep;
  accounts: Account[];
  canConnect: boolean;
  connectingPlatform: string | null;
  finishing: boolean;
  error?: string;
  onStep: (step: OnboardingStep) => void;
  onConnect: (channel: ChannelConfig) => void;
  onFinish: () => void;
};

export default function OnboardingPanel({
  name,
  step,
  accounts,
  canConnect,
  connectingPlatform,
  finishing,
  error,
  onStep,
  onConnect,
  onFinish,
}: Props) {
  const busy = finishing || !!connectingPlatform;
  const activeCount = accounts.filter(
    (account) => account.status === "active",
  ).length;
  return (
    <OnboardingShell
      action={
        <button
          type="button"
          onClick={onFinish}
          disabled={busy}
          className="rounded-lg px-2 py-1 text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50"
        >
          Skip setup{" "}
          <ArrowUpRight aria-hidden="true" className="ml-1 inline size-3" />
        </button>
      }
    >
      <ol
        aria-label="Setup progress"
        className="mb-6 flex items-center gap-2 self-center text-[11px] sm:mb-8"
      >
        <li
          aria-current={step === "welcome" ? "step" : undefined}
          className="flex items-center gap-2 text-foreground"
        >
          <span className="flex size-5 items-center justify-center rounded-full bg-emerald-100 text-emerald-800">
            {step === "connect" ? <Check className="size-3" /> : "1"}
          </span>{" "}
          Welcome
        </li>
        <li aria-hidden="true" className="mx-2 h-px w-8 bg-border" />
        <li
          aria-current={step === "connect" ? "step" : undefined}
          className={`flex items-center gap-2 ${step === "connect" ? "text-foreground" : "text-muted-foreground"}`}
        >
          <span
            className={`flex size-5 items-center justify-center rounded-full ${step === "connect" ? "bg-emerald-100 text-emerald-800" : "bg-muted"}`}
          >
            2
          </span>{" "}
          Your channels
        </li>
      </ol>
      <section
        aria-labelledby="onboarding-heading"
        className="rounded-3xl border border-border/80 bg-card p-6 shadow-sm sm:p-9 md:p-10"
      >
        {step === "welcome" ? (
          <div className="grid items-center gap-8 md:grid-cols-2 md:gap-10">
            <div>
              <p className="mb-4 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                Hey {name.trim().split(/\s+/)[0] || "there"}, welcome to Draftva
              </p>
              <h1
                id="onboarding-heading"
                tabIndex={-1}
                className="font-heading text-[38px] leading-[1.08] tracking-tight outline-none sm:text-[44px]"
              >
                Good ideas deserve
                <br />
                to get out there.
              </h1>
              <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted-foreground">
                Your space to write, plan, and share. Let’s make it yours in two
                quick steps.
              </p>
              <ul className="my-7 space-y-3 text-xs sm:text-sm">
                {[
                  {
                    Icon: PenLine,
                    text: "Write once. Make it work for each channel.",
                  },
                  {
                    Icon: Sparkles,
                    text: "A little AI help, still in your voice.",
                  },
                  {
                    Icon: CalendarDays,
                    text: "Pick a time. We’ll take it from there.",
                  },
                ].map(({ Icon, text }) => (
                  <li key={text} className="flex items-center gap-3">
                    <Icon
                      aria-hidden="true"
                      className="size-4 shrink-0 text-emerald-700 dark:text-emerald-400"
                    />
                    {text}
                  </li>
                ))}
              </ul>
              <Button
                onClick={() => onStep("connect")}
                disabled={busy}
                className="primary-btn h-11 w-full gap-2 rounded-xl px-6 sm:w-auto"
              >
                Let’s get started{" "}
                <ArrowRight aria-hidden="true" className="size-4" />
              </Button>
              <p className="mt-3 text-[11px] text-muted-foreground">
                No forms to fill. You’re almost in.
              </p>
            </div>
            <DraftPreview />
          </div>
        ) : (
          <div>
            <div className="mb-7 text-center">
              <p className="mb-3 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                Make yourself at home
              </p>
              <h1
                id="onboarding-heading"
                tabIndex={-1}
                className="font-heading text-3xl leading-tight tracking-tight outline-none sm:text-[38px]"
              >
                Where do you want to show up?
              </h1>
              <p className="mt-3 text-sm text-muted-foreground">
                Connect a channel now, or come back to this later.
              </p>
            </div>
            {canConnect ? (
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
                {ONBOARDING_CHANNELS.map((channel) => {
                  const matches = accounts.filter(
                    (account) => account.platform === channel.id,
                  );
                  const active = matches.find(
                    (account) => account.status === "active",
                  );
                  const reconnect =
                    !active &&
                    matches.some(
                      (account) => account.status === "needs_reauth",
                    );
                  const connecting = connectingPlatform === channel.id;
                  return (
                    <button
                      key={channel.id}
                      type="button"
                      disabled={busy || !!active}
                      onClick={() => onConnect(channel)}
                      aria-label={`${active ? "Connected to" : reconnect ? "Reconnect" : "Connect"} ${channel.name}`}
                      className={`group relative flex min-w-0 flex-col items-start gap-2 rounded-2xl border p-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-default sm:flex-row sm:items-center sm:gap-3 sm:p-4 ${active ? "border-emerald-200 bg-emerald-50/40 dark:border-emerald-900 dark:bg-emerald-950/20" : "border-border hover:border-emerald-400 hover:bg-muted/40 disabled:opacity-60"}`}
                    >
                      <ChannelIcon channel={channel} small />
                      <span className="min-w-0 w-full sm:w-auto sm:flex-1">
                        <span className="block text-sm font-semibold">
                          {channel.name}
                        </span>
                        <span
                          className={`mt-1 block truncate text-[11px] ${active ? "text-emerald-700 dark:text-emerald-400" : reconnect ? "text-amber-700" : "text-muted-foreground"}`}
                        >
                          {active
                            ? active.display_name
                            : reconnect
                              ? "Reconnect account"
                              : channel.id === "instagram"
                                ? "Business or Creator"
                                : channel.id === "facebook"
                                  ? "Pages"
                                  : "Connect account"}
                        </span>
                      </span>
                      {connecting ? (
                        <Loader2
                          aria-label="Connecting"
                          className="absolute right-3 top-3 size-4 shrink-0 animate-spin sm:static"
                        />
                      ) : active ? (
                        <Check className="absolute right-3 top-3 size-4 shrink-0 text-emerald-600 sm:static" />
                      ) : (
                        <ArrowUpRight
                          aria-hidden="true"
                          className="absolute right-3 top-3 size-4 shrink-0 text-muted-foreground group-hover:text-foreground sm:static"
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-2xl border border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
                Your workspace owner manages social connections. You can head
                straight to your workspace.
              </div>
            )}
            <p className="mt-5 flex items-center justify-center gap-2 text-center text-[11px] leading-relaxed text-muted-foreground">
              <ShieldCheck aria-hidden="true" className="size-3.5 shrink-0" />
              You’re in control. Connect securely and disconnect anytime.
            </p>
            <div className="mt-6 flex items-center justify-between gap-3 border-t border-border/70 pt-5 sm:mt-8 sm:gap-4 sm:pt-6">
              <button
                type="button"
                onClick={() => onStep("welcome")}
                disabled={busy}
                className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50"
              >
                <ArrowLeft aria-hidden="true" className="size-3.5" /> Back
              </button>
              <div className="flex gap-3">
                {!activeCount && canConnect && (
                  <div className="hidden sm:block">
                    <Button
                      onClick={onFinish}
                      disabled={busy}
                      className="secondary-btn h-11 rounded-xl px-5"
                    >
                      I’ll connect later
                    </Button>
                  </div>
                )}
                <Button
                  onClick={onFinish}
                  disabled={busy}
                  className="primary-btn h-11 gap-2 rounded-xl px-4 text-xs sm:px-6 sm:text-sm"
                >
                  {finishing ? (
                    <Loader2
                      className="size-4 animate-spin"
                      aria-hidden="true"
                    />
                  ) : null}
                  Go to my workspace{" "}
                  <ArrowRight aria-hidden="true" className="size-4" />
                </Button>
              </div>
            </div>
            {activeCount > 0 && (
              <p
                role="status"
                className="mt-4 text-center text-xs text-emerald-700 dark:text-emerald-400"
              >
                {activeCount}{" "}
                {activeCount === 1
                  ? "account connected."
                  : "accounts connected."}{" "}
                You’re ready to go.
              </p>
            )}
          </div>
        )}
        {error && (
          <p
            role="alert"
            className="mt-5 rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-center text-xs leading-relaxed text-destructive"
          >
            {error}
          </p>
        )}
      </section>
      <p className="mt-5 text-center text-[11px] text-muted-foreground">
        {step === "welcome"
          ? "A quick hello, then you’re ready to create."
          : "You can add more accounts anytime in Channels."}
      </p>
    </OnboardingShell>
  );
}
