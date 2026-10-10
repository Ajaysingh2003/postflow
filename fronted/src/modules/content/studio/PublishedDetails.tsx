"use client";

import { useState } from "react";
import { useMutation, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import {
  Bookmark,
  Eye,
  Heart,
  MessageCircle,
  Repeat2,
  RefreshCw,
  ExternalLink,
  Pencil,
  Trash2,
  Send,
} from "lucide-react";
import { toast } from "sonner";
import { useTRPC } from "@/trpc/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { Variant } from "@/modules/studio/types";
import { draftText, profileFor } from "./model";

export function PublishedMetricsSkeleton() {
  return (
    <div className="text-center text-muted-foreground mb-10">
      <div className="h-3 w-28 mx-auto mb-5 rounded bg-muted/40 animate-pulse" />
      <div className="flex items-center justify-center gap-5 flex-wrap">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-5 w-20 rounded bg-muted/30 animate-pulse" />
        ))}
      </div>
    </div>
  );
}

export function PublishedMetrics({ variant }: { variant: Variant }) {
  const trpc = useTRPC();
  const { data, refetch } = useSuspenseQuery(
    trpc.studio.metrics.queryOptions({ id: variant.id }),
  );
  const sync = useMutation(
    trpc.studio.syncMetrics.mutationOptions({
      onSuccess: () => {
        void refetch();
      },
      onError: (error) => toast.error(error.message),
    }),
  );
  const unavailable = Array.isArray(data?.extras?.unavailable_metrics)
    ? (data.extras.unavailable_metrics as string[])
    : [];
  const items = [
    {
      key: "comments",
      label: "Replies",
      icon: MessageCircle,
      value: data?.comments,
    },
    ...(variant.platform === "reddit"
      ? []
      : [
          {
            key: "shares",
            label: variant.platform === "x" ? "Reposts & quotes" : "Reposts",
            icon: Repeat2,
            value: data?.shares,
          },
        ]),
    {
      key: "likes",
      label: variant.platform === "reddit" ? "Score" : "Likes",
      icon: Heart,
      value:
        variant.platform === "reddit" && data?.extras?.score != null
          ? Number(data.extras.score)
          : data?.likes,
    },
    ...(variant.platform === "x"
      ? [
          {
            key: "bookmark_count",
            label: "Bookmarks",
            icon: Bookmark,
            value: Number(data?.extras?.bookmark_count ?? 0),
          },
        ]
      : []),
    { key: "impressions", label: "Views", icon: Eye, value: data?.impressions },
  ];
  return (
    <div className="text-center text-muted-foreground mb-10">
      <p className="text-[11px] mb-5">
        Published on{" "}
        {variant.platform === "x"
          ? "X"
          : variant.platform === "reddit"
            ? `r/${String(variant.payload.subreddit ?? "")}`
            : profileFor(variant.platform).name}
      </p>
      <div className="flex items-center justify-center gap-5 flex-wrap">
        {items.map((item) => (
          <span key={item.key} title={item.label} className="flex items-center gap-1.5 text-[11px]">
            <item.icon size={16} />
            <strong className="font-normal tabular-nums text-foreground">
              {data?.latest_snapshot_at && !unavailable.includes(item.key)
                ? (item.value ?? 0).toLocaleString()
                : "—"}
            </strong>
            <small className="text-[9px] opacity-60">{item.label}</small>
          </span>
        ))}
        <button
          className="p-1 hover:text-foreground transition-colors cursor-pointer"
          aria-label="Refresh published post metrics"
          disabled={sync.isPending}
          onClick={() => sync.mutate()}
        >
          <RefreshCw
            size={15}
            className={sync.isPending ? "animate-spin" : ""}
          />
        </button>
      </div>
      <small className="block mt-4 text-[9px] text-muted-foreground">
        {data?.latest_snapshot_at
          ? `Updated ${new Date(data.latest_snapshot_at).toLocaleString()}`
          : "Metrics will appear after the platform’s first successful sync."}
      </small>
    </div>
  );
}

export default function PublishedDetails({
  variant,
  onRefresh,
}: {
  variant: Variant;
  onRefresh: () => void;
}) {
  const trpc = useTRPC();
  const actions = useQuery(
    trpc.studio.actions.queryOptions({ id: variant.id }),
  );
  const [showReplies, setShowReplies] = useState(false);
  const [cursor, setCursor] = useState<string | undefined>();
  const replies = useQuery(
    trpc.studio.replies.queryOptions(
      { id: variant.id, cursor },
      { enabled: showReplies && actions.data?.can_read_replies === true },
    ),
  );
  const [dialog, setDialog] = useState<"edit" | "delete" | "reply" | null>(
    null,
  );
  const [text, setText] = useState("");
  const [target, setTarget] = useState<string | undefined>();
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const [originalRequest, setOriginalRequest] = useState<string | null>(null);
  const manage = useMutation(
    trpc.studio.manage.mutationOptions({
      onSuccess: (data) => {
        toast.success(data.message);
        setDialog(null);
        setText("");
        onRefresh();
        void replies.refetch();
      },
      onError: (error) => toast.error(error.message),
    }),
  );
  function open(action: "edit" | "delete" | "reply", targetToken?: string) {
    setDialog(action);
    setText(
      action === "edit" ? draftText(variant.payload, variant.platform) : "",
    );
    setTarget(targetToken);
    setRequestId(crypto.randomUUID());
    setOriginalRequest(null);
    manage.reset();
  }
  const notices = actions.data?.notices ?? [];
  return (
    <section className="mt-6">
      <div className="flex justify-center gap-2.5 flex-wrap my-6">
        {actions.data?.external_url && (
          <a
            href={actions.data.external_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 border border-border rounded-lg p-2 px-3 text-muted-foreground text-[11px] hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
          >
            <ExternalLink size={15} />
            View original
          </a>
        )}
        {actions.data?.can_read_replies && (
          <button
            className="flex items-center gap-1.5 border border-border rounded-lg p-2 px-3 text-muted-foreground text-[11px] hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
            onClick={() => setShowReplies(!showReplies)}
          >
            <MessageCircle size={15} />
            {showReplies ? "Hide" : "View"} replies
          </button>
        )}
        {actions.data?.can_reply && !actions.data.reply_requires_parent && (
          <button
            className="flex items-center gap-1.5 border border-border rounded-lg p-2 px-3 text-muted-foreground text-[11px] hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
            onClick={() => open("reply")}
          >
            <MessageCircle size={15} />
            Reply to this post
          </button>
        )}
        {actions.data?.can_edit && (
          <button
            className="flex items-center gap-1.5 border border-border rounded-lg p-2 px-3 text-muted-foreground text-[11px] hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
            onClick={() => open("edit")}
          >
            <Pencil size={15} />
            Edit published post
          </button>
        )}
        {actions.data?.can_delete && (
          <button
            className="flex items-center gap-1.5 border border-border rounded-lg p-2 px-3 text-muted-foreground text-[11px] hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
            onClick={() => open("delete")}
          >
            <Trash2 size={15} />
            Delete
          </button>
        )}
      </div>
      {actions.isPending && <p>Loading available actions…</p>}
      {actions.error && (
        <p className="text-[11px] leading-relaxed text-destructive py-2 whitespace-pre-wrap">{actions.error.message}</p>
      )}
      {notices.map((notice) => (
        <p className="text-[10px] text-center text-muted-foreground my-2" key={notice}>
          {notice}
        </p>
      ))}
      {showReplies && (
        <div className="mt-7 border-t border-border text-xs">
          <header className="flex justify-between items-center py-4 text-xs font-semibold">
            <strong>Conversation</strong>
            <button
              aria-label="Refresh replies"
              onClick={() => void replies.refetch()}
            >
              <RefreshCw size={14} />
            </button>
          </header>
          {replies.isFetching && <p>Loading replies…</p>}
          {replies.error && (
            <p className="text-[11px] leading-relaxed text-destructive py-2 whitespace-pre-wrap">{replies.error.message}</p>
          )}
          {replies.data?.notice && <p>{replies.data.notice}</p>}
          {replies.data?.items.map((reply) => (
            <article key={reply.id} className="border-b border-border py-3.5 text-xs">
              <strong>{reply.author}</strong>
              <p className="leading-relaxed whitespace-pre-wrap mt-1.5">{reply.text}</p>
              {actions.data?.can_reply && (
                <button
                  className="mt-2 text-muted-foreground text-[11px] hover:text-foreground transition-colors cursor-pointer"
                  onClick={() => open("reply", reply.target_token)}
                >
                  Reply
                </button>
              )}
            </article>
          ))}
          {replies.data && !replies.data.items.length && (
            <p>No replies available yet.</p>
          )}
          {replies.data?.next_cursor && (
            <button onClick={() => setCursor(replies.data!.next_cursor!)}>
              Next replies
            </button>
          )}
        </div>
      )}
      <Dialog
        open={dialog !== null}
        onOpenChange={(open) => {
          if (!open && !manage.isPending) setDialog(null);
        }}
      >
        <DialogContent className="sm:max-w-lg p-6">
          <DialogHeader>
            <DialogTitle>
              {dialog === "edit"
                ? "Edit published post"
                : dialog === "delete"
                  ? "Delete this published post?"
                  : "Write a reply"}
            </DialogTitle>
            <DialogDescription>
              {dialog === "delete"
                ? "This removes the post from the platform. This cannot be undone."
                : dialog === "edit" && variant.platform === "reddit"
                  ? "You can update the text body. Reddit titles and links cannot be changed."
                  : "Your changes will be sent to the connected account."}
            </DialogDescription>
          </DialogHeader>
          {dialog !== "delete" && (
            <textarea
              aria-label={
                dialog === "edit" ? "Updated post text" : "Reply text"
              }
              rows={6}
              value={text}
              disabled={manage.isPending || originalRequest !== null}
              maxLength={
                dialog === "reply" ? actions.data?.max_reply_length : undefined
              }
              onChange={(e) => setText(e.target.value)}
              className="border border-border p-3 rounded-lg text-sm leading-relaxed resize-y w-full bg-background outline-none focus-visible:ring-1 focus-visible:ring-ring text-foreground"
            />
          )}
          {manage.error && (
            <p className="text-[11px] leading-relaxed text-destructive py-2 whitespace-pre-wrap">
              {manage.error.message} Check the platform before retrying if the
              result is uncertain.
            </p>
          )}
          <button
            className={cn(
              "inline-flex items-center justify-center gap-1.5 text-xs font-medium rounded-md px-3.5 py-2.5 text-white cursor-pointer whitespace-nowrap transition-colors disabled:opacity-40 disabled:cursor-not-allowed w-full mt-3",
              dialog === "delete"
                ? "bg-[#bd4e4e] hover:bg-[#a33f3f]"
                : "bg-[#239a7d] hover:bg-[#198268]",
            )}
            disabled={manage.isPending || (!text.trim() && dialog !== "delete")}
            onClick={() => {
              if (!dialog) return;
              setOriginalRequest(text);
              manage.mutate({
                id: variant.id,
                action: dialog,
                request_id: requestId,
                text: dialog === "delete" ? undefined : text,
                target_token: target,
              });
            }}
          >
            <Send size={14} />
            {manage.isPending
              ? "Sending…"
              : dialog === "delete"
                ? "Delete published post"
                : dialog === "edit"
                  ? "Save changes"
                  : "Send reply"}
          </button>
        </DialogContent>
      </Dialog>
    </section>
  );
}
