"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import {
  Check,
  CheckCircle2,
  Eye,
  ExternalLink,
  Globe2,
  Loader2,
  RefreshCw,
  Send,
  TriangleAlert,
  Users,
  X,
} from "lucide-react";
import { Linkedin } from "@/lib/icons";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { LinkedInConnectionData } from "@/modules/workspace/server/procedures";
import type { ComposerSettings } from "../../composerTypes";
import {
  publicationDetail,
  publicationLabel,
  publishIssue,
  readPublicationAttempt,
  writePublicationAttempt,
  type PublicationAttempt,
} from "../../publishing";
import AccountAvatar, { accountName } from "./AccountAvatar";
import LinkedInEditor from "./LinkedInEditor";
import type { DraftWorkspace } from "./useDraftWorkspace";

export type PublicationSnapshot = {
  content: string;
  composer: ComposerSettings;
  localId: string;
  storageKey: string;
  workspaceId: string;
};
const message = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

export default function PublishDialog({
  workspace: w,
  snapshot,
  onClose,
  onBusy,
}: {
  workspace: DraftWorkspace;
  snapshot: PublicationSnapshot;
  onClose: () => void;
  onBusy: (busy: boolean) => void;
}) {
  const trpc = useTRPC();
  const client = useQueryClient();
  const mutation = useMutation({
    ...trpc.content.publishLinkedIn.mutationOptions(),
    retry: false,
  });
  const [attempt, setAttempt] = useState<PublicationAttempt | null>(null);
  const attemptRef = useRef<PublicationAttempt | null>(null);
  const [selected, setSelected] = useState<string[] | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [previewAccount, setPreviewAccount] =
    useState<LinkedInConnectionData | null>(null);
  const flight = useRef(false);
  const accounts =
    w.accounts.data
      ?.filter((account) => account.status !== "disconnected")
      .sort(
        (a, b) =>
          Number(Boolean(b.is_primary)) - Number(Boolean(a.is_primary)) ||
          Number(b.status === "connected" && Boolean(b.can_publish)) -
            Number(a.status === "connected" && Boolean(a.can_publish)) ||
          accountName(a).localeCompare(accountName(b)),
      ) ?? [];
  const eligible = accounts.filter(
    (account) => account.status === "connected" && account.can_publish,
  );
  const preferred =
    eligible.find(
      (account) => account.id === snapshot.composer.connection_id,
    ) || eligible.find((account) => account.is_primary);
  const chosen = (selected ?? (preferred ? [preferred.id] : [])).filter((id) =>
    eligible.some((account) => account.id === id),
  );
  const allSelected = eligible
    .slice(0, 20)
    .every((account) => chosen.includes(account.id));
  const issue = publishIssue(snapshot.content, snapshot.composer);
  const results = attempt?.response?.results ?? [];
  const failed = results.filter((result) =>
    ["failed", "reconnect_required"].includes(result.status),
  );
  const hasCurrentResults =
    attempt?.payload.linkedin_connection_ids.every((id) =>
      results.some((result) => result.linkedin_connection_id === id),
    ) ?? false;
  const completed =
    hasCurrentResults &&
    results.every((result) => !["sending", "queued"].includes(result.status));
  const locked = working || w.saving || w.uploadBusy;

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      try {
        const restored = readPublicationAttempt(snapshot.storageKey);
        attemptRef.current = restored;
        setAttempt(restored);
      } catch (error) {
        setError(
          message(
            error,
            "Could not restore publishing status. Check your LinkedIn profiles before publishing again.",
          ),
        );
      }
      setReady(true);
    });
    return () => {
      active = false;
    };
  }, [snapshot.storageKey]);
  useEffect(() => {
    onBusy(working);
    return () => onBusy(false);
  }, [working, onBusy]);

  function remember(next: PublicationAttempt) {
    // Storage must succeed before dispatching a new attempt. Losing its key can
    // cause duplicates after a browser refresh or switching between editors.
    writePublicationAttempt(snapshot.storageKey, next);
    attemptRef.current = next;
    setAttempt(next);
  }
  async function send(ids: string[], retryFailed = false) {
    if (flight.current || !ready || (!attemptRef.current && issue)) return;
    flight.current = true;
    setWorking(true);
    setError(null);
    try {
      const prior = readPublicationAttempt(snapshot.storageKey);
      let next = prior;
      if (!prior || retryFailed) {
        if (!ids.length || ids.length > 20)
          throw new Error("Choose between 1 and 20 accounts.");
        if (
          retryFailed &&
          ids.some(
            (id) =>
              !prior?.response?.results.some(
                (result) =>
                  result.linkedin_connection_id === id &&
                  ["failed", "reconnect_required"].includes(result.status),
              ),
          )
        )
          throw new Error(
            "Only accounts with a confirmed failed result can be retried.",
          );
        if (!prior) {
          if (
            w.state.localId !== snapshot.localId ||
            w.state.content !== snapshot.content ||
            JSON.stringify(w.state.composer) !==
              JSON.stringify(snapshot.composer)
          )
            throw new Error(
              "Your draft changed. Close this dialog and review the updated post before publishing.",
            );
          const saved = await w.save();
          if (!saved)
            throw new Error(
              "Save your draft before publishing. Your draft is still here.",
            );
        }
        next = {
          payload: {
            idempotency_key: crypto.randomUUID(),
            workspace_id: snapshot.workspaceId,
            linkedin_connection_ids: ids,
            content: prior?.payload.content ?? snapshot.content,
            images:
              prior?.payload.images ??
              snapshot.composer.attachments.map((asset) => ({
                asset_id: asset.asset_id,
              })),
          },
          // Keep successful and uncertain outcomes visible when retrying only
          // failed accounts, so the user cannot unknowingly submit them again.
          response:
            retryFailed && prior?.response
              ? {
                  ...prior.response,
                  results: prior.response.results.filter(
                    (result) => !ids.includes(result.linkedin_connection_id),
                  ),
                }
              : undefined,
        };
        remember(next);
      }
      if (!next) return;
      const response = await mutation.mutateAsync(next.payload);
      const retained =
        next.response?.results.filter(
          (result) =>
            !next.payload.linkedin_connection_ids.includes(
              result.linkedin_connection_id,
            ),
        ) ?? [];
      const updated = {
        ...next,
        response: { ...response, results: [...retained, ...response.results] },
      };
      // Keep the in-memory outcome even if browser storage later becomes full.
      attemptRef.current = updated;
      setAttempt(updated);
      try {
        writePublicationAttempt(snapshot.storageKey, updated);
      } catch {
        setError(
          "Results could not be saved on this device. Use Check status before retrying.",
        );
      }
      void w.accounts.refetch();
    } catch (error) {
      setError(
        message(
          error,
          "Could not confirm publishing. Check status before trying again.",
        ),
      );
    } finally {
      flight.current = false;
      setWorking(false);
    }
  }
  async function checkStatus() {
    if (flight.current || !attemptRef.current) return;
    flight.current = true;
    setWorking(true);
    setError(null);
    try {
      const current = attemptRef.current;
      const response = await client.fetchQuery({
        ...trpc.content.publicationStatus.queryOptions({
          idempotency_key: current.payload.idempotency_key,
          workspace_id: current.payload.workspace_id,
        }),
        staleTime: 0,
        retry: false,
      });
      const retained =
        current.response?.results.filter(
          (result) =>
            !current.payload.linkedin_connection_ids.includes(
              result.linkedin_connection_id,
            ),
        ) ?? [];
      const updated = {
        ...current,
        response: { ...response, results: [...retained, ...response.results] },
      };
      attemptRef.current = updated;
      setAttempt(updated);
      try {
        writePublicationAttempt(snapshot.storageKey, updated);
      } catch {
        setError("Results could not be saved on this device.");
      }
    } catch (error) {
      setError(
        message(error, "Could not check status. Wait a moment and try again."),
      );
    } finally {
      flight.current = false;
      setWorking(false);
      void w.accounts.refetch();
    }
  }
  const attemptedIds = new Set([
    ...(attempt?.payload.linkedin_connection_ids ?? []),
    ...results.map((result) => result.linkedin_connection_id),
  ]);
  const rows = attempt
    ? [
        ...accounts,
        ...Array.from(attemptedIds)
          .filter((id) => !accounts.some((account) => account.id === id))
          .map(
            (id) =>
              ({
                id,
                first_name: "Previously selected account",
                public_identifier: "",
                status: "disconnected",
              }) as LinkedInConnectionData,
          ),
      ].filter((account) => attemptedIds.has(account.id))
    : accounts;

  return (
    <>
      <Dialog open onOpenChange={(open) => !open && !locked && onClose()}>
        <DialogContent
          showCloseButton={false}
          className="flex max-h-[90dvh] w-[calc(100%-1.5rem)] max-w-xl flex-col gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-xl"
        >
          <DialogHeader className="shrink-0 border-b border-border px-6 pt-6 pb-5">
            <div className="flex items-center justify-between gap-3">
              <span className="flex size-11 items-center justify-center rounded-xl bg-sky-50 text-sky-600 dark:bg-sky-950/40">
                <Send className="size-5" />
              </span>
              <Button
                variant="ghost"
                size="icon-sm"
                disabled={locked}
                aria-label="Close publish dialog"
                onClick={onClose}
                className="rounded-lg"
              >
                <X />
              </Button>
            </div>
            <DialogTitle className="mt-3 font-heading text-2xl">
              {attempt ? "Publishing results" : "Publish to LinkedIn"}
            </DialogTitle>
            <DialogDescription>
              {attempt
                ? "See the outcome for each account. Your saved draft is still available."
                : "Choose the accounts for this post. Each selected account publishes its own copy."}
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-6 py-5">
            <div className="rounded-xl border border-border bg-muted/35 p-4">
              <div className="mb-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  {attempt || snapshot.composer.visibility === "PUBLIC" ? (
                    <Globe2 className="size-3.5" />
                  ) : (
                    <Users className="size-3.5" />
                  )}
                  {attempt || snapshot.composer.visibility === "PUBLIC"
                    ? "Anyone on LinkedIn"
                    : "Connections only"}
                </span>
                <span>
                  {(
                    attempt?.payload.content ?? snapshot.content
                  ).length.toLocaleString()}{" "}
                  / 3,000
                </span>
              </div>
              <p className="line-clamp-3 whitespace-pre-wrap break-words text-sm leading-6">
                {attempt?.payload.content ?? snapshot.content}
              </p>
              {snapshot.composer.attachments.length > 0 && (
                <p className="mt-2 text-xs text-muted-foreground">
                  {snapshot.composer.attachments.length} attached file
                  {snapshot.composer.attachments.length > 1 ? "s" : ""}
                </p>
              )}
            </div>
            {!attempt && issue && (
              <div
                role="alert"
                className="rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-sm leading-6 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200"
              >
                {issue}
              </div>
            )}
            {error && (
              <div
                role="alert"
                className="flex gap-2 rounded-xl border border-destructive/20 bg-destructive/5 p-3.5 text-sm leading-6 text-destructive"
              >
                <TriangleAlert className="mt-1 size-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}
            <div>
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="font-subheading text-sm font-medium">
                  {attempt ? "Account results" : "Connected accounts"}
                </h2>
                {!attempt && eligible.length > 1 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={locked || !ready}
                    className="h-7 rounded-md text-xs"
                    onClick={() =>
                      setSelected(
                        allSelected
                          ? []
                          : eligible.slice(0, 20).map((account) => account.id),
                      )
                    }
                  >
                    {allSelected ? "Deselect all" : "Select all"}
                  </Button>
                )}
              </div>
              {w.accounts.isPending ? (
                <div
                  role="status"
                  aria-label="Loading LinkedIn accounts"
                  className="space-y-2"
                >
                  <Skeleton className="h-20 rounded-xl" />
                  <Skeleton className="h-20 rounded-xl" />
                </div>
              ) : (
                <>
                  {w.accounts.isError && (
                    <div
                      role="alert"
                      className="mb-3 rounded-xl border border-destructive/20 p-4"
                    >
                      <p className="mb-3 text-sm text-destructive">
                        Could not load your LinkedIn accounts.
                      </p>
                      <Button
                        className="secondary-btn rounded-lg"
                        disabled={w.accounts.isFetching}
                        onClick={() => void w.accounts.refetch()}
                      >
                        <RefreshCw />
                        Retry loading accounts
                      </Button>
                    </div>
                  )}
                  {!w.accounts.isError && !rows.length && (
                    <div className="rounded-xl border border-dashed border-border p-6 text-center">
                      <Linkedin className="mx-auto mb-3 size-6 text-muted-foreground" />
                      <p className="font-subheading text-sm">
                        Connect your LinkedIn account
                      </p>
                      <p className="mt-2 text-xs leading-5 text-muted-foreground">
                        Your connected accounts will appear here.
                      </p>
                      <Button asChild className="secondary-btn mt-4 rounded-lg">
                        <Link href="/onboarding/connect-account">
                          Connect LinkedIn
                        </Link>
                      </Button>
                    </div>
                  )}
                  <div className="space-y-2">
                    {rows.map((account) => {
                      const result = results.find(
                        (result) =>
                          result.linkedin_connection_id === account.id,
                      );
                      const enabled =
                        account.status === "connected" && account.can_publish;
                      const checked = attempt
                        ? attemptedIds.has(account.id)
                        : chosen.includes(account.id);
                      const unknown = result?.status === "unknown";
                      const live = result?.status === "published";
                      const url =
                        result?.post_url &&
                        /^https:\/\/www\.linkedin\.com\/feed\/update\/urn:li:(share|ugcPost):[A-Za-z0-9_-]+\/$/.test(
                          result.post_url,
                        )
                          ? result.post_url
                          : null;
                      return (
                        <div
                          key={account.id}
                          className={`rounded-xl border p-3.5 ${checked && !attempt ? "border-sky-200 bg-sky-50/40 dark:border-sky-900 dark:bg-sky-950/20" : "border-border"}`}
                        >
                          <div className="flex items-center gap-3">
                            {!attempt ? (
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                role="checkbox"
                                aria-checked={checked}
                                aria-label={`Publish as ${accountName(account)}`}
                                disabled={
                                  locked ||
                                  !enabled ||
                                  !ready ||
                                  (!checked && chosen.length >= 20)
                                }
                                onClick={() =>
                                  setSelected(
                                    checked
                                      ? chosen.filter((id) => id !== account.id)
                                      : [...chosen, account.id],
                                  )
                                }
                                className={`size-6 shrink-0 rounded-md border ${checked ? "border-sky-500 bg-sky-500 text-white hover:bg-sky-600 hover:text-white" : "border-border"}`}
                              >
                                {checked && <Check className="size-4" />}
                              </Button>
                            ) : live ? (
                              <CheckCircle2 className="size-5 shrink-0 text-emerald-600" />
                            ) : (
                              <TriangleAlert
                                className={`size-5 shrink-0 ${unknown ? "text-amber-600" : "text-muted-foreground"}`}
                              />
                            )}
                            <span className="relative shrink-0">
                              <AccountAvatar account={account} />
                              <span className="absolute -right-1 -bottom-1 flex size-4 items-center justify-center rounded-full bg-[#0a66c2] text-white ring-2 ring-background">
                                <Linkedin className="size-2.5" />
                              </span>
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <p className="truncate font-subheading text-sm font-medium">
                                  {accountName(account)}
                                </p>
                                {account.is_primary && (
                                  <Badge
                                    variant="secondary"
                                    className="px-1.5 text-[10px]"
                                  >
                                    Primary
                                  </Badge>
                                )}
                              </div>
                              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                                {account.public_identifier
                                  ? `@${account.public_identifier}`
                                  : "Account no longer connected"}
                              </p>
                            </div>
                            {!attempt && (
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                disabled={locked}
                                aria-label={`Preview post as ${accountName(account)}`}
                                onClick={() => setPreviewAccount(account)}
                                className="shrink-0 rounded-lg"
                              >
                                <Eye />
                              </Button>
                            )}
                            {url && (
                              <Button
                                asChild
                                variant="ghost"
                                size="icon-sm"
                                aria-label={`View post for ${accountName(account)}`}
                                className="rounded-lg"
                              >
                                <a
                                  href={url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  <ExternalLink />
                                </a>
                              </Button>
                            )}
                          </div>
                          {attempt ? (
                            <div className="mt-3 space-y-1 border-t border-border pt-3">
                              <p
                                className={`font-subheading text-xs ${live ? "text-emerald-700 dark:text-emerald-400" : unknown ? "text-amber-700 dark:text-amber-400" : "text-foreground"}`}
                              >
                                {result
                                  ? publicationLabel(result)
                                  : "Awaiting confirmation"}
                              </p>
                              <p className="text-xs leading-5 text-muted-foreground">
                                {result
                                  ? publicationDetail(result)
                                  : "Check status to confirm this account’s result before trying again."}
                              </p>
                            </div>
                          ) : (
                            !enabled && (
                              <p className="mt-3 text-xs leading-5 text-muted-foreground">
                                {account.status !== "connected"
                                  ? "Reconnect this account before publishing."
                                  : "Connected for writing. Enable publishing for this account in the Outlify extension."}
                              </p>
                            )
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
            {!attempt && eligible.length === 0 && accounts.length > 0 && (
              <p className="text-xs leading-5 text-muted-foreground">
                Open the Outlify extension and authorize publishing for a
                connected account, then{" "}
                <Button
                  variant="link"
                  className="h-auto p-0 text-xs underline"
                  onClick={() => void w.accounts.refetch()}
                >
                  refresh accounts
                </Button>
                .
              </p>
            )}
            {attempt && (
              <p className="text-xs leading-5 text-muted-foreground">
                This attempt keeps the exact post you reviewed. To publish a
                different post or to more accounts, start a new draft.
              </p>
            )}
          </div>
          <footer className="shrink-0 space-y-3 border-t border-border bg-muted/20 px-6 py-4">
            {!attempt ? (
              <>
                <p className="text-xs text-muted-foreground">
                  {chosen.length} account{chosen.length === 1 ? "" : "s"}{" "}
                  selected · Your draft is saved before publishing.
                </p>
                <Button
                  className="primary-btn w-full rounded-lg"
                  disabled={
                    locked ||
                    !ready ||
                    !!error ||
                    !!issue ||
                    !chosen.length ||
                    w.accounts.isError ||
                    w.accounts.isPending
                  }
                  onClick={() => void send(chosen)}
                >
                  {locked ? <Loader2 className="animate-spin" /> : <Send />}
                  {locked
                    ? "Publishing…"
                    : `Publish now${chosen.length > 1 ? ` to ${chosen.length} accounts` : ""}`}
                </Button>
              </>
            ) : (
              <div className="flex flex-wrap gap-2">
                <Button
                  className="secondary-btn flex-1 rounded-lg"
                  disabled={locked}
                  onClick={() => void checkStatus()}
                >
                  {working ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <RefreshCw />
                  )}
                  Check status
                </Button>
                {!hasCurrentResults && (
                  <Button
                    className="primary-btn flex-1 rounded-lg"
                    disabled={locked}
                    onClick={() =>
                      void send(attempt.payload.linkedin_connection_ids)
                    }
                  >
                    Resume same request
                  </Button>
                )}
                {completed && failed.length > 0 && (
                  <Button
                    className="primary-btn flex-1 rounded-lg"
                    disabled={
                      locked ||
                      !failed.some((result) =>
                        eligible.some(
                          (account) =>
                            account.id === result.linkedin_connection_id,
                        ),
                      )
                    }
                    onClick={() =>
                      void send(
                        failed
                          .filter((result) =>
                            eligible.some(
                              (account) =>
                                account.id === result.linkedin_connection_id,
                            ),
                          )
                          .map((result) => result.linkedin_connection_id),
                        true,
                      )
                    }
                  >
                    Retry failed accounts
                  </Button>
                )}
                <Button
                  variant="ghost"
                  className="rounded-lg"
                  disabled={locked}
                  onClick={onClose}
                >
                  Done
                </Button>
              </div>
            )}
          </footer>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!previewAccount}
        onOpenChange={(open) => !open && setPreviewAccount(null)}
      >
        <DialogContent className="flex max-h-[88dvh] w-[calc(100%-1.5rem)] max-w-2xl flex-col overflow-hidden sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl">
              Preview as {accountName(previewAccount)}
            </DialogTitle>
            <DialogDescription>
              Review this post before publishing to this account.
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 overflow-y-auto rounded-xl bg-muted/30 p-3 sm:p-5">
            <LinkedInEditor
              workspace={{
                ...w,
                account: previewAccount,
                state: {
                  ...w.state,
                  content: snapshot.content,
                  composer: snapshot.composer,
                },
              }}
              preview
              onBusy={() => {}}
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
