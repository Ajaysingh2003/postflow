"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  Plus,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Star,
  Trash2,
  User,
  Users,
} from "lucide-react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Chrome } from "@hugeicons/core-free-icons";
import { toast } from "sonner";

import { useTRPC, useTRPCClient } from "@/trpc/client";
import { useOutlifyStatus } from "@/hooks/useOutlifyStatus";
import {
  fetchLinkedInFromExtension,
  isExtensionInstalled,
} from "@/lib/linkedinBridge";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Linkedin } from "@/lib/icons";
import { cn } from "@/lib/utils";
import type { LinkedInConnectionData } from "@/modules/workspace/server/procedures";

export default function StatusView() {
  const router = useRouter();
  const trpc = useTRPC();
  const trpcClient = useTRPCClient();
  const queryClient = useQueryClient();

  const extensionStatus = useOutlifyStatus();

  const { data: accounts } = useSuspenseQuery(
    trpc.workspace.listLinkedInConnections.queryOptions(),
  );

  const { data: currentWorkspace } = useSuspenseQuery(
    trpc.workspace.current.queryOptions(),
  );

  const [resyncingId, setResyncingId] = useState<string | null>(null);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [primarySettingId, setPrimarySettingId] = useState<string | null>(null);
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);
  const [isGlobalSyncing, setIsGlobalSyncing] = useState(false);
  const [isInitialVerifying, setIsInitialVerifying] = useState(false);

  // Health verification cache map: accountId -> { valid: boolean | null; message: string; isVerifying?: boolean }
  const [healthMap, setHealthMap] = useState<
    Record<string, { valid: boolean | null; message: string; isVerifying?: boolean }>
  >({});

  const hasCheckedOnMount = useRef(false);

  const refreshAccounts = async () => {
    await queryClient.invalidateQueries({
      queryKey: trpc.workspace.listLinkedInConnections.queryKey(),
    });
    await queryClient.refetchQueries({
      queryKey: trpc.workspace.listLinkedInConnections.queryKey(),
    });
  };

  const connectedList = (accounts || []).filter(
    (acc) => acc.status !== "disconnected",
  );

  /**
   * Automatically check session health for all accounts on page load
   */
  useEffect(() => {
    if (hasCheckedOnMount.current || connectedList.length === 0) return;
    hasCheckedOnMount.current = true;

    const checkAllSessionsOnLoad = async () => {
      setIsInitialVerifying(true);

      // Set initial loading indicators for all connected accounts
      setHealthMap((prev) => {
        const next = { ...prev };
        for (const account of connectedList) {
          next[account.id] = {
            valid: prev[account.id]?.valid ?? null,
            message: "Verifying session...",
            isVerifying: true,
          };
        }
        return next;
      });

      // Verify sessions in parallel
      await Promise.allSettled(
        connectedList.map(async (account) => {
          try {
            const res = await trpcClient.workspace.verifyLinkedInSession.mutate({
              connectionId: account.id,
            });

            setHealthMap((prev) => ({
              ...prev,
              [account.id]: {
                valid: res.valid,
                message: res.message || (res.valid ? "Active session" : "Session expired"),
                isVerifying: false,
              },
            }));
          } catch (err: unknown) {
            setHealthMap((prev) => ({
              ...prev,
              [account.id]: {
                valid: false,
                message: err instanceof Error ? err.message : "Verification failed",
                isVerifying: false,
              },
            }));
          }
        }),
      );

      setIsInitialVerifying(false);
      // Invalidate queries so timestamps and server status match the latest checks
      await queryClient.invalidateQueries({
        queryKey: trpc.workspace.listLinkedInConnections.queryKey(),
      });
    };

    checkAllSessionsOnLoad();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleResyncAccount = async (account?: LinkedInConnectionData) => {
    if (!isExtensionInstalled() && !extensionStatus.isInstalled) {
      toast.error(
        "Outlify Connect extension is not detected. Please make sure Outlify Connect is enabled/reloaded in chrome://extensions.",
      );
      return;
    }

    try {
      if (account) {
        setResyncingId(account.id);
      } else {
        setIsGlobalSyncing(true);
      }

      toast.info("Extracting fresh session from LinkedIn via Outlify Connect...");
      const profile = await fetchLinkedInFromExtension();

      const targetIdentifier = (
        profile.username ||
        account?.public_identifier ||
        ""
      ).trim();

      if (!targetIdentifier && !profile.cookie_li_at) {
        throw new Error(
          "Could not detect LinkedIn public identifier. Please make sure you are logged into LinkedIn in Chrome.",
        );
      }

      const isSameAccount = account && targetIdentifier === account.public_identifier;

      const updated = await trpcClient.workspace.connectLinkedIn.mutate({
        public_identifier: targetIdentifier || undefined,
        username: targetIdentifier || undefined,
        first_name:
          profile.firstName || (isSameAccount ? account.first_name : undefined) || undefined,
        last_name:
          profile.lastName || (isSameAccount ? account.last_name : undefined) || undefined,
        headline:
          profile.headline || (isSameAccount ? account.headline : undefined) || undefined,
        picture_url:
          profile.pictureUrl || (isSameAccount ? account.picture_url : undefined) || undefined,
        dash_entity_urn:
          profile.dashEntityUrn || (isSameAccount ? account.dash_entity_urn : undefined) || undefined,
        member_urn:
          profile.idUser || (isSameAccount ? account.member_urn : undefined) || undefined,
        cookie_li_at: profile.cookie_li_at,
        cookie_jsessionid: profile.cookie_JSESSIONID,
        user_agent: profile.userAgent,
      });

      setHealthMap((prev) => ({
        ...prev,
        [updated.id]: { valid: true, message: "Session freshly synced", isVerifying: false },
      }));

      toast.success(
        `Successfully synced LinkedIn account (@${updated.public_identifier})!`,
      );
      await refreshAccounts();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to re-sync account";
      toast.error(msg);
    } finally {
      if (account) {
        setResyncingId(null);
      } else {
        setIsGlobalSyncing(false);
      }
    }
  };

  const handleVerifySession = async (account: LinkedInConnectionData) => {
    try {
      setVerifyingId(account.id);
      const res = await trpcClient.workspace.verifyLinkedInSession.mutate({
        connectionId: account.id,
      });

      setHealthMap((prev) => ({
        ...prev,
        [account.id]: {
          valid: res.valid,
          message: res.message,
          isVerifying: false,
        },
      }));

      if (res.valid) {
        toast.success(
          res.message || "Session active & healthy against LinkedIn Voyager API",
        );
      } else {
        toast.warning(
          res.message || "Session expired or invalid. Please click 'Re-sync' to refresh.",
        );
      }
      await refreshAccounts();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to verify session";
      toast.error(msg);
    } finally {
      setVerifyingId(null);
    }
  };

  const handleSetPrimary = async (account: LinkedInConnectionData) => {
    try {
      setPrimarySettingId(account.id);
      await trpcClient.workspace.setPrimaryLinkedInConnection.mutate({
        connectionId: account.id,
      });
      toast.success(`Set @${account.public_identifier} as your primary profile`);
      await refreshAccounts();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to set primary account";
      toast.error(msg);
    } finally {
      setPrimarySettingId(null);
    }
  };

  const handleDisconnect = async (account: LinkedInConnectionData) => {
    if (
      !window.confirm(
        `Are you sure you want to disconnect @${account.public_identifier}? Scheduled posts for this profile will be paused.`,
      )
    ) {
      return;
    }

    try {
      setDisconnectingId(account.id);
      await trpcClient.workspace.disconnectLinkedIn.mutate({
        connectionId: account.id,
      });
      toast.success(`Disconnected @${account.public_identifier}`);
      await refreshAccounts();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to disconnect account";
      toast.error(msg);
    } finally {
      setDisconnectingId(null);
    }
  };

  return (
    <div className="relative min-h-[calc(100dvh-5rem)] w-full py-5 px-3 sm:py-8 sm:px-6 lg:px-8">
      {/* Background Ambience */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent"
      />

      <div className="mx-auto max-w-4xl space-y-4 sm:space-y-6">
        {/* Header Section */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border/70 pb-4 sm:pb-6">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-2.5 py-0.5 text-[11px] font-semibold text-foreground">
              <Sparkles className="size-3 text-primary" />
              <span>Workspace Connections</span>
            </div>
            <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-3xl">
              LinkedIn Accounts & Status
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              Manage accounts, verify cookie health, or re-sync sessions for{" "}
              <span className="font-semibold text-foreground">
                {currentWorkspace?.name || "your workspace"}
              </span>
              .
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <Button
              size="sm"
              onClick={() => router.push("/dashboard")}
              className="h-8 sm:h-9 text-xs gap-1.5"
            >
              <span>Dashboard</span>
              <ArrowRight className="size-3.5 sm:size-4" />
            </Button>
          </div>
        </div>

        {/* Extension Diagnostics Strip */}
        <div className="rounded-xl sm:rounded-2xl border border-border bg-card p-3.5 sm:p-4 shadow-xs">
          <div className="flex flex-col gap-3.5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start sm:items-center gap-2.5 sm:gap-3">
              <div className="flex size-9 sm:size-10 shrink-0 items-center justify-center rounded-lg sm:rounded-xl border border-border bg-muted/50 mt-0.5 sm:mt-0">
                <HugeiconsIcon
                  icon={Chrome}
                  className="size-4.5 sm:size-5 text-foreground"
                />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                  <span className="text-xs sm:text-sm font-semibold text-foreground">
                    Outlify Connect Extension
                  </span>
                  {extensionStatus.isChecking ? (
                    <Badge
                      variant="outline"
                      className="gap-1 border-primary/20 bg-primary/10 text-primary text-[9px] sm:text-[10px] py-0 px-1.5"
                    >
                      <RefreshCw className="size-2.5 sm:size-3 animate-spin" />
                      Detecting...
                    </Badge>
                  ) : extensionStatus.isInstalled ? (
                    <Badge
                      variant="outline"
                      className="gap-1 border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[9px] sm:text-[10px] py-0 px-1.5"
                    >
                      <CheckCircle2 className="size-2.5 sm:size-3" />
                      Active & Detected
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="gap-1 border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[9px] sm:text-[10px] py-0 px-1.5"
                    >
                      <AlertTriangle className="size-2.5 sm:size-3" />
                      Not Detected
                    </Badge>
                  )}
                </div>
                <p className="text-[11px] sm:text-xs text-muted-foreground mt-0.5 leading-snug">
                  {extensionStatus.isInstalled
                    ? extensionStatus.isSignedIn
                      ? "Logged in on LinkedIn. Sessions can be re-synced in 1 click."
                      : "Extension active. Please make sure you are signed in to LinkedIn in Chrome."
                    : "Install or reload Outlify Connect in Chrome (chrome://extensions) to enable 1-click sync."}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1 sm:pt-0">
              {!extensionStatus.isInstalled && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    extensionStatus.refetch();
                    toast.info("Re-checking extension status...");
                  }}
                  className="h-8 flex-1 sm:flex-none gap-1 text-[11px] sm:text-xs text-muted-foreground hover:text-foreground"
                >
                  <RefreshCw className="size-3" />
                  <span>Check Again</span>
                </Button>
              )}
              <Button
                variant="secondary"
                size="sm"
                disabled={isGlobalSyncing}
                onClick={() => handleResyncAccount()}
                className="h-8 flex-1 sm:flex-none gap-1.5 text-[11px] sm:text-xs font-medium"
              >
                <RefreshCw
                  className={cn("size-3 sm:size-3.5", isGlobalSyncing && "animate-spin")}
                />
                <span>
                  {isGlobalSyncing ? "Syncing..." : "Sync Active Chrome Profile"}
                </span>
              </Button>
            </div>
          </div>
        </div>

        {/* Connected Accounts Section */}
        <div className="space-y-3 sm:space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <Users className="size-4 sm:size-4.5 text-muted-foreground" />
              <h2 className="text-sm sm:text-lg font-semibold text-foreground">
                Connected Profiles
              </h2>
              <Badge
                variant="secondary"
                className="rounded-full px-1.5 py-0 text-[10px] sm:text-xs"
              >
                {connectedList.length}
              </Badge>
              {isInitialVerifying && (
                <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-foreground">
                  <RefreshCw className="size-2.5 animate-spin text-primary" />
                  Checking sessions...
                </span>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={isGlobalSyncing}
              onClick={() => handleResyncAccount()}
              className="h-7 sm:h-8 gap-1 text-[11px] sm:text-xs font-medium"
              title="Detect and connect whatever LinkedIn profile is currently signed in on Chrome"
            >
              <Plus className="size-3 sm:size-3.5" />
              <span>Add / Sync Active</span>
            </Button>
          </div>

          {connectedList.length === 0 ? (
            /* Empty State */
            <div className="flex flex-col items-center justify-center rounded-xl sm:rounded-2xl border border-dashed border-border bg-card/60 p-6 sm:p-10 text-center shadow-xs">
              <div className="relative mb-3 flex size-11 sm:size-14 items-center justify-center rounded-xl sm:rounded-2xl border border-border bg-background shadow-xs">
                <Linkedin className="size-5 sm:size-6 text-[#0A66C2]" />
              </div>
              <h3 className="text-sm sm:text-base font-semibold text-foreground">
                No LinkedIn Accounts Connected
              </h3>
              <p className="mt-1 max-w-sm text-[11px] sm:text-xs text-muted-foreground">
                Connect your personal or executive LinkedIn accounts to schedule
                posts, manage analytics, and auto-sync content.
              </p>
              <Button
                size="sm"
                onClick={() => router.push("/onboarding/connect-account")}
                className="mt-4 gap-1.5 text-xs h-8 sm:h-9"
              >
                <Plus className="size-3.5 sm:size-4" />
                <span>Connect Your First Account</span>
              </Button>
            </div>
          ) : (
            /* Accounts Cards */
            <div className="grid gap-3 sm:gap-4">
              {connectedList.map((account) => {
                const isResyncing = resyncingId === account.id;
                const isVerifying = verifyingId === account.id;
                const isSettingPrimary = primarySettingId === account.id;
                const isDisconnecting = disconnectingId === account.id;
                const health = healthMap[account.id];
                const checkingLive = health?.isVerifying || isVerifying;

                const displayName =
                  [account.first_name, account.last_name]
                    .filter(Boolean)
                    .join(" ") || account.public_identifier;

                const initials =
                  (account.first_name?.[0] || "") +
                  (account.last_name?.[0] || "");

                return (
                  <div
                    key={account.id}
                    className={cn(
                      "relative overflow-hidden shadow-xs rounded-xl sm:rounded-2xl border bg-card p-3.5 sm:p-5 transition-all",
                      account.is_primary
                        ? "border-primary/40 bg-card/90"
                        : "border-border",
                    )}
                  >
                    <div className="flex flex-col gap-3.5 md:flex-row md:items-center md:justify-between">
                      {/* Left: Avatar & Info */}
                      <div className="flex items-start gap-2.5 sm:gap-3.5 min-w-0">
                        <div className="relative shrink-0">
                          <Avatar className="size-10 sm:size-12 rounded-full border border-border">
                            {account.picture_url && (
                              <AvatarImage
                                src={account.picture_url}
                                alt={displayName}
                              />
                            )}
                            <AvatarFallback className="bg-primary/10 text-foreground font-semibold text-xs sm:text-sm">
                              {initials.toUpperCase() || (
                                <User className="size-4 sm:size-5" />
                              )}
                            </AvatarFallback>
                          </Avatar>
                          <div className="absolute -bottom-0.5 -right-0.5 flex size-4 sm:size-5 items-center justify-center rounded-full border border-background bg-[#0A66C2] text-white">
                            <Linkedin
                              className="size-2 sm:size-2.5"
                              fill="currentColor"
                            />
                          </div>
                        </div>

                        <div className="space-y-1 min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                            <span className="font-semibold text-foreground text-xs sm:text-sm truncate max-w-[150px] sm:max-w-none">
                              {displayName}
                            </span>
                            <Link
                              href={`https://www.linkedin.com/in/${account.public_identifier}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-0.5  text-[10px] sm:text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline truncate max-w-[120px] sm:max-w-none"
                            >
                              <span>@{account.public_identifier}</span>
                              <ExternalLink className="size-2.5 sm:size-3 shrink-0" />
                            </Link>

                            {account.is_primary && (
                              <Badge className="gap-1 bg-primary/15 text-foreground border-primary/20 text-[9px] sm:text-[11px] font-medium py-0 px-1.5">
                                <Star className="size-2.5 sm:size-3 text-amber-300 fill-amber-300" />
                                Primary
                              </Badge>
                            )}
                          </div>

                          {account.headline && (
                            <p className="text-[11px] sm:text-xs text-muted-foreground line-clamp-1 max-w-xs sm:max-w-md">
                              {account.headline}
                            </p>
                          )}

                          {/* Status and Diagnostics Badges */}
                          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 pt-0.5">
                            {checkingLive ? (
                              <Badge
                                variant="outline"
                                className="gap-1 border-primary/20 bg-primary/10 text-foreground text-[9px] sm:text-[10px] py-0 px-1.5"
                              >
                                <RefreshCw className="size-2.5 sm:size-3 animate-spin" />
                                Checking Session...
                              </Badge>
                            ) : health?.valid === false ? (
                              <Badge
                                variant="outline"
                                className="gap-1 border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[9px] sm:text-[10px] py-0 px-1.5"
                              >
                                <ShieldAlert className="size-2.5 sm:size-3" />
                                Session Expired
                              </Badge>
                            ) : health?.valid === true || account.status === "connected" ? (
                              <Badge
                                variant="outline"
                                className="gap-1 border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[9px] sm:text-[10px] py-0 px-1.5"
                              >
                                <CheckCircle2 className="size-2.5 sm:size-3" />
                                Active & Synced
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-[9px] sm:text-[10px] py-0 px-1.5">
                                {account.status}
                              </Badge>
                            )}

                            <span className="text-[10px] sm:text-[11px] text-muted-foreground">
                              Last checked:{" "}
                              <span className="font-medium text-foreground">
                                {(() => {
                                  if (checkingLive) return "Checking now...";
                                  if (!account.last_confirmed_at) return "Never";
                                  const d = new Date(account.last_confirmed_at);
                                  const diffSec = Math.floor(
                                    (Date.now() - d.getTime()) / 1000,
                                  );
                                  if (diffSec < 15) return "Just now";
                                  if (diffSec < 60) return `${diffSec}s ago`;
                                  const diffMin = Math.floor(diffSec / 60);
                                  if (diffMin < 60) return `${diffMin}m ago`;
                                  return d.toLocaleTimeString([], {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  });
                                })()}
                              </span>
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Right: Actions (Mobile Grid / Desktop Flex) */}
                      <div className="grid grid-cols-3 sm:flex sm:flex-wrap items-center gap-1.5 pt-2 sm:pt-0 border-t border-border/50 md:border-t-0 md:justify-end">
                        {/* Re-sync Button */}
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={isResyncing || checkingLive}
                          onClick={() => handleResyncAccount(account)}
                          className="h-7 sm:h-8 px-2 sm:px-3 text-[11px] sm:text-xs font-medium"
                          title="Extract fresh cookies from Chrome extension and update Outlify"
                        >
                          <RefreshCw
                            className={cn(
                              "size-3 sm:size-3.5 mr-1 sm:mr-1.5",
                              isResyncing && "animate-spin text-accent",
                            )}
                          />
                          <span>{isResyncing ? "Syncing" : "Re-sync"}</span>
                        </Button>

                        {/* Verify Session Button */}
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={checkingLive}
                          onClick={() => handleVerifySession(account)}
                          className="h-7 sm:h-8 px-2 sm:px-3 text-[11px] sm:text-xs font-medium"
                          title="Test live session against LinkedIn Voyager API"
                        >
                          <ShieldCheck
                            className={cn(
                              "size-3 sm:size-3.5 mr-1 sm:mr-1.5",
                              checkingLive && "animate-pulse text-emerald-500",
                            )}
                          />
                          <span>{checkingLive ? "Checking" : "Verify"}</span>
                        </Button>

                        {/* Set as Primary Toggle / Disconnect Container */}
                        <div className="flex items-center justify-end gap-1 col-span-1">
                          {!account.is_primary && (
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={isSettingPrimary}
                              onClick={() => handleSetPrimary(account)}
                              className="h-7 sm:h-8 px-1.5 sm:px-2 text-[10px] sm:text-xs text-muted-foreground hover:text-foreground"
                              title="Set as primary account"
                            >
                              <Star className="size-3 sm:size-3.5 sm:mr-1" />
                              <span className="hidden sm:inline">Set Primary</span>
                            </Button>
                          )}

                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={isDisconnecting}
                            onClick={() => handleDisconnect(account)}
                            className="h-7 w-7 sm:h-8 sm:w-8 p-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive shrink-0"
                            title="Disconnect account"
                          >
                            <Trash2 className="size-3 sm:size-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Security & Maintenance Notice */}
        <div className="rounded-xl sm:rounded-2xl border border-border/80 bg-muted/30 p-3 sm:p-4 text-[11px] sm:text-xs text-muted-foreground">
          <div className="flex items-start gap-2 sm:gap-2.5">
            <ShieldCheck className="size-3.5 sm:size-4 shrink-0 text-muted-foreground mt-0.5" />
            <div>
              <p className="font-semibold text-foreground">
                Automated Session Protection & Cookie Maintenance
              </p>
              <p className="mt-0.5 leading-relaxed text-[10px] sm:text-xs">
                LinkedIn security cookies (<code className=" text-[9px] sm:text-[10px]">li_at</code> and <code className=" text-[9px] sm:text-[10px]">JSESSIONID</code>)
                periodically rotate. As long as you have Outlify Connect active in Chrome and browse LinkedIn, sessions are refreshed seamlessly in the background. If a session expires, click{" "}
                <span className="font-semibold text-foreground">Re-sync</span>.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}