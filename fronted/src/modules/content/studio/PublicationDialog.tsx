"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronDown, Eye, ImagePlus, Loader2, Send, CalendarClock } from "lucide-react";
import { useTRPC } from "@/trpc/client";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import AccountAvatar from "@/modules/channels/component/AccountAvatar";
import type { Account, Payload, Variant } from "@/modules/studio/types";
import ScheduleFields from "@/modules/schedule/ScheduleFields";
import { localDateTime, scheduleInstant } from "@/modules/schedule/calendarModel";
import { cn } from "@/lib/utils";
import { PlatformMark } from "./AccountSwitcher";
import { draftText, profileFor, threadItems } from "./model";
import MediaPicker, { MediaPreview } from "./MediaPicker";
import { destinationDraft, destinationRequestKey, destinationText, canSubmitDestination, submitDestinations, type DestinationDraft, type DestinationResult } from "./publicationModel";
import { editorMedia, socialEditorIssues } from "../component/editor/socialEditorModel";

type Props = { source: Variant; sourceAccount: Account; accounts: Account[]; assets: Payload[]; mode: "publish" | "schedule"; onClose: () => void; onVariant: (variant: Variant) => void; onBusy?: (busy: boolean) => void };

export default function PublicationDialog(props: Props) {
  const trpc = useTRPC();
  const [busy, setBusy] = useState(false);
  const post = useQuery(trpc.studio.post.queryOptions({ id: props.source.post_id }));
  return <Dialog open onOpenChange={(open) => { if (!open && !busy) props.onClose(); }}>
    <DialogContent showCloseButton={!busy} className="sm:max-w-[620px] max-h-[90svh] overflow-y-auto p-0 gap-0">
      {post.isPending ? <><DialogHeader className="sr-only"><DialogTitle>Review post</DialogTitle><DialogDescription>Loading publishing destinations.</DialogDescription></DialogHeader><div className="flex items-center justify-center gap-2 p-10" role="status"><Loader2 className="size-4 animate-spin" />Loading destinations…</div></> : post.error ? <div className="p-6 space-y-3"><DialogTitle>Could not load this post</DialogTitle><DialogDescription>{post.error.message}</DialogDescription><Button variant="outline" onClick={() => void post.refetch()}>Try again</Button></div> : <PublicationContent {...props} existing={post.data?.variants ?? []} onBusy={(value) => { setBusy(value); props.onBusy?.(value); }} />}
    </DialogContent>
  </Dialog>;
}

function PublicationContent({ source, sourceAccount, accounts, assets, mode: initialMode, onClose, onVariant, existing, onBusy }: Props & { existing: Variant[]; onBusy: (busy: boolean) => void }) {
  const trpc = useTRPC();
  const client = useQueryClient();
  const [mode, setMode] = useState(initialMode);
  const [time, setTime] = useState(() => localDateTime(new Date(Date.now() + 3600000)));
  const [selected, setSelected] = useState<string[]>([sourceAccount.id]);
  const [expanded, setExpanded] = useState(sourceAccount.id);
  const [drafts, setDrafts] = useState<Record<string, DestinationDraft>>(() => Object.fromEntries(accounts.map((account) => [account.id, destinationDraft(source, sourceAccount, account, account.id === sourceAccount.id ? source : existing.find((variant) => variant.connected_account_id === account.id))])));
  const [results, setResults] = useState<DestinationResult[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const sending = useRef(false);
  const add = useMutation(trpc.studio.addVariant.mutationOptions());
  const edit = useMutation(trpc.studio.editDraft.mutationOptions());
  const validate = useMutation(trpc.studio.validate.mutationOptions());
  const publish = useMutation(trpc.studio.publish.mutationOptions());
  const schedule = useMutation(trpc.studio.schedule.mutationOptions());
  const sortedAccounts = [...accounts].sort((a, b) => Number(b.id === sourceAccount.id) - Number(a.id === sourceAccount.id));

  async function submit() {
    if (sending.current || !selected.length) return;
    const instant = mode === "schedule" ? scheduleInstant(time) : null;
    if (mode === "schedule" && !instant) { setError("Choose a valid future date and time."); return; }
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
        if (account.status !== "active") throw new Error("Reconnect this account before publishing.");
        const currentPost = await client.fetchQuery(trpc.studio.post.queryOptions({ id: source.post_id }, { staleTime: 0 }));
        let variant = currentPost.variants.find((item) => draft.variant ? item.id === draft.variant.id : item.connected_account_id === id);
        const retain = (updated: Variant) => {
          snapshot[id] = { ...draft, variant: updated };
          setDrafts((current) => ({ ...current, [id]: snapshot[id] }));
          if (id === sourceAccount.id) onVariant(updated);
        };
        if (variant && !canSubmitDestination(variant)) {
          retain(variant);
          return { accountId: id, status: variant.status, message: variant.publish_state.outcome_unknown ? "The publishing outcome needs reconciliation. Open the post to review it." : "This version was already submitted.", variant };
        }
        const xText = draftText(draft.payload, account.platform).trim();
        if (account.platform === "x" && selected.some((otherId) => otherId !== id && accounts.find((item) => item.id === otherId)?.platform === "x" && draftText(snapshot[otherId].payload, "x").trim() === xText)) throw new Error("Give each X account a distinct version before sharing to multiple X accounts.");
        if (!variant) variant = await add.mutateAsync({ post_id: source.post_id, platform: account.platform, connected_account_id: id, payload: draft.payload, media_asset_ids: draft.mediaIds, idempotency_key: destinationRequestKey(source.post_id, id) });
        if (canSubmitDestination(variant)) variant = await edit.mutateAsync({ id: variant.id, payload: draft.payload, media_asset_ids: draft.mediaIds });
        // Retain the returned ID before validation/submission so partial failures can be retried safely.
        retain(variant);
        if (!canSubmitDestination(variant)) return { accountId: id, status: variant.status, message: "This version was already submitted.", variant };
        const validation = await validate.mutateAsync({ id: variant.id });
        if (!validation.is_valid) throw new Error(validation.issues.filter((issue) => issue.severity === "error").map((issue) => issue.message).join(" "));
        let response: Payload = {};
        let submissionError: unknown;
        try {
          response = mode === "schedule" ? await schedule.mutateAsync({ id: variant.id, scheduled_time: instant! }) : await publish.mutateAsync({ id: variant.id });
        } catch (failure) { submissionError = failure; }
        // Reconcile authoritative status, including media processing and uncertain outcomes.
        let updated: Variant;
        try {
          const saved = await client.fetchQuery(trpc.studio.post.queryOptions({ id: source.post_id }, { staleTime: 0 }));
          const savedVariant = saved.variants.find((item) => item.id === variant!.id);
          if (!savedVariant) throw new Error("This version could not be found.");
          updated = savedVariant;
        } catch {
          // A lost response must never leave an enabled button that can submit again.
          updated = { ...variant, status: String(response.status ?? "publishing"), publish_state: { ...variant.publish_state, outcome_unknown: true } };
          retain(updated);
          return { accountId: id, status: "publishing", message: "Submission sent. Reopen the post to check its status before retrying.", variant: updated };
        }
        retain(updated);
        if (submissionError && canSubmitDestination(updated)) throw submissionError;
        const status = updated.status;
        const result = { accountId: id, status, message: status === "published" ? "Published" : status === "scheduled" ? "Scheduled" : status === "publishing" ? "Publishing…" : String(response.last_error ?? "Review this post before retrying."), variant: updated };
        setResults((current) => [...current, result]);
        return result;
      });
      setResults(outcome);
      // Successful accounts are locked; a retry only submits the remaining editable versions.
      setSelected((ids) => ids.filter((id) => { const result = outcome.find((item) => item.accountId === id); return result?.status === "error" || ["failed", "rejected"].includes(result?.status ?? ""); }));
      await Promise.all([client.invalidateQueries({ queryKey: trpc.studio.posts.queryKey() }), client.invalidateQueries({ queryKey: trpc.studio.post.queryKey() }), client.invalidateQueries({ queryKey: trpc.studio.calendar.queryKey() })]);
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Could not refresh publishing results."); }
    finally { sending.current = false; setBusy(false); onBusy(false); }
  }

  return <>
    <DialogHeader className="px-6 pt-6 pb-4 text-left">
      <DialogTitle className="text-xl">{mode === "schedule" ? "Schedule post" : "Publish post"}</DialogTitle>
      <DialogDescription>Select your accounts and review each version before sharing.</DialogDescription>
    </DialogHeader>
    <div className="px-6 pb-5 space-y-4">
      <Tabs value={mode} onValueChange={(value) => { setMode(value as typeof mode); setError(""); }}><TabsList className="w-full"><TabsTrigger value="publish" disabled={busy}>Publish now</TabsTrigger><TabsTrigger value="schedule" disabled={busy}>Schedule</TabsTrigger></TabsList></Tabs>
      {mode === "schedule" && <ScheduleFields value={time} onChange={(value) => { setTime(value); setError(""); }} disabled={busy} />}
      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
      <Button className="primary-btn w-full rounded-xl" disabled={busy || !selected.length} onClick={() => void submit()}>{busy ? <Loader2 className="size-4 animate-spin" /> : mode === "schedule" ? <CalendarClock className="size-4" /> : <Send className="size-4" />}{busy ? "Submitting…" : `${mode === "schedule" ? "Schedule" : "Publish now"}${selected.length ? ` · ${selected.length} ${selected.length === 1 ? "account" : "accounts"}` : ""}`}</Button>
    </div>
    <div className="border-t border-border divide-y divide-border">
      {sortedAccounts.map((account) => {
        const draft = drafts[account.id];
        const locked = account.status !== "active" || !canSubmitDestination(draft.variant);
        const result = results.find((item) => item.accountId === account.id);
        return <div key={account.id} className={cn("px-6 py-4", selected.includes(account.id) && "bg-muted/25")}>
          <div className="flex items-center gap-3">
            <Switch className="primary-switch focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" aria-label={`Publish to ${account.display_name} on ${profileFor(account.platform).name}`} checked={selected.includes(account.id)} disabled={busy || locked} onCheckedChange={(checked) => { setSelected((ids) => checked ? [...ids, account.id] : ids.filter((id) => id !== account.id)); if (checked) setExpanded(account.id); }} />
            <div className="relative shrink-0"><AccountAvatar account={account} className="size-9 text-xs" /><span className="absolute -bottom-1 -right-1 rounded-full bg-background p-0.5"><PlatformMark platform={account.platform} /></span></div>
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{account.display_name}</p><p className="text-xs text-muted-foreground">{profileFor(account.platform).name}{account.id === sourceAccount.id ? " · Current draft" : ""}</p></div>
            <Button size="sm" variant="ghost" aria-expanded={expanded === account.id} aria-label={`Review ${account.display_name} on ${profileFor(account.platform).name}`} onClick={() => setExpanded(expanded === account.id ? "" : account.id)}><Eye className="size-3.5" /><span className="hidden sm:inline">Review</span><ChevronDown className={cn("size-3.5", expanded === account.id && "rotate-180")} /></Button>
          </div>
          {account.status !== "active" && <p className="mt-2 text-xs text-muted-foreground">Reconnect this account in <Link href="/dashboard/channels" className="underline">Channels</Link>.</p>}
          {result ? <p role="status" className={cn("mt-3 flex items-start gap-1.5 text-xs", ["error", "failed", "rejected"].includes(result.status) ? "text-destructive" : "text-muted-foreground")}>{["published", "scheduled"].includes(result.status) && <Check className="size-3.5 shrink-0" />}{result.message}</p> : draft.variant && !canSubmitDestination(draft.variant) && <p className="mt-2 text-xs text-muted-foreground capitalize">{draft.variant.status.replaceAll("_", " ")} · <Link className="underline" href={`/dashboard/content?post=${draft.variant.post_id}&variant=${draft.variant.id}`}>Open post</Link></p>}
          {expanded === account.id && <DestinationEditor account={account} draft={draft} assets={assets} disabled={busy || locked} onChange={(next) => setDrafts((current) => ({ ...current, [account.id]: next }))} />}
        </div>;
      })}
    </div>
    <div className="flex items-center justify-between gap-3 border-t border-border px-6 py-4"><Link className="text-xs text-muted-foreground underline" href="/dashboard/channels">Manage accounts</Link><Button variant="outline" disabled={busy} onClick={onClose}>Done</Button></div>
  </>;
}

function DestinationEditor({ account, draft, assets, disabled, onChange }: { account: Account; draft: DestinationDraft; assets: Payload[]; disabled: boolean; onChange: (draft: DestinationDraft) => void }) {
  const trpc = useTRPC();
  const client = useQueryClient();
  const [mediaOpen, setMediaOpen] = useState(false);
  const needsTargets = ["facebook", "instagram", "linkedin"].includes(account.platform);
  const targets = useQuery(trpc.studio.targets.queryOptions({ id: account.id }, { enabled: needsTargets && account.status === "active" }));
  const caps = useQuery(trpc.studio.accountCapabilities.queryOptions({ id: account.id }));
  const field = account.platform === "facebook" ? "page_id" : account.platform === "instagram" ? "target_id" : "target_urn";
  const patch = (changes: Payload) => onChange({ ...draft, payload: { ...draft.payload, ...changes } });
  const issues = socialEditorIssues(account.platform, draft.payload, editorMedia(draft.payload, draft.mediaIds, assets), caps.data ?? {});
  const items = Array.isArray(draft.payload.thread) ? threadItems(draft.payload) : [draft.payload];
  const targetId = String(draft.payload[field] ?? "");
  const targetName = targets.data?.targets.find((target) => target.id === targetId)?.name ?? (account.platform === "linkedin" && !targetId ? "Personal profile" : targetId || undefined);
  const instagramFormat = String(draft.payload.media_type ?? (draft.mediaIds.length > 1 ? "CAROUSEL" : assets.find((asset) => asset.id === draft.mediaIds[0])?.content_type?.toString().startsWith("video/") ? "REELS" : "IMAGE"));
  const audiences: Record<string, string> = account.platform === "x" ? { everyone: "Everyone", following: "Accounts you follow", mentionedUsers: "Mentioned accounts", subscribers: "Subscribers", verified: "Verified accounts" } : { PUBLIC: "Everyone", CONNECTIONS: "Connections" };
  const audienceField = account.platform === "x" ? "reply_settings" : "visibility";
  const audience = String(draft.payload[audienceField] ?? (account.platform === "x" ? "everyone" : "PUBLIC"));
  return <div className="mt-4 space-y-3">
    {needsTargets && <div className="space-y-1.5"><Label htmlFor={`target-${account.id}`} className="text-xs">Publish as</Label><Select value={targetId} disabled={disabled || targets.isPending || !!targets.error} onValueChange={(value) => patch({ [field]: value })}><SelectTrigger id={`target-${account.id}`} className="w-full rounded-lg"><SelectValue placeholder="Choose publishing account">{targetName}</SelectValue></SelectTrigger><SelectContent>{account.platform === "linkedin" && <SelectItem value="">Personal profile</SelectItem>}{targets.data?.targets.map((target) => <SelectItem key={target.id} value={target.id}>{target.name}</SelectItem>)}</SelectContent></Select>{targets.error && <p role="alert" className="text-xs text-destructive">{targets.error.message}</p>}</div>}
    {account.platform === "reddit" && <div className="grid gap-3 sm:grid-cols-2"><Input aria-label="Reddit community" placeholder="Subreddit" value={String(draft.payload.subreddit ?? "")} disabled={disabled} onChange={(e) => patch({ subreddit: e.target.value.replace(/^r\//, "") })} /><Input aria-label="Reddit post title" placeholder="Post title" value={String(draft.payload.title ?? "")} disabled={disabled} onChange={(e) => patch({ title: e.target.value })} /></div>}
    {["x", "linkedin"].includes(account.platform) && <div className="space-y-1.5"><Label htmlFor={`audience-${account.id}`} className="text-xs">{account.platform === "x" ? "Who can reply" : "Post visibility"}</Label><Select disabled={disabled} value={audience} onValueChange={(value) => patch({ [audienceField]: value === "everyone" ? null : value })}><SelectTrigger id={`audience-${account.id}`} className="w-full"><SelectValue>{audiences[audience]}</SelectValue></SelectTrigger><SelectContent>{Object.entries(audiences).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div>}
    {items.map((item, index) => <Textarea key={index} aria-label={`${profileFor(account.platform).name} version ${index + 1}`} value={String(item[Array.isArray(draft.payload.thread) ? "text" : profileFor(account.platform).textKey] ?? "")} disabled={disabled} onChange={(event) => onChange({ ...draft, payload: destinationText(draft.payload, account.platform, index, event.target.value) })} className="min-h-28 rounded-xl text-[15.5px] md:text-[15.5px] leading-relaxed" />)}
    {account.platform === "facebook" && <Input aria-label="Facebook link" placeholder="Link URL (optional)" disabled={disabled} value={String(draft.payload.link ?? "")} onChange={(event) => patch({ link: event.target.value })} />}
    {account.platform === "instagram" && <Select disabled={disabled} value={instagramFormat} onValueChange={(value) => patch({ media_type: value })}><SelectTrigger aria-label="Instagram format" className="w-full"><SelectValue>{({ IMAGE: "Photo", CAROUSEL: "Carousel", REELS: "Reel" } as Record<string, string>)[instagramFormat]}</SelectValue></SelectTrigger><SelectContent><SelectItem value="IMAGE">Photo</SelectItem><SelectItem value="CAROUSEL">Carousel</SelectItem><SelectItem value="REELS">Reel</SelectItem></SelectContent></Select>}
    <MediaPreview assets={assets} ids={draft.mediaIds} readOnly={disabled} onRemove={(id) => onChange({ ...draft, mediaIds: draft.mediaIds.filter((item) => item !== id) })} />
    <div className="flex items-center justify-between gap-2"><Button variant="outline" size="sm" disabled={disabled} onClick={() => setMediaOpen(true)}><ImagePlus className="size-3.5" />Media</Button><span className="text-xs text-muted-foreground">{draftText(draft.payload, account.platform).length} characters</span></div>
    {issues.map((issue) => <p key={issue} className="text-xs text-muted-foreground">{issue}</p>)}
    <MediaPicker open={mediaOpen} onClose={() => setMediaOpen(false)} ids={draft.mediaIds} assets={assets} capabilities={caps.data ?? {}} platform={account.platform} onChange={(mediaIds) => onChange({ ...draft, mediaIds })} onRefresh={() => void client.invalidateQueries({ queryKey: trpc.studio.resource.queryKey({ kind: "media" }) })} />
  </div>;
}
