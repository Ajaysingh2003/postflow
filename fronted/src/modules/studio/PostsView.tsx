"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, ArrowLeft, ArrowRight, Calendar, ExternalLink, FileText, Loader2, MessageSquare, Pencil, Plus, RefreshCw, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useTRPC } from "@/trpc/client";
import { channelName, variantText, type Variant } from "./types";

export const button = "inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50";
export const input = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/15";
export const panel = "rounded-xl border border-border bg-background p-5";

function date(value?: string | null) {
  return value ? new Date(value.endsWith("Z") || /[+-]\d\d:\d\d$/.test(value) ? value : value + "Z").toLocaleString() : "";
}

export function Status({ value }: { value: string }) {
  const color = value === "published" ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : value === "failed" ? "bg-red-500/10 text-red-600" : "bg-muted text-muted-foreground";
  return <span className={`rounded-md px-2 py-1 text-[11px] font-medium capitalize ${color}`}>{value.replaceAll("_", " ")}</span>;
}

export function Notice({ message }: { message: string }) {
  return <div role="status" className="flex items-start gap-2 rounded-lg bg-muted/60 p-3 text-xs leading-relaxed text-muted-foreground"><AlertCircle className="mt-0.5 size-4 shrink-0" />{message}</div>;
}

export function Loading() { return <div className="flex justify-center p-12" role="status"><Loader2 className="size-5 animate-spin" /><span className="sr-only">Loading</span></div>; }

export function PostsView({ status, title = "All posts", description = "Your drafts, scheduled posts and published content in one place." }: { status?: string; title?: string; description?: string }) {
  const trpc = useTRPC();
  const [offset, setOffset] = useState(0);
  const [search, setSearch] = useState("");
  const query = useQuery(trpc.studio.posts.queryOptions({ offset, status }));
  const posts = query.data?.filter((post) => `${post.title} ${post.base_text} ${post.variants.map(variantText).join(" ")}`.toLowerCase().includes(search.toLowerCase())) ?? [];
  return <div className="mx-auto max-w-5xl space-y-6 p-5 md:p-8">
    <header className="flex flex-wrap items-start justify-between gap-4"><div><p className="mb-1 text-xs font-medium uppercase tracking-widest text-muted-foreground">Workspace content</p><h1 className="text-2xl font-semibold tracking-tight">{title}</h1><p className="mt-2 text-sm text-muted-foreground">{description}</p></div><Link className={button + " primary-btn"} href="/dashboard/content/compose"><Plus className="size-4" />New post</Link></header>
    <nav className="flex flex-wrap gap-2" aria-label="Post views">{[["All", "/dashboard/posts"], ["Drafts", "/dashboard/content/drafts"], ["Scheduled", "/dashboard/content/schedule"], ["Published", "/dashboard/posts/published"], ["Replies", "/dashboard/posts/replies"], ["Failed", "/dashboard/posts/failed"]].map(([label, href]) => <Link key={href} href={href} className={button}>{label}</Link>)}</nav>
    <div className="flex gap-2"><input aria-label="Search posts on this page" placeholder="Search posts on this page…" className={input} value={search} onChange={(event) => setSearch(event.target.value)} /><button className={button} onClick={() => query.refetch()} aria-label="Refresh posts"><RefreshCw className="size-4" /></button></div>
    {query.isPending ? <Loading /> : query.error ? <Notice message={query.error.message} /> : !posts.length ? <div className={panel + " py-14 text-center"}><FileText className="mx-auto mb-3 size-7 text-muted-foreground" /><h2 className="font-medium">{search ? "No matching posts on this page" : "No posts in this view yet"}</h2><p className="mt-2 text-sm text-muted-foreground">Create a draft, connect a channel and publish when you’re ready.</p></div> : <div className="grid gap-4">{posts.map((post) => <Link key={post.id} href={`/dashboard/posts/${post.id}`} className={panel + " group block transition hover:border-violet-500/50"}><div className="flex items-start justify-between gap-4"><h2 className="font-medium group-hover:text-violet-600">{post.title}</h2><ArrowRight className="size-4 shrink-0 text-muted-foreground" /></div><p className="mt-2 line-clamp-3 whitespace-pre-wrap text-sm text-muted-foreground">{post.base_text || post.variants.map(variantText).find(Boolean) || "Empty draft"}</p><div className="mt-4 flex flex-wrap items-center gap-3">{post.variants.filter((variant) => !status || variant.status === status).map((variant) => <div className="flex items-center gap-2" key={variant.id}><span className="text-xs">{channelName(variant.platform)}</span><Status value={variant.status} /></div>)}<span className="ml-auto text-[11px] text-muted-foreground">Updated {date(post.updated_at)}</span></div></Link>)}</div>}
    <div className="flex items-center justify-between"><button disabled={offset === 0 || query.isPending} className={button} onClick={() => setOffset(Math.max(0, offset - 100))}>Previous</button><span className="text-xs text-muted-foreground">Page {offset / 100 + 1}</span><button disabled={query.isPending || (query.data?.length ?? 0) < 100} className={button} onClick={() => setOffset(offset + 100)}>Next</button></div>
  </div>;
}

function VariantCard({ variant, refresh }: { variant: Variant; refresh: () => void }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [text, setText] = useState(variantText(variant));
  const [repliesOpen, setRepliesOpen] = useState(false);
  const [attemptsOpen, setAttemptsOpen] = useState(false);
  const [cursor, setCursor] = useState<string | undefined>();
  const [cursorHistory, setCursorHistory] = useState<(string | undefined)[]>([]);
  const [replyText, setReplyText] = useState("");
  const [parent, setParent] = useState<{ name: string; token: string } | null>(null);
  const [scheduleAt, setScheduleAt] = useState("");
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const actions = useQuery({ ...trpc.studio.actions.queryOptions({ id: variant.id }), enabled: variant.status === "published" });
  const replies = useQuery({ ...trpc.studio.replies.queryOptions({ id: variant.id, cursor }), enabled: repliesOpen && !!actions.data?.can_read_replies });
  const attempts = useQuery({ ...trpc.studio.attempts.queryOptions({ id: variant.id }), enabled: attemptsOpen });
  async function updated() {
    refresh();
    await queryClient.invalidateQueries({ queryKey: trpc.studio.actions.queryKey({ id: variant.id }) });
    await queryClient.invalidateQueries({ queryKey: trpc.studio.replies.queryKey() });
    await queryClient.invalidateQueries({ queryKey: trpc.studio.attempts.queryKey({ id: variant.id }) });
  }
  const manage = useMutation(trpc.studio.manage.mutationOptions({ onSuccess: (data) => { toast.success(data.message); setEditOpen(false); setReplyText(""); setParent(null); setRequestId(crypto.randomUUID()); void updated(); }, onError: (error) => { toast.error(error.message); void updated(); } }));
  const draft = useMutation(trpc.studio.editDraft.mutationOptions({ onSuccess: () => { toast.success("Draft saved"); setEditOpen(false); void updated(); }, onError: (error) => toast.error(error.message) }));
  const publish = useMutation(trpc.studio.publish.mutationOptions({ onSuccess: (data) => { if (data.status === "published") toast.success("Post published"); else toast.error(typeof data.last_error === "string" ? data.last_error : "Post has not been published yet. Check its status."); void updated(); }, onError: (error) => toast.error(error.message) }));
  const cancel = useMutation(trpc.studio.cancel.mutationOptions({ onSuccess: () => { toast.success("Schedule cancelled; draft available to edit"); void updated(); }, onError: (error) => toast.error(error.message) }));
  const schedule = useMutation(trpc.studio.schedule.mutationOptions({ onSuccess: () => { toast.success("Post scheduled"); void updated(); }, onError: (error) => toast.error(error.message) }));
  const busy = manage.isPending || draft.isPending || publish.isPending || cancel.isPending || schedule.isPending;
  const editableDraft = ["draft", "failed", "rejected"].includes(variant.status) && !variant.publish_state.outcome_unknown && !variant.publish_state.thread_ids && !variant.publish_state.thread_posts;
  const field = variant.platform === "reddit" ? "body" : variant.platform === "instagram" ? "caption" : "text";
  const externalUrl = actions.data?.external_url;
  const safeUrl = externalUrl && /^https:\/\//.test(externalUrl) ? externalUrl : null;

  return <article className={panel + " space-y-4"}>
    <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2"><h2 className="font-semibold">{channelName(variant.platform)}</h2><Status value={variant.status} /></div>{safeUrl && <a className={button} target="_blank" rel="noopener noreferrer" href={safeUrl}><ExternalLink className="size-3.5" />Open original</a>}</div>
    <p className="whitespace-pre-wrap text-sm leading-relaxed">{variantText(variant) || "Media post"}</p>
    {variant.scheduled_time && <p className="text-xs text-muted-foreground">Scheduled: {date(variant.scheduled_time)}</p>}
    {variant.published_at && <p className="text-xs text-muted-foreground">Published: {date(variant.published_at)}</p>}
    {variant.last_error && <Notice message={variant.last_error} />}
    {actions.error && <Notice message={actions.error.message} />}
    {actions.data?.notices.map((notice) => <Notice key={notice} message={notice} />)}
    <div className="flex flex-wrap gap-2">
      {(editableDraft || actions.data?.can_edit) && <button disabled={busy} className={button} onClick={() => { setText(variantText(variant)); setRequestId(crypto.randomUUID()); setEditOpen(!editOpen); }}><Pencil className="size-3.5" />{editableDraft ? "Edit draft" : "Edit published post"}</button>}
      {editableDraft && <button className={button} disabled={busy} onClick={() => { if (window.confirm("Publish this variant now?")) publish.mutate({ id: variant.id }); }}><Send className="size-3.5" />{variant.status === "failed" ? "Retry publishing" : "Publish now"}</button>}
      {variant.status === "scheduled" && <button className={button} disabled={busy} onClick={() => cancel.mutate({ id: variant.id })}>Cancel schedule & edit</button>}
      {(actions.data?.can_read_replies || actions.data?.can_reply) && <button className={button} onClick={() => setRepliesOpen(!repliesOpen)}><MessageSquare className="size-3.5" />Replies & comments</button>}
      {actions.data?.can_delete && <button disabled={busy} className={button + " text-red-600"} onClick={() => { if (window.confirm("Delete this published post from its platform? This cannot be undone.")) manage.mutate({ id: variant.id, action: "delete", request_id: crypto.randomUUID() }); }}><Trash2 className="size-3.5" />Delete from platform</button>}
      <button className={button} onClick={() => setAttemptsOpen(!attemptsOpen)}>Activity log</button>
    </div>
    {editOpen && <form className="space-y-3 border-t border-border pt-4" onSubmit={(event) => { event.preventDefault(); if (editableDraft) draft.mutate({ id: variant.id, payload: { ...variant.payload, [field]: text } }); else manage.mutate({ id: variant.id, action: "edit", request_id: requestId, text }); }}><label className="block space-y-2 text-xs font-medium"><span>{editableDraft ? "Draft text" : "Update published text"}</span><textarea className={input + " min-h-36"} value={text} onChange={(event) => setText(event.target.value)} required /></label><div className="flex gap-2"><button disabled={busy} className={button + " primary-btn"}>Save changes</button><button className={button} type="button" onClick={() => setEditOpen(false)}>Cancel</button></div></form>}
    {editableDraft && <form className="flex flex-wrap items-end gap-2" onSubmit={(event) => { event.preventDefault(); schedule.mutate({ id: variant.id, scheduled_time: new Date(scheduleAt).toISOString() }); }}><label className="space-y-1 text-xs"><span className="block text-muted-foreground">Schedule in your local time</span><input type="datetime-local" className={input} required value={scheduleAt} onChange={(event) => setScheduleAt(event.target.value)} /></label><button className={button} disabled={busy || !scheduleAt}><Calendar className="size-3.5" />Schedule</button></form>}
    {repliesOpen && <section className="space-y-4 border-t border-border pt-4" aria-label="Replies">
      <div className="flex items-center justify-between"><h3 className="text-sm font-semibold">Replies & comments</h3>{actions.data?.can_read_replies && <button className={button} onClick={() => replies.refetch()}><RefreshCw className="size-3.5" />Refresh</button>}</div>
      {replies.isFetching && <Loading />}{replies.error && <Notice message={replies.error.message} />}{replies.data?.notice && <Notice message={replies.data.notice} />}
      {actions.data?.can_read_replies && replies.data && !replies.data.items.length && <p className="text-sm text-muted-foreground">No replies returned by the platform.</p>}
      {replies.data?.items.map((reply) => <div key={reply.id} className="rounded-lg bg-muted/40 p-4"><div className="flex justify-between gap-3"><span className="text-xs font-semibold">{reply.author}</span><span className="text-[11px] text-muted-foreground">{date(reply.created_at)}</span></div><p className="my-2 whitespace-pre-wrap text-sm">{reply.text}</p>{actions.data?.can_reply && <button className={button} onClick={() => { setParent({ name: reply.author, token: reply.target_token }); setRequestId(crypto.randomUUID()); }}>Reply to {reply.author}</button>}</div>)}
      <div className="flex gap-2">{cursorHistory.length > 0 && <button className={button} onClick={() => { setCursor(cursorHistory[cursorHistory.length - 1]); setCursorHistory(cursorHistory.slice(0, -1)); }}>Previous replies</button>}{replies.data?.next_cursor && <button className={button} onClick={() => { setCursorHistory([...cursorHistory, cursor]); setCursor(replies.data?.next_cursor ?? undefined); }}>More replies</button>}</div>
      {actions.data?.reply_requires_parent && !parent && <Notice message="Choose a comment above to reply to it." />}
      {actions.data?.can_reply && (!actions.data.reply_requires_parent || parent) && <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); manage.mutate({ id: variant.id, action: "reply", text: replyText, request_id: requestId, target_token: parent?.token }); }}><label className="block space-y-2 text-xs font-medium"><span>{parent ? `Replying to ${parent.name}` : "Add a reply to your post"}</span><textarea className={input + " min-h-24"} value={replyText} onChange={(event) => setReplyText(event.target.value)} required placeholder="Write your reply…" /></label>{parent && <button type="button" className={button} onClick={() => { setParent(null); setRequestId(crypto.randomUUID()); }}>Reply to original post instead</button>}<button disabled={busy || !replyText.trim()} className={button + " primary-btn"}><Send className="size-3.5" />{manage.isPending ? "Sending…" : "Send reply"}</button></form>}
    </section>}
    {attemptsOpen && <section className="space-y-2 border-t border-border pt-4"><h3 className="text-sm font-semibold">Activity log</h3>{attempts.isPending ? <Loading /> : attempts.error ? <Notice message={attempts.error.message} /> : attempts.data?.map((attempt) => <div className="rounded-lg bg-muted/40 p-3 text-xs" key={String(attempt.id)}><span className="font-medium">{String(attempt.result).replaceAll("_", " ")}</span><span className="ml-3 text-muted-foreground">{date(String(attempt.started_at))}</span>{attempt.error ? <p className="mt-1 text-red-600">{String(attempt.error)}</p> : null}</div>)}</section>}
  </article>;
}

export function PostDetailView({ id }: { id: string }) {
  const trpc = useTRPC();
  const query = useQuery(trpc.studio.post.queryOptions({ id }));
  return <div className="mx-auto max-w-4xl space-y-6 p-5 md:p-8"><Link href="/dashboard/posts" className="inline-flex items-center gap-2 text-xs text-muted-foreground"><ArrowLeft className="size-4" />All posts</Link>{query.isPending ? <Loading /> : query.error ? <Notice message={query.error.message} /> : query.data && <><header><h1 className="text-2xl font-semibold">{query.data.title}</h1><p className="mt-2 text-sm text-muted-foreground">Manage each channel separately. Changes affect the selected channel only.</p></header>{query.data.variants.map((variant) => <VariantCard key={`${variant.id}:${variant.updated_at ?? variant.status}`} variant={variant} refresh={() => { void query.refetch(); }} />)}{!query.data.variants.length && <Notice message="This draft has no channel variants yet." />}</>}</div>;
}
