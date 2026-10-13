"use client";

import { useState } from "react";
import { useMutation, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import {
  Bookmark,
  ExternalLink,
  Eye,
  Heart,
  MessageCircle,
  Pencil,
  RefreshCw,
  Repeat2,
  Send,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { useTRPC } from "@/trpc/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { Variant } from "@/modules/studio/types";
import { draftText, profileFor } from "./model";

/* -------------------------------------------------------------------------- */
/* Types & helpers                                                            */
/* -------------------------------------------------------------------------- */

type DialogMode = "edit" | "delete" | "reply";

function platformLabel(variant: Variant) {
  if (variant.platform === "x") return "X";
  if (variant.platform === "reddit")
    return `r/${String(variant.payload.subreddit ?? "")}`;
  return profileFor(variant.platform).name;
}

function dialogCopy(mode: DialogMode | null, platform: Variant["platform"]) {
  switch (mode) {
    case "edit":
      return {
        title: "Edit published post",
        description:
          platform === "reddit"
            ? "You can update the text body. Reddit titles and links cannot be changed."
            : "Your changes will be sent to the connected account.",
        submit: "Save changes",
      };
    case "delete":
      return {
        title: "Delete this published post?",
        description:
          "This removes the post from the platform. This cannot be undone.",
        submit: "Delete published post",
      };
    default:
      return {
        title: "Write a reply",
        description: "Your changes will be sent to the connected account.",
        submit: "Send reply",
      };
  }
}

/* -------------------------------------------------------------------------- */
/* Small shared pieces                                                        */
/* -------------------------------------------------------------------------- */

function ActionButton({
  icon: Icon,
  children,
  ...props
}: {
  icon: React.ElementType;
  children: React.ReactNode;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
    >
      <Icon size={15} />
      {children}
    </button>
  );
}

function ErrorText({ children }: { children: React.ReactNode }) {
  return (
    <p className="whitespace-pre-wrap py-2 text-[11px] leading-relaxed text-destructive">
      {children}
    </p>
  );
}

function MutedText({ children }: { children: React.ReactNode }) {
  return <p className="py-2 text-[11px] text-muted-foreground">{children}</p>;
}

/* -------------------------------------------------------------------------- */
/* Metrics                                                                    */
/* -------------------------------------------------------------------------- */

export function PublishedMetricsSkeleton() {
  return (
    <div className="mb-10 text-center text-muted-foreground">
      <div className="mx-auto mb-5 h-3 w-28 animate-pulse rounded bg-muted/40" />
      <div className="flex flex-wrap items-center justify-center gap-5">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-5 w-20 animate-pulse rounded bg-muted/30" />
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

  const isReddit = variant.platform === "reddit";
  const isX = variant.platform === "x";

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
    ...(isReddit
      ? []
      : [
          {
            key: "shares",
            label: isX ? "Reposts & quotes" : "Reposts",
            icon: Repeat2,
            value: data?.shares,
          },
        ]),
    {
      key: "likes",
      label: isReddit ? "Score" : "Likes",
      icon: Heart,
      value:
        isReddit && data?.extras?.score != null
          ? Number(data.extras.score)
          : data?.likes,
    },
    ...(isX
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

  const hasSnapshot = Boolean(data?.latest_snapshot_at);

  return (
    <div className="mb-10 text-center text-muted-foreground">
      <p className="mb-5 text-[11px]">Published on {platformLabel(variant)}</p>

      <div className="flex flex-wrap items-center justify-center gap-5">
        {items.map((item) => (
          <span
            key={item.key}
            title={item.label}
            className="flex items-center gap-1.5 text-[11px]"
          >
            <item.icon size={16} />
            <strong className="font-normal tabular-nums text-foreground">
              {hasSnapshot && !unavailable.includes(item.key)
                ? (item.value ?? 0).toLocaleString()
                : "—"}
            </strong>
            <small className="text-[9px] opacity-60">{item.label}</small>
          </span>
        ))}

        <button
          type="button"
          className="cursor-pointer p-1 transition-colors hover:text-foreground disabled:cursor-not-allowed"
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

      <small className="mt-4 block text-[9px] text-muted-foreground">
        {hasSnapshot
          ? `Updated ${new Date(data!.latest_snapshot_at!).toLocaleString()}`
          : "Metrics will appear after the platform’s first successful sync."}
      </small>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Manage dialog (edit / delete / reply)                                      */
/* -------------------------------------------------------------------------- */

function ManageDialog({
  mode,
  platform,
  text,
  onTextChange,
  maxLength,
  isPending,
  locked,
  error,
  onClose,
  onSubmit,
}: {
  mode: DialogMode | null;
  platform: Variant["platform"];
  text: string;
  onTextChange: (value: string) => void;
  maxLength?: number;
  isPending: boolean;
  locked: boolean;
  error?: string;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const copy = dialogCopy(mode, platform);
  const isDelete = mode === "delete";

  return (
    <Dialog
      open={mode !== null}
      onOpenChange={(open) => {
        if (!open && !isPending) onClose();
      }}
    >
      <DialogContent className="p-6 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>{copy.description}</DialogDescription>
        </DialogHeader>

        {!isDelete && (
          <textarea
            aria-label={mode === "edit" ? "Updated post text" : "Reply text"}
            rows={6}
            value={text}
            disabled={isPending || locked}
            maxLength={mode === "reply" ? maxLength : undefined}
            onChange={(e) => onTextChange(e.target.value)}
            className="w-full resize-y rounded-lg border border-border bg-background p-3 text-sm leading-relaxed text-foreground outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        )}

        {error && (
          <ErrorText>
            {error} Check the platform before retrying if the result is
            uncertain.
          </ErrorText>
        )}

        <button
          type="button"
          className={cn(
            "mt-3 inline-flex primary-btn w-full cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-3.5 py-2.5 text-xs font-medium text-white transition-colors disabled:cursor-not-allowed disabled:opacity-40",
            isDelete
              ? "!bg-[#bd4e4e] hover:bg-[#a33f3f]"
              : "bg-[#239a7d] hover:bg-[#198268]",
          )}
          disabled={isPending || (!isDelete && !text.trim())}
          onClick={onSubmit}
        >
          <Send size={14} />
          {isPending ? "Sending…" : copy.submit}
        </button>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------------------------------------------------------- */
/* Published details                                                          */
/* -------------------------------------------------------------------------- */

export default function PublishedDetails({
  variant,
  onRefresh,
}: {
  variant: Variant;
  onRefresh: () => void;
}) {
  const trpc = useTRPC();

  const actions = useQuery(trpc.studio.actions.queryOptions({ id: variant.id }));
  const canReadReplies = actions.data?.can_read_replies === true;

  const [showReplies, setShowReplies] = useState(false);
  const [cursor, setCursor] = useState<string | undefined>();
  const replies = useQuery(
    trpc.studio.replies.queryOptions(
      { id: variant.id, cursor },
      { enabled: showReplies && canReadReplies },
    ),
  );

  const [dialog, setDialog] = useState<DialogMode | null>(null);
  const [text, setText] = useState("");
  const [target, setTarget] = useState<string | undefined>();
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const [originalRequest, setOriginalRequest] = useState<string | null>(null);

  const manage = useMutation(
    trpc.studio.manage.mutationOptions({
      onSuccess: (result) => {
        toast.success(result.message);
        setDialog(null);
        setText("");
        onRefresh();
        void replies.refetch();
      },
      onError: (error) => toast.error(error.message),
    }),
  );

  function openDialog(action: DialogMode, targetToken?: string) {
    setDialog(action);
    setText(
      action === "edit" ? draftText(variant.payload, variant.platform) : "",
    );
    setTarget(targetToken);
    setRequestId(crypto.randomUUID());
    setOriginalRequest(null);
    manage.reset();
  }

  function submitDialog() {
    if (!dialog) return;
    setOriginalRequest(text);
    manage.mutate({
      id: variant.id,
      action: dialog,
      request_id: requestId,
      text: dialog === "delete" ? undefined : text,
      target_token: target,
    });
  }

  const notices = actions.data?.notices ?? [];

  return (
    <section className="mt-6">
      {/* Actions */}
      <div className="my-6 flex flex-wrap justify-center gap-2.5">
        {actions.data?.external_url && (
          <a
            href={actions.data.external_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ExternalLink size={15} />
            View original
          </a>
        )}
        {canReadReplies && (
          <ActionButton
            icon={MessageCircle}
            onClick={() => setShowReplies((v) => !v)}
          >
            {showReplies ? "Hide" : "View"} replies
          </ActionButton>
        )}
        {actions.data?.can_reply && !actions.data.reply_requires_parent && (
          <ActionButton icon={MessageCircle} onClick={() => openDialog("reply")}>
            Reply to this post
          </ActionButton>
        )}
        {actions.data?.can_edit && (
          <ActionButton icon={Pencil} onClick={() => openDialog("edit")}>
            Edit published post
          </ActionButton>
        )}
        {actions.data?.can_delete && (
          <ActionButton icon={Trash2} onClick={() => openDialog("delete")}>
            Delete
          </ActionButton>
        )}
      </div>

      {actions.isPending && <MutedText>Loading available actions…</MutedText>}
      {actions.error && <ErrorText>{actions.error.message}</ErrorText>}
      {notices.map((notice) => (
        <p
          key={notice}
          className="my-2 text-center text-[10px] text-muted-foreground"
        >
          {notice}
        </p>
      ))}

      {/* Conversation */}
      {showReplies && (
        <div className="mt-7 border-t border-border text-xs">
          <header className="flex items-center justify-between py-4 text-xs font-semibold">
            <strong>Conversation</strong>
            <button
              type="button"
              aria-label="Refresh replies"
              className="cursor-pointer text-muted-foreground transition-colors hover:text-foreground"
              onClick={() => void replies.refetch()}
            >
              <RefreshCw
                size={14}
                className={replies.isFetching ? "animate-spin" : ""}
              />
            </button>
          </header>

          {replies.isFetching && <MutedText>Loading replies…</MutedText>}
          {replies.error && <ErrorText>{replies.error.message}</ErrorText>}
          {replies.data?.notice && <MutedText>{replies.data.notice}</MutedText>}

          {replies.data?.items.map((reply) => (
            <article key={reply.id} className="border-b border-border py-3.5">
              <strong>{reply.author}</strong>
              <p className="mt-1.5 whitespace-pre-wrap leading-relaxed">
                {reply.text}
              </p>
              {actions.data?.can_reply && (
                <button
                  type="button"
                  className="mt-2 cursor-pointer text-[11px] text-muted-foreground transition-colors hover:text-foreground"
                  onClick={() => openDialog("reply", reply.target_token)}
                >
                  Reply
                </button>
              )}
            </article>
          ))}

          {replies.data && !replies.data.items.length && (
            <MutedText>No replies available yet.</MutedText>
          )}

          {replies.data?.next_cursor && (
            <button
              type="button"
              className="cursor-pointer py-3 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
              onClick={() => setCursor(replies.data!.next_cursor!)}
            >
              Next replies
            </button>
          )}
        </div>
      )}

      <ManageDialog
        mode={dialog}
        platform={variant.platform}
        text={text}
        onTextChange={setText}
        maxLength={actions.data?.max_reply_length}
        isPending={manage.isPending}
        locked={originalRequest !== null}
        error={manage.error?.message}
        onClose={() => setDialog(null)}
        onSubmit={submitDialog}
      />
    </section>
  );
}