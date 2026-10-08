"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  ChevronDown,
  Eye,
  ImagePlus,
  Loader2,
  Send,
  CalendarClock,
} from "lucide-react";
import { useTRPC } from "@/trpc/client";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import AccountAvatar from "@/modules/channels/component/AccountAvatar";
import type { Account, Payload, Variant } from "@/modules/studio/types";
import ScheduleFields from "@/modules/schedule/ScheduleFields";
import {
  localDateTime,
  scheduleInstant,
} from "@/modules/schedule/calendarModel";
import { cn } from "@/lib/utils";
import { PlatformMark } from "./AccountSwitcher";
import { draftText, profileFor, threadItems } from "./model";
import MediaPicker, { MediaPreview } from "./MediaPicker";
import {
  destinationDraft,
  destinationRequestKey,
  destinationText,
  canSubmitDestination,
  submitDestinations,
  type DestinationDraft,
  type DestinationResult,
} from "./publicationModel";
import { xLinkIssues } from "./xLinks";

type Props = {
  source: Variant;
  sourceAccount: Account;
  accounts: Account[];
  assets: Payload[];
  mode: "publish" | "schedule";
  onClose: () => void;
  onVariant: (variant: Variant) => void;
  onBusy?: (busy: boolean) => void;
};

export default function PublicationDialog(props: Props) {
  const trpc = useTRPC();
  const [busy, setBusy] = useState(false);
  const post = useQuery(
    trpc.studio.post.queryOptions({ id: props.source.post_id }),
  );
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) props.onClose();
      }}
    >
      <DialogContent
        showCloseButton={!busy}
        className="sm:max-w-[450px] max-h-[90svh] overflow-y-auto p-0 gap-0"
      >
        {post.isPending ? (
          <>
            <DialogHeader className="sr-only">
              <DialogTitle>Review post</DialogTitle>
              <DialogDescription>
                Loading publishing destinations.
              </DialogDescription>
            </DialogHeader>
            <div
              className="flex items-center justify-center gap-2 p-10"
              role="status"
            >
              <Loader2 className="size-4 animate-spin" />
              Loading destinations…
            </div>
          </>
        ) : post.error ? (
          <div className="p-6 space-y-3">
            <DialogTitle>Could not load this post</DialogTitle>
            <DialogDescription>{post.error.message}</DialogDescription>
            <Button variant="outline" onClick={() => void post.refetch()}>
              Try again
            </Button>
          </div>
        ) : (
          <PublicationContent
            {...props}
            existing={post.data?.variants ?? []}
            onBusy={(value) => {
              setBusy(value);
              props.onBusy?.(value);
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function PublicationContent({
  source,
  sourceAccount,
  accounts,
  assets,
  mode: initialMode,
  onClose,
  onVariant,
  existing,
  onBusy,
}: Props & { existing: Variant[]; onBusy: (busy: boolean) => void }) {
  const trpc = useTRPC();
  const client = useQueryClient();
  const [mode, setMode] = useState(initialMode);
  const [time, setTime] = useState(() =>
    localDateTime(new Date(Date.now() + 3600000)),
  );
  const [selected, setSelected] = useState<string[]>([sourceAccount.id]);
  const [expanded, setExpanded] = useState(sourceAccount.id);
  const [drafts, setDrafts] = useState<Record<string, DestinationDraft>>(() =>
    Object.fromEntries(
      accounts.map((account) => [
        account.id,
        destinationDraft(
          source,
          sourceAccount,
          account,
          account.id === sourceAccount.id
            ? source
            : existing.find(
                (variant) => variant.connected_account_id === account.id,
              ),
        ),
      ]),
    ),
  );
  const [results, setResults] = useState<DestinationResult[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const sending = useRef(false);
  const add = useMutation(trpc.studio.addVariant.mutationOptions());
  const edit = useMutation(trpc.studio.editDraft.mutationOptions());
  const validate = useMutation(trpc.studio.validate.mutationOptions());
  const publish = useMutation(trpc.studio.publish.mutationOptions());
  const schedule = useMutation(trpc.studio.schedule.mutationOptions());
  const sortedAccounts = [...accounts].sort(
    (a, b) =>
      Number(b.id === sourceAccount.id) - Number(a.id === sourceAccount.id),
  );

  async function submit() {
    if (sending.current || !selected.length) return;
    const instant = mode === "schedule" ? scheduleInstant(time) : null;
    if (mode === "schedule" && !instant) {
      setError("Choose a valid future date and time.");
      return;
    }
    setError("");
    sending.current = true;
    setBusy(true);
    onBusy(true);
    setResults([]);
    const snapshot = structuredClone(drafts);
    try {
      const outcome = await submitDestinations(selected, async (id) => {
        const account = accounts.find((item) => item.id === id)!;
        const draft = snapshot[id];
        if (account.status !== "active")
          throw new Error("Reconnect this account before publishing.");
        const currentPost = await client.fetchQuery(
          trpc.studio.post.queryOptions(
            { id: source.post_id },
            { staleTime: 0 },
          ),
        );
        let variant = currentPost.variants.find((item) =>
          draft.variant
            ? item.id === draft.variant.id
            : item.connected_account_id === id,
        );
        const retain = (updated: Variant) => {
          snapshot[id] = { ...draft, variant: updated };
          setDrafts((current) => ({ ...current, [id]: snapshot[id] }));
          if (id === sourceAccount.id) onVariant(updated);
        };
        if (variant && !canSubmitDestination(variant)) {
          retain(variant);
          return {
            accountId: id,
            status: variant.status,
            message: variant.publish_state.outcome_unknown
              ? "The publishing outcome needs reconciliation. Open the post to review it."
              : "This version was already submitted.",
            variant,
          };
        }
        if (account.platform === "x") {
          const linkIssues = xLinkIssues(draft.payload);
          if (linkIssues.length) throw new Error(linkIssues.join(" "));
        }
        const xText = draftText(draft.payload, account.platform).trim();
        if (
          account.platform === "x" &&
          selected.some(
            (otherId) =>
              otherId !== id &&
              accounts.find((item) => item.id === otherId)?.platform === "x" &&
              draftText(snapshot[otherId].payload, "x").trim() === xText,
          )
        )
          throw new Error(
            "Give each X account a distinct version before sharing to multiple X accounts.",
          );
        if (!variant)
          variant = await add.mutateAsync({
            post_id: source.post_id,
            platform: account.platform,
            connected_account_id: id,
            payload: draft.payload,
            media_asset_ids: draft.mediaIds,
            idempotency_key: destinationRequestKey(source.post_id, id),
          });
        if (canSubmitDestination(variant))
          variant = await edit.mutateAsync({
            id: variant.id,
            payload: draft.payload,
            media_asset_ids: draft.mediaIds,
          });
        // Retain the returned ID before validation/submission so partial failures can be retried safely.
        retain(variant);
        if (!canSubmitDestination(variant))
          return {
            accountId: id,
            status: variant.status,
            message: "This version was already submitted.",
            variant,
          };
        const validation = await validate.mutateAsync({ id: variant.id });
        if (!validation.is_valid)
          throw new Error(
            validation.issues
              .filter((issue) => issue.severity === "error")
              .map((issue) => issue.message)
              .join(" "),
          );
        let response: Payload = {};
        let submissionError: unknown;
        try {
          response =
            mode === "schedule"
              ? await schedule.mutateAsync({
                  id: variant.id,
                  scheduled_time: instant!,
                })
              : await publish.mutateAsync({ id: variant.id });
        } catch (failure) {
          submissionError = failure;
        }
        // Reconcile authoritative status, including media processing and uncertain outcomes.
        let updated: Variant;
        try {
          const saved = await client.fetchQuery(
            trpc.studio.post.queryOptions(
              { id: source.post_id },
              { staleTime: 0 },
            ),
          );
          const savedVariant = saved.variants.find(
            (item) => item.id === variant!.id,
          );
          if (!savedVariant)
            throw new Error("This version could not be found.");
          updated = savedVariant;
        } catch {
          // A lost response must never leave an enabled button that can submit again.
          updated = {
            ...variant,
            status: String(response.status ?? "publishing"),
            publish_state: { ...variant.publish_state, outcome_unknown: true },
          };
          retain(updated);
          return {
            accountId: id,
            status: "publishing",
            message:
              "Submission sent. Reopen the post to check its status before retrying.",
            variant: updated,
          };
        }
        retain(updated);
        if (submissionError && canSubmitDestination(updated))
          throw submissionError;
        const status = updated.status;
        const result = {
          accountId: id,
          status,
          message:
            status === "published"
              ? "Published"
              : status === "scheduled"
                ? "Scheduled"
                : status === "publishing"
                  ? "Publishing…"
                  : String(
                      response.last_error ??
                        "Review this post before retrying.",
                    ),
          variant: updated,
        };
        setResults((current) => [...current, result]);
        return result;
      });
      setResults(outcome);
      // Successful accounts are locked; a retry only submits the remaining editable versions.
      setSelected((ids) =>
        ids.filter((id) => {
          const result = outcome.find((item) => item.accountId === id);
          return (
            result?.status === "error" ||
            ["failed", "rejected"].includes(result?.status ?? "")
          );
        }),
      );
      await Promise.all([
        client.invalidateQueries({ queryKey: trpc.studio.home.queryKey() }),
        client.invalidateQueries({ queryKey: trpc.studio.posts.queryKey() }),
        client.invalidateQueries({ queryKey: trpc.studio.post.queryKey() }),
        client.invalidateQueries({ queryKey: trpc.studio.calendar.queryKey() }),
      ]);
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Could not refresh publishing results.",
      );
    } finally {
      sending.current = false;
      setBusy(false);
      onBusy(false);
    }
  }

  return (
    <>
      <DialogHeader className="px-6 pt-6 pb-4 text-left">
        <DialogTitle className="text-xl">
          {mode === "schedule" ? "Schedule post" : "Publish post"}
        </DialogTitle>
        <DialogDescription>
          Select your accounts and review each version before sharing.
        </DialogDescription>
      </DialogHeader>
      <div className="px-6 pb-5 space-y-4">
        <Tabs
          value={mode}
          onValueChange={(value) => {
            setMode(value as typeof mode);
            setError("");
          }}
        >
          <TabsList className="w-full">
            <TabsTrigger className="h-8" value="publish" disabled={busy}>
              Publish now
            </TabsTrigger>
            <TabsTrigger className="h-8" value="schedule" disabled={busy}>
              Schedule
            </TabsTrigger>
          </TabsList>
        </Tabs>
        {mode === "schedule" && (
          <ScheduleFields
            value={time}
            onChange={(value) => {
              setTime(value);
              setError("");
            }}
            disabled={busy}
          />
        )}
        {error && (
          <p role="alert" className="text-xs text-destructive">
            {error}
          </p>
        )}
        <Button
          className="primary-btn w-full rounded-xl"
          disabled={busy || !selected.length}
          onClick={() => void submit()}
        >
          {busy ? (
            <Loader2 className="size-4 animate-spin" />
          ) : mode === "schedule" ? (
            <CalendarClock className="size-4" />
          ) : (
            <Send className="size-4" />
          )}
          {busy
            ? "Submitting…"
            : `${mode === "schedule" ? "Schedule" : "Publish now"}${selected.length ? ` · ${selected.length} ${selected.length === 1 ? "account" : "accounts"}` : ""}`}
        </Button>
      </div>
      <div className="border-t border-border divide-y divide-border">
        {sortedAccounts.map((account) => {
          const draft = drafts[account.id];
          const locked =
            account.status !== "active" || !canSubmitDestination(draft.variant);
          const result = results.find((item) => item.accountId === account.id);
          const linkIssues = !locked && account.platform === "x" && selected.includes(account.id)
            ? xLinkIssues(draft.payload) : [];
          return (
            <div
              key={account.id}
              className={cn(
                "px-6 py-4",
                selected.includes(account.id) && "bg-muted/25",
              )}
            >
              <div className="flex justify-between  items-center gap-3">
               
               <div className="flex items-center gap-2.5">
                   <div className="relative shrink-0">
                  <AccountAvatar account={account} className="size-9 text-xs" />
                  <span className="absolute -bottom-1 -right-1 rounded-full bg-background p-0.5">
                    <PlatformMark platform={account.platform} />
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {account.display_name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {profileFor(account.platform).name}
                    {account.id === sourceAccount.id ? " · Current draft" : ""}
                  </p>
                </div>
               </div>
                

                 <Switch
                  className="primary-switch focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  aria-label={`Publish to ${account.display_name} on ${profileFor(account.platform).name}`}
                  checked={selected.includes(account.id)}
                  disabled={busy || locked}
                  onCheckedChange={(checked) => {
                    setSelected((ids) =>
                      checked
                        ? [...ids, account.id]
                        : ids.filter((id) => id !== account.id),
                    );
                    if (checked) setExpanded(account.id);
                  }}
                />
              </div>
              {account.status !== "active" && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Reconnect this account in{" "}
                  <Link href="/dashboard/channels" className="underline">
                    Channels
                  </Link>
                  .
                </p>
              )}
              {linkIssues.length > 0 && (
                <div role="alert" className="mt-3 space-y-1 text-xs leading-relaxed text-destructive">
                  {linkIssues.map((issue) => <p key={issue}>{issue}</p>)}
                </div>
              )}
              {result ? (
                <p
                  role="status"
                  className={cn(
                    "mt-3 flex items-start gap-1.5 text-xs",
                    ["error", "failed", "rejected"].includes(result.status)
                      ? "text-destructive"
                      : "text-muted-foreground",
                  )}
                >
                  {["published", "scheduled"].includes(result.status) && (
                    <Check className="size-3.5 shrink-0" />
                  )}
                  {result.message}
                </p>
              ) : (
                draft.variant &&
                !canSubmitDestination(draft.variant) && (
                  <p className="mt-2 text-xs text-muted-foreground capitalize">
                    {draft.variant.status.replaceAll("_", " ")} ·{" "}
                    <Link
                      className="underline"
                      href={`/dashboard/content?post=${draft.variant.post_id}&variant=${draft.variant.id}`}
                    >
                      Open post
                    </Link>
                  </p>
                )
              )}
              
            </div>
          );
        })}
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-border px-6 py-4">
        <Link
          className="text-xs text-muted-foreground underline"
          href="/dashboard/channels"
        >
          Manage accounts
        </Link>
        <Button className="h-8" variant="outline" disabled={busy} onClick={onClose}>
          Done
        </Button>
      </div>
    </>
  );
}
