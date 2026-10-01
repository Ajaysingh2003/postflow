"use client";

import React from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Copy,
  ExternalLink,
  KeyRound,
  Lock,
  Puzzle,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Linkedin } from "@/lib/icons";
import { Chrome } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useRouter } from "next/navigation";
import { useOutlifyStatus } from "@/hooks/useOutlifyStatus";
import { useTRPC, useTRPCClient } from "@/trpc/client";
import { useSuspenseQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { fetchLinkedInFromExtension, isExtensionInstalled } from "@/lib/linkedinBridge";

/* ---------------------------------------------------------------------------
   Browser Detection
--------------------------------------------------------------------------- */

type DetectedBrowser = {
  name: string;
  isChrome: boolean;
};

function detectBrowser(): DetectedBrowser {
  if (typeof navigator === "undefined") {
    return { name: "your browser", isChrome: true };
  }

  const ua = navigator.userAgent;

  if (/Edg\//.test(ua)) return { name: "Microsoft Edge", isChrome: false };
  if (/OPR\//.test(ua) || /Opera/.test(ua))
    return { name: "Opera", isChrome: false };
  if (/Brave/.test(ua)) return { name: "Brave", isChrome: false };
  if (/Firefox\//.test(ua)) return { name: "Firefox", isChrome: false };
  if (/CriOS\//.test(ua)) return { name: "Chrome for iOS", isChrome: false };
  if (/FxiOS\//.test(ua)) return { name: "Firefox for iOS", isChrome: false };
  if (
    /^((?!chrome|android).)*safari/i.test(ua) ||
    (/Safari\//.test(ua) && !/Chrome\//.test(ua))
  ) {
    return { name: "Safari", isChrome: false };
  }
  if (/Chrome\//.test(ua)) return { name: "Chrome", isChrome: true };

  return { name: "your browser", isChrome: false };
}

function useBrowser() {
  const [browser, setBrowser] = React.useState<DetectedBrowser | null>(null);

  React.useEffect(() => {
    setBrowser(detectBrowser());
  }, []);

  return browser;
}

/* ---------------------------------------------------------------------------
   Main Component
--------------------------------------------------------------------------- */

export default function ConnectAccountView() {
  const trpc = useTRPC();

  const { data: userData } = useSuspenseQuery(trpc.user.me.queryOptions());
  
  const browser = useBrowser();
  const checked = browser !== null;
  const isChrome = browser?.isChrome ?? true;
  const [copied, setCopied] = React.useState(false);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const router = useRouter();

  const linkedinConnection = useOutlifyStatus();
  const [isConnecting, setIsConnecting] = React.useState(false);
  const trpcClient = useTRPCClient();

  const ctaText = !linkedinConnection.isInstalled
    ? "Install Outlify Connect"
    : isConnecting
      ? "Connecting Account..."
      : "One-Click Connect";

  const handleCTA = async () => {
    if (!linkedinConnection.isInstalled && !isExtensionInstalled()) {
      toast.error("Please ensure Outlify Connect is loaded and enabled in chrome://extensions.");
      return;
    }

    try {
      setIsConnecting(true);
      toast.info("Connecting to LinkedIn via Outlify Connect...");
      const profile = await fetchLinkedInFromExtension();
      const targetIdent = (profile.username || "").trim();
      if (!targetIdent && !profile.cookie_li_at) {
        toast.warning("Please make sure you are logged into LinkedIn in Chrome.");
        window.open("https://www.linkedin.com/login", "_blank");
        return;
      }
      await trpcClient.workspace.connectLinkedIn.mutate({
        public_identifier: targetIdent || undefined,
        username: targetIdent || undefined,
        first_name: profile.firstName,
        last_name: profile.lastName,
        headline: profile.headline,
        picture_url: profile.pictureUrl,
        dash_entity_urn: profile.dashEntityUrn,
        member_urn: profile.idUser,
        cookie_li_at: profile.cookie_li_at,
        cookie_jsessionid: profile.cookie_JSESSIONID,
        user_agent: profile.userAgent,
      });
      toast.success("LinkedIn account connected successfully!");
      router.push("/onboarding/status");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to connect LinkedIn account";
      toast.error(msg);
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <div className="relative flex min-h-[calc(100dvh-5rem)]z  w-full  zitems-center justify-center px-4 py-4 sm:px-6">
      {/* Subtle Background Ambience */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent"
      />

      <div className="w-full max-w-[460px]">
        {/* Visual Badge Icon */}
        <div className="mb-6 flex justify-center">
          <div className="relative flex items-center justify-center">
            <div className="absolute size-20 rounded-full bg-primary/10 blur-xl" />

            <div className="relative flex size-16 items-center justify-center rounded-2xl border border-border/80 bg-background shadow-md shadow-primary/5">
              <Puzzle className="size-7 text-stone-700" />
            </div>

            <div className="absolute -bottom-1 -right-1 flex size-6 items-center justify-center rounded-full border-2 border-background bg-[#0A66C2] text-white shadow-sm">
              <Linkedin className="size-3" fill="currentColor" />
            </div>
          </div>
        </div>

        {/* Header Section */}
        <div className="text-center">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-semibold text-foreground">
            <Sparkles className="size-3.5" />
            <span>One-Time Pairing</span>
          </div>

          <h1 className="mt-3.5 font-heading text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Connect LinkedIn
          </h1>

          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
            Install the Outlify Connect extension to securely pair your LinkedIn
            profile without sharing passwords.
          </p>
        </div>

        {/* Non-Chrome Alert */}
        {checked && !isChrome && (
          <div className="mt-6 flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-100/10 p-3.5 text-amber-900 dark:text-amber-200">
            <AlertTriangle className="mt-0.5 size-4.5 shrink-0 text-amber-600 dark:text-amber-400" />
            <div className="min-w-0 text-xs">
              <p className="font-semibold text-amber-800 dark:text-amber-300">
                Extension requires Google Chrome
              </p>
              <p className="mt-0.5 text-amber-700/90 dark:text-amber-300/80">
                You are currently using{" "}
                <span className="font-medium">{browser?.name}</span>. Open this
                page in Chrome to finish the connection.
              </p>
              <button
                type="button"
                onClick={handleCopyLink}
                className="mt-2 inline-flex items-center gap-1.5 font-medium underline underline-offset-2 hover:opacity-80"
              >
                <Copy className="size-3" />
                <span>{copied ? "Link copied!" : "Copy link for Chrome"}</span>
              </button>
            </div>
          </div>
        )}

        {/* Primary Card */}
        <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          {/* Extension Spec Header */}
          <div className="flex items-center justify-between border-b border-border/80 bg-muted/40 px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border bg-background shadow-xs">
                <HugeiconsIcon
                  icon={Chrome}
                  className="size-5 text-foreground"
                />
              </div>

              <div>
                <p className="text-sm font-semibold leading-tight text-foreground">
                  Outlify Connect
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Official Chrome Web Store Extension
                </p>
              </div>
            </div>

            <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="size-3" />
              Verified
            </span>
          </div>

          {/* Steps Timeline */}
          <div className="space-y-4 p-5">
            <div className="space-y-3.5">
              <StepItem
                step={1}
                isDone={linkedinConnection.isInstalled}
                title="Install Extension"
                desc="Add Outlify Connect from the Chrome Web Store."
                isLast={false}
              />
              <StepItem
                step={2}
                isDone={linkedinConnection.isSignedIn}
                title="Sign into LinkedIn"
                desc="Ensure you are actively logged in to your account tab."
                isLast={false}
              />
              <StepItem
                isDone={false}
                step={3}
                title="One-Click Sync"
                desc="The extension securely pairs your session automatically."
                isLast={true}
              />
            </div>

            {/* Action CTA */}
            <div className="pt-2">
              {isChrome ? (
                <Button
                  onClick={handleCTA}
                  disabled={isConnecting}
                  className="h-11 w-full gap-2 rounded-xl text-sm font-semibold shadow-xs"
                >
                  <HugeiconsIcon icon={Chrome} className="size-4.5" />
                  {ctaText}
                  <ArrowRight className="ml-auto size-4" />
                </Button>
              ) : (
                <Button
                  variant="secondary"
                  onClick={handleCopyLink}
                  className="h-11 w-full gap-2 rounded-xl text-sm font-semibold"
                >
                  <Copy className="size-4" />
                  {copied ? "Link Copied!" : "Copy Link to Open in Chrome"}
                </Button>
              )}
            </div>

            {/* Already Installed Helper */}
            <div className="flex items-center justify-center gap-1.5 pt-1 text-xs text-muted-foreground">
              <span>Already installed?</span>
              <button
                type="button"
                onClick={() => {
                  linkedinConnection.refetch();
                  toast.info("Checking companion extension status...");
                }}
                className="inline-flex items-center gap-1 font-medium text-foreground underline-offset-4 hover:underline"
              >
                <RefreshCw className="size-3" />
                <span>Check connection status</span>
              </button>
            </div>
          </div>
        </div>

        {/* Trust Badges */}
        <div className="mt-5 grid grid-cols-2 gap-3">
          <TrustCard
            icon={ShieldCheck}
            title="Local Session Pairing"
            desc="Runs securely inside your browser"
          />
          <TrustCard
            icon={KeyRound}
            title="Zero Passwords"
            desc="No login credentials ever stored"
          />
        </div>

        {/* Security Disclaimers */}
        <p className="mt-6 text-center text-[11px] leading-relaxed text-muted-foreground">
          Outlify only communicates with verified LinkedIn endpoints and never
          stores your personal credentials.
        </p>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------------
   Sub-components
--------------------------------------------------------------------------- */

function StepItem({
  step,
  title,
  desc,
  isDone = false,
  isLast,
}: {
  step: number;
  title: string;
  isDone: boolean;
  desc: string;
  isLast: boolean;
}) {
  return (
    <div className="relative flex items-start gap-3.5">
      {!isLast && (
        <span
          aria-hidden
          className={cn(
            "absolute left-[13px] top-6 h-[calc(100%-8px)] w-px bg-border ",
            isDone && "bg-green-200",
          )}
        />
      )}
      <div
        className={cn(
          "relative flex size-7 shrink-0 items-center justify-center rounded-full border border-border bg-muted/60 text-xs font-semibold text-foreground ",
          isDone && "bg-green-500 text-white",
        )}
      >
        {step}
      </div>
      <div className="min-w-0 pt-0.5">
        <p className="text-xs font-semibold text-foreground">{title}</p>
        <p className="mt-0.5 text-[11px] leading-normal text-muted-foreground">
          {desc}
        </p>
      </div>
    </div>
  );
}

function TrustCard({
  icon: Icon,
  title,
  desc,
}: {
  icon: React.ElementType;
  title: string;
  desc: string;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-border/70 bg-card/60 p-3 shadow-2xs">
      <div className="flex items-center gap-1.5 text-primary">
        <Icon className="size-4 shrink-0" />
        <span className="text-xs font-semibold text-foreground">{title}</span>
      </div>
      <p className="text-[10px] leading-tight text-muted-foreground">{desc}</p>
    </div>
  );
}
