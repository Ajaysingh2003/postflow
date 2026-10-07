"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import PublicationDialog from "./PublicationDialog";
import {
  useEffect,
  useCallback,
  useEffectEvent,
  useRef,
  useState,
  useSyncExternalStore,
  Suspense,
} from "react";
import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import {
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  FilePenLine,
  Loader2,
  Plus,
  Scissors,
  Search,
  X as CloseIcon,
} from "lucide-react";
import { toast } from "sonner";
import { useTRPC } from "@/trpc/client";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PlatformMark } from "./AccountSwitcher";
import FloatingPostActions from "./FloatingPostActions";
import { useComposer } from "@/modules/content/context/ComposerContext";
import type { Account, Payload, Post, Variant } from "@/modules/studio/types";
import {
  canEditDraft,
  draftText,
  fingerprint,
  getOrdinal,
  newDraft,
  profileFor,
  splitPostText,
  threadItems,
  xLength,
  type WritingDraft,
} from "./model";
import XEditor from "./editors/XEditor";
import RedditEditor from "./editors/RedditEditor";
import LinkedInEditor from "../component/editor/ConnectedLinkedInEditor";
import BlueskyEditor from "./editors/BlueskyEditor";
import MastodonEditor from "./editors/MastodonEditor";
import FacebookEditor from "./editors/FacebookEditor";
import InstagramEditor from "./editors/InstagramEditor";
import ThreadsEditor from "./editors/ThreadsEditor";
import TextPostEditor from "./editors/TextPostEditor";
import type { RefineContext } from "./WritingAssistant";
import RefinePopover, { type RefineRequest } from "./RefinePopover";
import {
  applyRefinement,
  refineInstructions,
  refinePreferencesKey,
} from "./refinement";
import {
  assistantDraftSource,
  createSidecarReplacement,
  type SidecarBridge,
} from "./sidecarBridge";
import {
  readWritingSession,
  sessionKey,
  switchWritingAccount,
  type WritingSession,
} from "./writingSession";
import MediaPicker, { MediaPreview } from "./MediaPicker";
import PublishedDetails, { PublishedMetrics } from "./PublishedDetails";
import { cn } from "@/lib/utils";
import { editorMedia } from "../component/editor/socialEditorModel";




import {  FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";

import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const statusLabel: Record<string, string> = {
  failed: "Failed",
  rejected: "Rejected",
  scheduled: "Scheduled",
  published: "Published",
};


const emptySubscribe = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;
const statuses = {
  Drafts: "draft,failed,rejected",
  Queue: "scheduled,publishing",
  Posted: "published",
};
type View = keyof typeof statuses;
const PLATFORM_EDITORS: Record<string, typeof TextPostEditor> = {
  linkedin: LinkedInEditor,
  bluesky: BlueskyEditor,
  mastodon: MastodonEditor,
  facebook: FacebookEditor,
  instagram: InstagramEditor,
  threads: ThreadsEditor,
};

export default function ContentStudio() {
  return (
    <Suspense
      fallback={
        <div role="status" className="p-8 text-sm text-muted-foreground">
          Opening editor…
        </div>
      }
    >
      <ContentStudioWorkspace />
    </Suspense>
  );
}

function ContentStudioWorkspace() {
  const trpc = useTRPC();
  const workspace = useQuery(trpc.workspace.current.queryOptions());
  const accounts = useQuery(trpc.studio.accounts.queryOptions());
  const searchParams = useSearchParams();
  const requestedPost = searchParams.get("post");
  const requestedVariant = searchParams.get("variant");
  const startNew = searchParams.get("new") === "1";
  const linkedPost = useQuery(
    trpc.studio.post.queryOptions(
      {
        id:
          requestedPost && /^[0-9a-f-]{36}$/i.test(requestedPost)
            ? requestedPost
            : "00000000-0000-4000-8000-000000000000",
      },
      { enabled: !!requestedPost && /^[0-9a-f-]{36}$/i.test(requestedPost) },
    ),
  );
  const hydrated = useSyncExternalStore(
    emptySubscribe,
    clientSnapshot,
    serverSnapshot,
  );
  if (
    !hydrated ||
    workspace.isPending ||
    accounts.isPending ||
    (requestedPost && linkedPost.isPending && linkedPost.fetchStatus !== "idle")
  )
    return (
      <div
        className="flex items-center justify-center flex-col gap-4 h-full min-h-[350px] text-center text-muted-foreground p-8 text-xs"
        role="status"
      >
        <Loader2 className="animate-spin" size={20} />
        Opening your writing workspace…
      </div>
    );
  if (workspace.error || accounts.error || linkedPost.error)
    return (
      <div className="flex items-center justify-center flex-col gap-4 h-full min-h-[350px] text-center text-muted-foreground p-8 text-xs [&_h1]:font-serif [&_h1]:text-[30px] [&_h1]:tracking-tight [&_h1]:text-foreground [&_p]:max-w-[350px] [&_p]:leading-relaxed [&>a]:mt-1.5">
        <FilePenLine size={32} />
        <h1>Your workspace could not be loaded</h1>
        <p>
          {workspace.error?.message ??
            accounts.error?.message ??
            linkedPost.error?.message}
        </p>
        <button
          className="inline-flex items-center justify-center gap-1.5 text-xs font-medium rounded-[7px] px-3.5 py-2.25 bg-muted hover:bg-muted/80 text-foreground border border-border cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          onClick={() => {
            void workspace.refetch();
            void accounts.refetch();
            if (requestedPost) void linkedPost.refetch();
          }}
        >
          Try again
        </button>
      </div>
    );
  if (!accounts.data?.length || !workspace.data)
    return (
      <div className="flex items-center justify-center flex-col gap-4 h-full min-h-[350px] text-center text-muted-foreground p-8 text-xs [&_h1]:font-serif [&_h1]:text-[30px] [&_h1]:tracking-tight [&_h1]:text-foreground [&_p]:max-w-[350px] [&_p]:leading-relaxed [&>a]:mt-1.5">
        <FilePenLine size={32} />
        <h1>A place for your next idea</h1>
        <p>
          Connect a social account to open its editor and writing assistant.
        </p>
        <Link
          className="inline-flex items-center justify-center gap-1.5 text-xs font-medium rounded-[7px] px-3.5 py-2.25 bg-[#239a7d] hover:bg-[#198268] text-white cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          href="/dashboard/channels"
        >
          <Plus size={15} />
          Connect an account
        </Link>
      </div>
    );
  const linkedVariant = linkedPost.data?.variants.find(
    (variant) => variant.id === requestedVariant,
  );
  if (
    requestedPost &&
    (!linkedVariant ||
      !accounts.data.some(
        (account) => account.id === linkedVariant.connected_account_id,
      ))
  )
    return (
      <div role="alert" className="p-8 space-y-3 text-sm">
        <p>
          {linkedVariant
            ? "This post belongs to a disconnected account. Reconnect it in Channels to open its editor."
            : "This post version could not be found."}
        </p>
        <Link
          href={
            linkedVariant ? "/dashboard/channels" : "/dashboard/content?new=1"
          }
          className="text-primary underline"
        >
          {linkedVariant ? "Manage accounts" : "Start a new post"}
        </Link>
      </div>
    );
  return (
    <WorkspaceStudio
      key={`${workspace.data.id}:${requestedVariant ?? ""}:${startNew}`}
      workspaceId={workspace.data.id}
      accounts={accounts.data}
      linkedVariant={linkedVariant}
      startNew={startNew}
    />
  );
}

function WorkspaceStudio({
  workspaceId,
  accounts,
  linkedVariant,
  startNew,
}: {
  workspaceId: string;
  accounts: Account[];
  linkedVariant?: Variant;
  startNew: boolean;
}) {
  const [session, setSession] = useState(() => {
    if (
      linkedVariant &&
      accounts.some((item) => item.id === linkedVariant.connected_account_id)
    )
      return {
        activeAccountId: linkedVariant.connected_account_id!,
        drafts: {
          [linkedVariant.connected_account_id!]: newDraft(
            linkedVariant.platform,
            linkedVariant,
          ),
        },
      };
    const stored = readWritingSession(workspaceId, accounts);
    if (!startNew) return stored;
    const account = accounts.find(
      (item) => item.id === stored.activeAccountId,
    )!;
    return {
      activeAccountId: account.id,
      drafts: { [account.id]: newDraft(account.platform) },
    };
  });
  const currentSession = useRef(session);
  const account =
    accounts.find((item) => item.id === session.activeAccountId) ??
    accounts.find((item) => item.status === "active") ??
    accounts[0];
  const commitSession = useCallback(
    (next: WritingSession) => {
      currentSession.current = next;
      setSession(next);
      try {
        localStorage.setItem(sessionKey(workspaceId), JSON.stringify(next));
        localStorage.setItem(
          `postflow:active-writing-account:${workspaceId}`,
          next.activeAccountId,
        );
      } catch {
        toast.error(
          "Local backup is unavailable. Save your draft before leaving.",
        );
      }
    },
    [workspaceId],
  );
  const select = useCallback(
    (id: string) => {
      commitSession(switchWritingAccount(currentSession.current, accounts, id));
    },
    [accounts, commitSession],
  );
  const draftChanged = useCallback(
    (accountId: string, draft: WritingDraft) => {
      const active = currentSession.current;
      const existing = active.drafts[accountId];
      // Opening another post starts another writing session. Saved posts stay in Your posts.
      const drafts =
        existing && existing.localId !== draft.localId ? {} : active.drafts;
      commitSession({
        ...active,
        activeAccountId: accountId,
        drafts: { ...drafts, [accountId]: draft },
      });
    },
    [commitSession],
  );
  return (
    <AccountStudio
      key={account.id}
      account={account}
      accounts={accounts}
      workspaceId={workspaceId}
      onSelect={select}
      initialDraft={session.drafts[account.id] ?? newDraft(account.platform)}
      onDraftChange={draftChanged}
    />
  );
}

const formatWhen = (value: string) =>
  new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

function AccountStudio({
  account,
  accounts,
  workspaceId,
  onSelect,
  initialDraft,
  onDraftChange,
}: {
  account: Account;
  accounts: Account[];
  workspaceId: string;
  onSelect: (id: string) => void;
  initialDraft: WritingDraft;
  onDraftChange: (accountId: string, draft: WritingDraft) => void;
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { setSidecarBridge, setStudioNavigation } = useComposer();
  const storageKey = `postflow:editor:${workspaceId}:${account.id}`;
  const [draft, setDraft] = useState<WritingDraft>(initialDraft);
  const current = useRef(draft);
  const saving = useRef(false);
  const sending = useRef(false);
  const [reconciling, setReconciling] = useState(false);
  const [view, setView] = useState<View>(() =>
    draft.variant?.status === "published"
      ? "Posted"
      : ["scheduled", "publishing"].includes(draft.variant?.status ?? "")
        ? "Queue"
        : "Drafts",
  );
  const [offset, setOffset] = useState(0);
  const [search, setSearch] = useState("");
  const [postsOpen, setPostsOpen] = useState(false);
  const [preview, setPreview] = useState(false);
  const [mediaOpen, setMediaOpen] = useState(false);
  const [mediaTargetIndex, setMediaTargetIndex] = useState<number | null>(null);
  const [publishDialog, setPublishDialog] = useState<
    "schedule" | "publish" | null
  >(null);
  const [refine, setRefine] = useState<RefineContext>({ index: -1 });
  const [refineKey, setRefineKey] = useState(0);
  const [inlineRefine, setInlineRefine] = useState<{
    id: string;
    anchor: HTMLElement | null;
    snapshot: WritingDraft;
    context: RefineContext;
    source: string;
  } | null>(null);
  const [pendingNavigation, setPendingNavigation] = useState<
    (() => void) | null
  >(null);
  const [issues, setIssues] = useState<string[]>([]);
  const [community, setCommunity] = useState(
    String(draft.payload.subreddit ?? ""),
  );
  const posts = useQuery(
    trpc.studio.posts.queryOptions({
      offset,
      status: statuses[view],
      connected_account_id: account.id,
    }),
  );
  const selectedPost = useQuery(
    trpc.studio.post.queryOptions(
      { id: draft.variant?.post_id ?? "00000000-0000-4000-8000-000000000000" },
      {
        enabled: !!draft.variant,
        refetchInterval:
          draft.variant &&
          ["scheduled", "publishing"].includes(draft.variant.status)
            ? 15000
            : false,
      },
    ),
  );
  const serverVariant = selectedPost.data?.variants.find(
    (item) => item.id === draft.variant?.id,
  );
  const latestVariant = serverVariant ?? draft.variant;
  const capabilities = useSuspenseQuery(
    trpc.studio.accountCapabilities.queryOptions({ id: account.id }),
  );
  const targets = useQuery(
    trpc.studio.targets.queryOptions(
      { id: account.id },
      {
        enabled:
          ["reddit", "linkedin", "facebook", "instagram"].includes(
            account.platform,
          ) && account.status === "active",
      },
    ),
  );
  const subreddit = useQuery(
    trpc.studio.subreddit.queryOptions(
      { id: account.id, name: community || "__" },
      {
        enabled:
          account.platform === "reddit" &&
          /^[a-zA-Z0-9_]{2,21}$/.test(community) &&
          community === draft.payload.subreddit &&
          account.status === "active",
        retry: false,
      },
    ),
  );
  const mediaQuery = useQuery(
    trpc.studio.resource.queryOptions({ kind: "media" }),
  );
  const assets = Array.isArray(mediaQuery.data) ? mediaQuery.data : [];
  const create = useMutation(trpc.studio.create.mutationOptions());
  const edit = useMutation(trpc.studio.editDraft.mutationOptions());
  const { mutateAsync: runAssistant } = useMutation(
    trpc.studio.runFeature.mutationOptions(),
  );
  const cancel = useMutation(
    trpc.studio.cancel.mutationOptions({
      onError: (error) => toast.error(error.message),
    }),
  );
  const busy =
    create.isPending || edit.isPending || cancel.isPending || reconciling;
  const editable =
    canEditDraft(latestVariant) &&
    !selectedPost.error &&
    (!draft.variant || !!selectedPost.data);
  const published = latestVariant?.status === "published";
  const publishedActions = useQuery(
    trpc.studio.actions.queryOptions(
      { id: latestVariant?.id ?? "00000000-0000-4000-8000-000000000000" },
      { enabled: published },
    ),
  );
  const dirty = fingerprint(draft.payload, draft.mediaIds) !== draft.saved;
  const writingPayload =
    !dirty && latestVariant ? latestVariant.payload : draft.payload;
  const writingMediaIds =
    !dirty && latestVariant ? latestVariant.media_asset_ids : draft.mediaIds;
  const displayPayload = editable
    ? writingPayload
    : (latestVariant?.payload ?? writingPayload);

  const threadList = threadItems(writingPayload);
  const xLimit = Number(capabilities.data?.max_text_length ?? 280);
  const overflowXIndex =
    account.platform === "x"
      ? threadList.findIndex(
          (item) => xLength(String(item.text ?? "")) > xLimit,
        )
      : -1;
  const [dismissedLimitBanner, setDismissedLimitBanner] = useState(false);

  function autoSplitXPost(index: number) {
    const currentItem = threadList[index];
    const text = String(currentItem?.text ?? "");
    if (!text || xLength(text) <= xLimit) return;

    const chunks = splitPostText(text, xLimit);
    if (chunks.length <= 1) return;

    const newItems = [...threadList];
    const firstItem = { ...currentItem, text: chunks[0] };
    const subsequentItems = chunks.slice(1).map((chunk) => ({ text: chunk }));

    newItems.splice(index, 1, firstItem, ...subsequentItems);
    change(newItems.length === 1 ? newItems[0] : { thread: newItems });
    setDismissedLimitBanner(false);
    toast.success(`Split post into ${chunks.length} posts`);
  }

  const update = useCallback(
    (next: WritingDraft, syncVariant = false) => {
      if (syncVariant && next.variant) {
        const variant = next.variant;
        queryClient.setQueryData<Post>(
          trpc.studio.post.queryKey({ id: variant.post_id }),
          (post) =>
            post
              ? {
                  ...post,
                  variants: post.variants.map((item) =>
                    item.id === variant.id ? variant : item,
                  ),
                }
              : post,
        );
      }
      current.current = next;
      setDraft(next);
      onDraftChange(account.id, next);
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        toast.error(
          "Local backup is unavailable. Save your draft before leaving.",
        );
      }
    },
    [queryClient, trpc, storageKey, account.id, onDraftChange],
  );

  useEffect(() => {
    const source = assistantDraftSource(
      writingPayload,
      account.platform,
      refine,
    ).text;
    const bridge: SidecarBridge = {
      scope: `${workspaceId}:${account.id}:${draft.localId}:${refineKey}`,
      content: source,
      styleOwner: account.display_name.replace(/\s*\(@.*\)$/, ""),
      ready: editable && !busy && account.status === "active",
      async send(prompt, attachments, signal) {
        if (attachments.length) {
          throw new Error(
            "Reference-file drafting is unavailable for this account. Remove the files and retry with pasted text.",
          );
        }
        const active = current.current;
        const locallyEdited =
          fingerprint(active.payload, active.mediaIds) !== active.saved;
        const snapshot = structuredClone(
          locallyEdited
            ? active
            : {
                ...active,
                variant: latestVariant ?? null,
                payload: writingPayload,
                mediaIds: writingMediaIds,
              },
        );
        if (
          !locallyEdited &&
          fingerprint(snapshot.payload, snapshot.mediaIds) !==
            fingerprint(active.payload, active.mediaIds)
        )
          update(snapshot);
        const context = assistantDraftSource(
          snapshot.payload,
          account.platform,
          refine,
        );
        const source = context.text;
        const wholeThread =
          account.platform === "x" &&
          Array.isArray(snapshot.payload.thread) &&
          context.selection.index < 0;
        const instructions = prompt.replaceAll(
          "LinkedIn",
          profileFor(account.platform).name,
        );
        const validationPayload = Array.isArray(snapshot.payload.thread)
          ? threadItems(snapshot.payload)[Math.max(0, context.selection.index)]
          : snapshot.payload;
        const result = await runAssistant({
          feature: wholeThread ? "x_thread_writer" : "rewrite_with_tone",
          platform: account.platform,
          input_data: {
            text: source.trim() ? source : prompt,
            ...(wholeThread
              ? {
                  max_tweets: Math.min(
                    20,
                    Math.max(2, threadItems(snapshot.payload).length),
                  ),
                  include_numbering: false,
                }
              : { tone: instructions }),
          },
          connected_account_id: account.id,
          validation_context: validationPayload,
          writing_instructions: [
            wholeThread
              ? `Apply this edit to the whole thread: ${instructions}. Preserve the order and number of posts unless the edit asks otherwise.`
              : "",
            subreddit.data
              ? `Respect this community's rules: ${JSON.stringify(subreddit.data.rules)}`
              : "",
          ]
            .filter(Boolean)
            .join("\n")
            .slice(0, 2000),
        });
        if (signal.aborted) throw new DOMException("Cancelled", "AbortError");
        const errors =
          result.validation_issues?.filter(
            (issue) => issue.severity === "error",
          ) ?? [];
        if (errors.length)
          throw new Error(errors.map((issue) => issue.message).join("\n"));
        const tweets =
          wholeThread &&
          Array.isArray(result.output.tweets) &&
          result.output.tweets.every(
            (item) => typeof item === "string" && item.trim(),
          )
            ? (result.output.tweets as string[])
            : undefined;
        const text = wholeThread
          ? tweets?.join("\n\n")
          : result.output.rewritten_text;
        if (typeof text !== "string" || !text.trim())
          throw new Error(
            "The assistant did not return a draft. Please retry.",
          );
        const appliedSelection: RefineContext = { ...context.selection };
        return {
          text:
            typeof result.output.notes === "string" ? result.output.notes : "",
          artifact: {
            id: crypto.randomUUID(),
            original: source,
            content: text,
            title: "Suggested draft",
            summary: "",
          },
          replace: createSidecarReplacement(
            snapshot,
            account.platform,
            context.selection,
            () => current.current,
            (next) => {
              if (
                appliedSelection.start != null &&
                appliedSelection.end != null
              ) {
                const before = assistantDraftSource(
                  current.current.payload,
                  account.platform,
                  { index: appliedSelection.index },
                ).text;
                const after = assistantDraftSource(
                  next.payload,
                  account.platform,
                  { index: appliedSelection.index },
                ).text;
                appliedSelection.end += after.length - before.length;
                appliedSelection.text = after.slice(
                  appliedSelection.start,
                  appliedSelection.end,
                );
                setRefine({ ...appliedSelection });
              }
              update(next);
            },
            () => saving.current || sending.current,
            () =>
              toast.message(
                "Your draft changed. Generate again to use this suggestion.",
              ),
            tweets,
          ),
        };
      },
    };
    setSidecarBridge(bridge);
  }, [
    account,
    workspaceId,
    draft.localId,
    refine,
    refineKey,
    writingPayload,
    writingMediaIds,
    latestVariant,
    editable,
    busy,
    subreddit.data,
    runAssistant,
    update,
    setSidecarBridge,
  ]);

  useEffect(() => {
    setStudioNavigation({
      account,
      accounts,
      onSelect: (id) => {
        if (busy || saving.current || sending.current) {
          toast.message(
            "Wait for the current action to finish before switching accounts.",
          );
          return;
        }
        update({
          ...current.current,
          variant: latestVariant ?? null,
          payload: displayPayload,
          mediaIds: writingMediaIds,
        });
        onSelect(id);
      },
      onPosts: () => setPostsOpen(true),
    });
    return () => setStudioNavigation(null);
  }, [
    account,
    accounts,
    onSelect,
    setStudioNavigation,
    busy,
    latestVariant,
    displayPayload,
    writingMediaIds,
    update,
  ]);

  useEffect(() => () => setSidecarBridge(null), [setSidecarBridge]);

  function change(payload: Payload) {
    if (editable && !busy) {
      let nextMediaIds = writingMediaIds;
      if (Array.isArray(payload.thread)) {
        const threadMediaIds = Array.from(
          new Set(
            payload.thread.flatMap((it) =>
              it && typeof it === "object" && Array.isArray((it as any).media_ids)
                ? ((it as any).media_ids as string[])
                : [],
            ),
          ),
        );
        if (
          threadMediaIds.length > 0 ||
          payload.thread.some(
            (it) => it && typeof it === "object" && "media_ids" in (it as any),
          )
        ) {
          nextMediaIds = threadMediaIds;
        }
      }
      update({ ...current.current, payload, mediaIds: nextMediaIds });
      setIssues([]);
      setDismissedLimitBanner(false);
    }
  }
  async function refresh() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: trpc.studio.posts.queryKey() }),
      queryClient.invalidateQueries({ queryKey: trpc.studio.post.queryKey() }),
    ]);
  }
  async function save(): Promise<Variant | null> {
    if (saving.current || !editable) return null;
    saving.current = true;
    const snapshot = structuredClone({
      ...current.current,
      payload: writingPayload,
      mediaIds: writingMediaIds,
    });
    try {
      let variant: Variant;
      if (snapshot.variant)
        variant = await edit.mutateAsync({
          id: snapshot.variant.id,
          payload: snapshot.payload,
          media_asset_ids: snapshot.mediaIds,
        });
      else {
        const text = draftText(snapshot.payload, account.platform);
        const post = await create.mutateAsync({
          title: String(
            snapshot.payload.title || text.split("\n")[0] || "Untitled draft",
          ).slice(0, 240),
          base_text: text,
          variants: [
            {
              platform: account.platform,
              connected_account_id: account.id,
              payload: snapshot.payload,
              media_asset_ids: snapshot.mediaIds,
            },
          ],
        });
        variant = post.variants[0];
      }
      if (current.current.localId === snapshot.localId)
        update(
          {
            ...snapshot,
            variant,
            saved: fingerprint(snapshot.payload, snapshot.mediaIds),
          },
          true,
        );
      void refresh();
      return variant;
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Your draft could not be saved",
      );
      return null;
    } finally {
      saving.current = false;
    }
  }
  function navigate(action: () => void) {
    if (busy) return;
    if (dirty) setPendingNavigation(() => action);
    else action();
  }
  function load(variant: Variant) {
    navigate(() => {
      update(newDraft(account.platform, variant));
      setCommunity(String(variant.payload.subreddit ?? ""));
      setPreview(false);
      setIssues([]);
      setRefine({ index: -1 });
      setRefineKey((key) => key + 1);
      setPostsOpen(false);
    });
  }
  function fresh() {
    navigate(() => {
      setPostsOpen(false);
      update(newDraft(account.platform));
      setView("Drafts");
      setOffset(0);
      setPreview(false);
      setIssues([]);
      setCommunity("");
      setRefine({ index: -1 });
      setRefineKey((key) => key + 1);
    });
  }
  const requestFresh = useEffectEvent(fresh);
  useEffect(() => {
    const listener = () => requestFresh();
    window.addEventListener("postflow:new-draft", listener);
    return () => window.removeEventListener("postflow:new-draft", listener);
  }, []);
  function duplicate() {
    const next = newDraft(account.platform);
    next.payload = structuredClone(displayPayload);
    next.mediaIds = [...writingMediaIds];
    update(next);
    setView("Drafts");
    setOffset(0);
    setPreview(false);
    toast.success("Copied to a new draft");
  }
  async function copyText() {
    try {
      await navigator.clipboard.writeText(
        draftText(displayPayload, account.platform),
      );
      toast.success("Post text copied");
    } catch {
      toast.error("Could not copy your post. Check clipboard permissions.");
    }
  }
  function startRefine(
    text?: string,
    index = 0,
    start?: number,
    end?: number,
    anchor?: HTMLElement,
  ) {
    if (!editable || busy) return;
    const context = {
      text,
      index,
      ...(start != null && end != null && end > start ? { start, end } : {}),
    };
    const snapshot = structuredClone({
      ...current.current,
      payload: writingPayload,
      mediaIds: writingMediaIds,
      variant: latestVariant ?? current.current.variant,
    });
    const source = assistantDraftSource(
      snapshot.payload,
      account.platform,
      context,
    );
    if (source.selection.index < 0) {
      toast.message("Select the passage again to refine it.");
      return;
    }
    setInlineRefine({
      id: crypto.randomUUID(),
      anchor:
        anchor ??
        (document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null),
      snapshot,
      context: source.selection,
      source: source.text,
    });
  }
  async function generateRefinement(
    request: RefineRequest,
    signal: AbortSignal,
  ) {
    if (!inlineRefine) throw new Error("Open Refine from the current post.");
    const { snapshot, context, source } = inlineRefine;
    const unchanged = () =>
      current.current.localId === snapshot.localId &&
      fingerprint(current.current.payload, current.current.mediaIds) ===
        fingerprint(snapshot.payload, snapshot.mediaIds) &&
      canEditDraft(current.current.variant) &&
      !saving.current &&
      !sending.current;
    if (!unchanged())
      throw new Error(
        "Your draft changed. Close Refine and open it again to use the latest text.",
      );
    const validationPayload = Array.isArray(snapshot.payload.thread)
      ? threadItems(snapshot.payload)[context.index]
      : snapshot.payload;
    const result = await runAssistant({
      feature: "rewrite_with_tone",
      platform: account.platform,
      input_data: {
        text: request.previous ?? source,
        tone: refineInstructions(
          request.command,
          request.custom,
          request.preferences,
          request.followup,
        ),
      },
      connected_account_id: account.id,
      validation_context:
        account.platform === "instagram" && snapshot.mediaIds.length
          ? {
              ...validationPayload,
              // These are real attachment references for text validation. Publishing
              // resolves provider-accessible media URLs separately.
              media_urls: snapshot.mediaIds.map(
                (id) => `/api/media/${encodeURIComponent(id)}/content`,
              ),
              media_types: editorMedia(
                snapshot.payload,
                snapshot.mediaIds,
                assets,
              ).types,
            }
          : validationPayload,
      output_language: request.preferences.language,
      writing_instructions: subreddit.data
        ? `Respect this community's rules: ${JSON.stringify(subreddit.data.rules)}`.slice(
            0,
            2000,
          )
        : undefined,
    });
    if (signal.aborted) throw new DOMException("Cancelled", "AbortError");
    const errors =
      result.validation_issues?.filter((issue) => issue.severity === "error") ??
      [];
    if (errors.length)
      throw new Error(errors.map((issue) => issue.message).join("\n"));
    const output = result.output.rewritten_text;
    if (typeof output !== "string" || !output.trim())
      throw new Error("The assistant returned no revised text. Please retry.");
    return {
      text: output,
      apply(mode: "replace" | "insert") {
        if (!unchanged()) {
          toast.message(
            "Your draft changed. Open Refine again before applying this response.",
          );
          return false;
        }
        const payload = applyRefinement(
          snapshot.payload,
          account.platform,
          context,
          source,
          output,
          mode,
        );
        if (!payload) {
          toast.error("The selected passage changed. Open Refine again.");
          return false;
        }
        update({ ...current.current, payload });
        return true;
      },
    };
  }
  async function preflight(mode: "schedule" | "publish") {
    if (account.status !== "active" || !editable || busy) return;
    setIssues([]);
    const savedVariant = await save();
    if (!savedVariant) return;
    // Destination validation happens after account selection and review.
    setPublishDialog(mode);
  }
  const postVariants = (posts.data ?? [])
    .flatMap((post: Post) =>
      post.variants
        .filter(
          (v) =>
            v.connected_account_id === account.id &&
            statuses[view].split(",").includes(v.status),
        )
        .map((variant) => ({ post, variant })),
    )
    .filter(({ post, variant }) =>
      `${post.title} ${draftText(variant.payload, account.platform)} ${variant.payload.title ?? ""}`
        .toLowerCase()
        .includes(search.toLowerCase()),
    );
  const targetField =
    account.platform === "linkedin"
      ? "target_urn"
      : account.platform === "facebook"
        ? "page_id"
        : account.platform === "instagram"
          ? "target_id"
          : "target";
  return (
    <div className="@container flex h-full min-h-0 min-w-0 bg-background text-[13px] text-foreground relative">
      <Dialog open={postsOpen} onOpenChange={setPostsOpen}>
        <DialogContent className="flex max-h-[85svh] flex-col gap-0 overflow-hidden p-0 sm:max-w-[520px]">
          <DialogHeader className="space-y-1 px-6 pb-4 pt-6 text-left">
            <DialogTitle className="text-xl tracking-tight">
              Your posts
            </DialogTitle>
            <DialogDescription>
              Drafts, scheduled posts and published content for{" "}
              <span className="font-medium text-foreground">
                {account.display_name}
              </span>
              .
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 border-b border-border px-6 pb-4">
            <Tabs
              value={view}
              onValueChange={(value) => {
                setView(value as View);
                setOffset(0);
              }}
            >
              <TabsList className="w-full" aria-label="Post status">
                {(Object.keys(statuses) as View[]).map((tab) => (
                  <TabsTrigger key={tab} value={tab} className="flex-1">
                    {tab}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>

            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search
                  aria-hidden
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  aria-label="Search account posts on this page"
                  placeholder="Search posts"
                  className="pl-9"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <Button
                className="primary-btn shrink-0"
                disabled={busy}
                onClick={fresh}
              >
                <Plus className="size-4" />
                New draft
              </Button>
            </div>
          </div>

          <div className="min-h-[220px] flex-1 overflow-y-auto">
            <ul className="divide-y divide-border">
              {!draft.variant && view === "Drafts" && (
                <li>
                  <button
                    className="relative flex w-full items-start gap-3 bg-muted/40 px-6 py-4 text-left transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none"
                    onClick={() => setPostsOpen(false)}
                  >
                    <span className="absolute inset-y-0 left-0 w-0.5 bg-[#369c85]" />
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-background">
                      <PlatformMark platform={account.platform} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>In progress</span>
                        <Badge
                          variant="secondary"
                          className="h-5 px-1.5 text-[10px]"
                        >
                          Local backup
                        </Badge>
                      </span>
                      <span className="mt-1 line-clamp-2 block text-sm leading-snug">
                        {draftText(draft.payload, account.platform) ||
                          "Empty draft"}
                      </span>
                    </span>
                  </button>
                </li>
              )}

              {posts.isPending &&
                [0, 1, 2].map((i) => (
                  <li key={i} className="flex items-start gap-3 px-6 py-4">
                    <div className="size-9 shrink-0 animate-pulse rounded-lg bg-muted" />
                    <div className="flex-1 space-y-2 pt-1">
                      <div className="h-2.5 w-24 animate-pulse rounded bg-muted" />
                      <div className="h-3 w-4/5 animate-pulse rounded bg-muted" />
                    </div>
                  </li>
                ))}

              {postVariants.map(({ variant }) => {
                const active = draft.variant?.id === variant.id;
                const problem = ["failed", "rejected"].includes(variant.status);
                return (
                  <li key={variant.id}>
                    <button
                      className={cn(
                        "relative flex w-full items-start gap-3 px-6 py-4 text-left transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
                        active && "bg-muted/40",
                      )}
                      onClick={() => load(variant)}
                      disabled={busy}
                      aria-current={active || undefined}
                    >
                      {active && (
                        <span className="absolute inset-y-0 left-0 w-0.5 bg-[#369c85]" />
                      )}
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-background">
                        <PlatformMark platform={variant.platform} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2 text-xs text-muted-foreground">
                          <time>
                            {formatWhen(
                              variant.scheduled_time ?? variant.updated_at,
                            )}
                          </time>
                          {statusLabel[variant.status] && (
                            <Badge
                              variant={problem ? "destructive" : "secondary"}
                              className="h-5 px-1.5 text-[10px]"
                            >
                              {statusLabel[variant.status]}
                            </Badge>
                          )}
                        </span>
                        <span className="mt-1 line-clamp-2 block text-sm leading-snug">
                          {String(
                            variant.payload.title ||
                              draftText(variant.payload, account.platform) ||
                              "Empty draft",
                          )}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>

            {posts.error && (
              <p
                role="alert"
                className="whitespace-pre-wrap px-6 py-4 text-xs text-destructive"
              >
                {posts.error.message}
              </p>
            )}

            {posts.data && !postVariants.length && (
              <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
                <span className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  <FileText className="size-4" />
                </span>
                <p className="max-w-[260px] text-sm text-muted-foreground">
                  {view === "Posted"
                    ? "Posts you publish here will appear with their performance."
                    : view === "Queue"
                      ? "Your next scheduled posts will appear here."
                      : "A fresh page for your next idea."}
                </p>
              </div>
            )}
          </div>

          <footer className="flex items-center justify-between gap-3 border-t border-border px-6 py-3 text-xs text-muted-foreground">
            <span className="truncate">
              {profileFor(account.platform).name} · {view.toLowerCase()}
            </span>
            <div className="flex items-center gap-2">
              <span className="tabular-nums">
                Page {Math.floor(offset / 100) + 1}
              </span>
              <Button
                variant="outline"
                size="icon"
                className="size-8"
                aria-label="Previous posts page"
                disabled={!offset}
                onClick={() => setOffset(Math.max(0, offset - 100))}
              >
                <ChevronLeft className="size-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="size-8"
                aria-label="Next posts page"
                disabled={(posts.data?.length ?? 0) < 100}
                onClick={() => setOffset(offset + 100)}
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </footer>
        </DialogContent>
      </Dialog>
      <section
        className="relative flex min-w-0 min-h-0 flex-1 flex-col"
        aria-label={`${profileFor(account.platform).name} editor`}
      >
        <div className="flex-1 min-h-0 overflow-y-auto p-6 sm:p-10 md:p-15 pb-32">
          <div className="max-w-[620px] mx-auto">
            {account.status !== "active" && (
              <div className="flex flex-col gap-1.75 bg-[#d7a958]/10 border border-[#d7a958]/20 rounded-lg p-3 sm:p-4 text-[11px] leading-relaxed text-[#a18250] mb-8 [&>a]:flex [&>a]:items-center [&>a]:gap-1 [&>a]:text-foreground [&>a]:font-medium [&>a]:w-max">
                <span>
                  This account needs reconnecting before you publish. You can
                  keep writing.
                </span>
                <Link href="/dashboard/channels">
                  Manage connection
                  <ChevronRight size={14} />
                </Link>
              </div>
            )}
            {selectedPost.error && (
              <p className="text-[11px] leading-relaxed text-destructive py-2 whitespace-pre-wrap">
                {selectedPost.error.message}
              </p>
            )}
            {capabilities.error && (
              <p className="text-[11px] leading-relaxed text-destructive py-2 whitespace-pre-wrap">
                Publishing options could not load: {capabilities.error.message}
              </p>
            )}
            {published && latestVariant && (
              <PublishedMetrics
                key={`metrics:${latestVariant.id}`}
                variant={latestVariant}
              />
            )}
            {latestVariant?.last_error && (
              <p className="text-[11px] leading-relaxed text-destructive py-2 whitespace-pre-wrap">
                {latestVariant.last_error}
              </p>
            )}
            {latestVariant?.publish_state?.outcome_unknown === true && (
              <p className="text-[11px] leading-relaxed text-destructive py-2 whitespace-pre-wrap">
                The platform’s response was uncertain. Check the original post
                before retrying. This draft is locked to prevent duplicate
                posts.
              </p>
            )}
            {latestVariant?.status === "scheduled" && (
              <div className="flex items-center gap-3 p-4 bg-muted rounded-lg mb-7 text-[11px]">
                <CalendarClock size={18} />
                <div>
                  <strong>
                    Scheduled for{" "}
                    {new Date(latestVariant.scheduled_time!).toLocaleString()}
                  </strong>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Cancel the schedule to make changes.
                  </p>
                </div>
                <button
                  className="ml-auto underline text-[10px] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  disabled={busy}
                  onClick={async () => {
                    try {
                      await cancel.mutateAsync({ id: latestVariant.id });
                      update(
                        {
                          ...current.current,
                          variant: {
                            ...latestVariant,
                            status: "draft",
                            scheduled_time: null,
                            updated_at: new Date().toISOString(),
                          },
                        },
                        true,
                      );
                      await refresh();
                    } catch {
                      /* The mutation reports the error without leaving the editor. */
                    }
                  }}
                >
                  Move to drafts
                </button>
              </div>
            )}
            {latestVariant?.status === "publishing" && (
              <p className="text-[11px] text-muted-foreground leading-relaxed mt-5">
                Publishing is in progress. This post will update automatically.
              </p>
            )}
            {["linkedin", "facebook", "instagram"].includes(
              account.platform,
            ) ? (
              <div className="mb-5 flex flex-wrap items-center gap-3">
                <Label
                  className="text-xs text-muted-foreground"
                  htmlFor={`publish-target-${account.id}`}
                >
                  Publish as
                </Label>
                <Select
                  items={[
                    ...(account.platform === "linkedin"
                      ? [{ value: "", label: account.display_name }]
                      : []),
                    ...(targets.data?.targets ?? []).map((target) => ({
                      value: target.id,
                      label: target.name,
                    })),
                  ]}
                  value={String(
                    writingPayload[targetField] ||
                      (account.platform === "instagram"
                        ? writingPayload.ig_user_id
                        : account.platform === "facebook"
                          ? writingPayload.target_id
                          : null) ||
                      writingPayload.target ||
                      "",
                  )}
                  disabled={
                    !editable ||
                    busy ||
                    preview ||
                    targets.isPending ||
                    account.status !== "active" ||
                    (account.platform !== "linkedin" &&
                      !targets.data?.targets.length)
                  }
                  onValueChange={(value) =>
                    change({ ...writingPayload, [targetField]: value || null })
                  }
                >
                  <SelectTrigger
                    id={`publish-target-${account.id}`}
                    aria-label="Publishing account"
                    className="max-w-full min-w-[180px] text-xs"
                  >
                    <SelectValue
                      placeholder={
                        account.status !== "active"
                          ? "Reconnect to choose an account"
                          : targets.isPending
                            ? "Loading accounts…"
                            : account.platform === "facebook"
                              ? "Choose a Page"
                              : "Choose an account"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {account.platform === "linkedin" && (
                      <SelectItem value="">{account.display_name}</SelectItem>
                    )}
                    {(targets.data?.targets ?? []).map((target) => (
                      <SelectItem key={target.id} value={target.id}>
                        {target.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {targets.error && (
                  <p role="alert" className="text-xs text-destructive">
                    Could not load publishing accounts. {targets.error.message}
                  </p>
                )}
                {!targets.isPending &&
                  !targets.error &&
                  !targets.data?.targets.length &&
                  account.platform !== "linkedin" &&
                  account.status === "active" && (
                    <p className="text-xs text-muted-foreground">
                      No publishing accounts found.{" "}
                      <Link href="/dashboard/channels" className="underline">
                        Manage connection
                      </Link>
                    </p>
                  )}
              </div>
            ) : null}
            {account.platform === "reddit" && (
              <datalist id="studio-subreddits">
                {targets.data?.targets.map((target) => (
                  <option
                    value={target.name.replace(/^r\//, "")}
                    key={target.id}
                  />
                ))}
              </datalist>
            )}
            {(() => {
              const props = {
                account,
                status: latestVariant?.status ?? "draft",
                payload: displayPayload,
                onChange: change,
                capabilities: capabilities.data ?? {},
                readOnly: !editable || busy,
                preview,
                onRefine: startRefine,
                onMedia: (index?: number) => {
                  setMediaTargetIndex(index ?? 0);
                  setMediaOpen(true);
                },
                media: (
                  <MediaPreview
                    assets={assets}
                    ids={writingMediaIds}
                    readOnly={!editable || preview || busy}
                    onRemove={(id) =>
                      update({
                        ...current.current,
                        payload: writingPayload,
                        mediaIds: writingMediaIds.filter((v) => v !== id),
                      })
                    }
                  />
                ),
                mediaIds: writingMediaIds,
                mediaAssets: assets,
                onMediaOrderChange: (mediaIds: string[]) =>
                  update({
                    ...current.current,
                    payload: writingPayload,
                    mediaIds,
                  }),
              };
              const PlatformEditor =
                PLATFORM_EDITORS[account.platform] ?? TextPostEditor;
              return account.platform === "x" ? (
                <XEditor {...props} />
              ) : account.platform === "reddit" ? (
                <RedditEditor
                  {...props}
                  profile={
                    community === draft.payload.subreddit
                      ? subreddit.data
                      : undefined
                  }
                  loadingProfile={subreddit.isFetching}
                  profileError={
                    community === draft.payload.subreddit
                      ? subreddit.error?.message
                      : undefined
                  }
                  onCommunity={setCommunity}
                />
              ) : (
                <PlatformEditor {...props} />
              );
            })()}
            {/* {editable &&
              accounts.filter((item) => item.status === "active").length >
                1 && (
                <div className="mx-auto mt-5 flex max-w-[600px] items-center justify-between gap-3 rounded-xl border border-border bg-muted/20 px-4 py-3">
                  <div>
                    <p className="text-xs font-medium">
                      Share to more accounts
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      Keep this idea, adjust each version.
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={
                      busy ||
                      !draftText(writingPayload, account.platform).trim()
                    }
                    onClick={() => void preflight("publish")}
                  >
                    Choose accounts
                  </Button>
                </div>
              )} */}
            {issues.length > 0 && (
              <div
                className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-[11px] leading-relaxed mt-6 [&_strong]:block [&_strong]:mb-1.75"
                role="alert"
              >
                <strong>Check before publishing</strong>
                {issues.map((issue, i) => (
                  <p key={i}>{issue}</p>
                ))}
              </div>
            )}
            {published && latestVariant && (
              <PublishedDetails
                key={`details:${latestVariant.id}`}
                variant={latestVariant}
                onRefresh={() => void refresh()}
              />
            )}
            {!published && (
              <p className="text-[11px] leading-relaxed text-center text-muted-foreground opacity-65 mt-14">
                {preview
                  ? "Preview · your content, as it will read on the platform"
                  : account.platform === "x"
                    ? "One idea or a whole thread. Make it yours."
                    : profileFor(account.platform).help}
              </p>
            )}
          </div>
        </div>
        {inlineRefine && (
          <RefinePopover
            key={inlineRefine.id}
            anchor={inlineRefine.anchor}
            source={inlineRefine.source}
            platform={account.platform}
            accountName={account.display_name}
            preferencesKey={refinePreferencesKey(workspaceId, account.id)}
            onClose={() => setInlineRefine(null)}
            onGenerate={generateRefinement}
          />
        )}
        {/* Floating X Premium & Auto-split banner */}
        {!preview &&
          editable &&
          account.platform === "x" &&
          overflowXIndex !== -1 &&
          !dismissedLimitBanner && (
            <div className="absolute bottom-20 left-1/2 z-30 flex -translate-x-1/2 items-center gap-3 whitespace-nowrap rounded-full border border-zinc-700/60 bg-zinc-900/95 px-4 py-2 text-xs font-medium text-white shadow-2xl backdrop-blur-md dark:bg-zinc-800/95 max-w-[calc(100%-2rem)]">
  <span className="truncate text-zinc-200">
    {getOrdinal(overflowXIndex + 1)} post is too long, you can increase the limit by upgrading to X Premium
  </span>

  <div className="flex shrink-0 items-center gap-1.5">
    <a
      href="https://x.com/i/premium_sign_up"
      target="_blank"
      rel="noopener noreferrer"
      className="rounded-md border border-zinc-700/50 bg-zinc-800 px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-zinc-700"
    >
      View
    </a>
    <button
      type="button"
      onClick={() => autoSplitXPost(overflowXIndex)}
      className="flex cursor-pointer items-center gap-1.5 rounded-md border border-zinc-700/50 bg-zinc-800 px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-zinc-700"
    >
      <Scissors className="size-3.5" />
      <span>Auto-split</span>
    </button>
  </div>

  <button
    type="button"
    onClick={() => setDismissedLimitBanner(true)}
    className="shrink-0 cursor-pointer rounded-full p-1 text-zinc-400 transition-colors hover:bg-zinc-700/60 hover:text-white"
    aria-label="Dismiss banner"
  >
    <CloseIcon className="size-3.5" />
  </button>
</div>
          )}
        <FloatingPostActions
          busy={busy}
          saving={create.isPending || edit.isPending}
          saved={!!draft.variant && !dirty}
          editable={editable}
          preview={preview}
          hasPost={
            !!draftText(writingPayload, account.platform).trim() ||
            writingMediaIds.length > 0
          }
          canPublish={account.status === "active" && !!capabilities.data}
          status={latestVariant?.status}
          externalUrl={publishedActions.data?.external_url}
          onSave={() =>
            void save().then((v) => v && toast.success("Draft saved"))
          }
          onPreview={() => setPreview(!preview)}
          onSchedule={() => void preflight("schedule")}
          onPublish={() => void preflight("publish")}
          onCopy={() => void copyText()}
          onDrafts={() => {
            setView("Drafts");
            setOffset(0);
            setPostsOpen(true);
          }}
          onNew={fresh}
          onDuplicate={duplicate}
        />
      </section>
      <MediaPicker
        open={mediaOpen && editable && !busy}
        onClose={() => {
          setMediaOpen(false);
          setMediaTargetIndex(null);
        }}
        assets={assets}
        ids={
          mediaTargetIndex !== null &&
          writingPayload.thread &&
          Array.isArray(writingPayload.thread)
            ? (((writingPayload.thread[mediaTargetIndex] as any)?.media_ids ??
                (mediaTargetIndex === 0 &&
                !writingPayload.thread.some(
                  (it: any, i: number) => i > 0 && it?.media_ids?.length,
                )
                  ? writingMediaIds
                  : [])) as string[])
            : writingMediaIds
        }
        capabilities={capabilities.data ?? {}}
        platform={account.platform}
        onChange={(chosenMediaIds) => {
          const currentPayload = writingPayload;
          if (
            currentPayload.thread &&
            Array.isArray(currentPayload.thread) &&
            mediaTargetIndex !== null
          ) {
            const items = [...currentPayload.thread];
            const targetIdx = mediaTargetIndex ?? 0;
            const currentItem =
              typeof items[targetIdx] === "string"
                ? { text: items[targetIdx] }
                : { ...(items[targetIdx] as any) };
            items[targetIdx] = { ...currentItem, media_ids: chosenMediaIds };

            const allMediaIds = Array.from(
              new Set(
                items.flatMap((it) =>
                  typeof it === "object" && Array.isArray((it as any).media_ids)
                    ? (it as any).media_ids
                    : [],
                ),
              ),
            );
            update({
              ...current.current,
              payload: { ...currentPayload, thread: items },
              mediaIds: allMediaIds.length ? allMediaIds : chosenMediaIds,
            });
          } else {
            update({
              ...current.current,
              payload: writingPayload,
              mediaIds: chosenMediaIds,
            });
          }
        }}
        onRefresh={() => void mediaQuery.refetch()}
      />
      {publishDialog && draft.variant && (
        <PublicationDialog
          key={draft.variant.id}
          source={draft.variant}
          sourceAccount={account}
          accounts={accounts}
          assets={assets}
          mode={publishDialog}
          onBusy={(busy) => {
            sending.current = busy;
            setReconciling(busy);
          }}
          onClose={() => setPublishDialog(null)}
          onVariant={(variant) => {
            update(newDraft(account.platform, variant), true);
            setView(
              variant.status === "published"
                ? "Posted"
                : ["scheduled", "publishing"].includes(variant.status)
                  ? "Queue"
                  : "Drafts",
            );
            setOffset(0);
            void refresh();
          }}
        />
      )}
      <Dialog
        open={pendingNavigation !== null}
        onOpenChange={(open) => !open && !busy && setPendingNavigation(null)}
      >
        <DialogContent className="sm:max-w-md p-6">
          <DialogHeader>
            <DialogTitle>Save your changes?</DialogTitle>
            <DialogDescription>
              Your current draft has changes. Save them before opening another
              post.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 mt-4">
            <button
              className="inline-flex items-center justify-center gap-1.5 text-xs font-medium    secondary-btn rounded-md"
              disabled={busy}
              onClick={() => {
                pendingNavigation?.();
                setPendingNavigation(null);
              }}
            >
              Discard changes
            </button>
            <button
              className="inline-flex rounded-md primary-btn"
              disabled={busy}
              onClick={async () => {
                const variant = await save();
                if (variant) {
                  pendingNavigation?.();
                  setPendingNavigation(null);
                }
              }}
            >
              Save and continue
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

