"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import type { AgentEvent, DraftArtifact } from "../agentStream";
import type { ComposerState } from "../context/ComposerContext";
import type { SourceAsset } from "../assets";
import type { SidecarBridge, SidecarReply } from "../studio/sidecarBridge";
import type { ChatTurn } from "../chatTypes";
import { responseDraft } from "../chatTypes";
import { assistantDraftRequest } from "../assistantRequest";

type Activity = Extract<AgentEvent, { type: "activity" }>;
export type AgentRun = {
  id: string;
  scope: string;
  prompt: string;
  text: string;
  status: "running" | "succeeded" | "failed" | "cancelled";
  activities: Activity[];
  artifact?: DraftArtifact;
  error?: string;
  attachments: SourceAsset[];
  replace?: SidecarReply["replace"];
  canApply?: boolean;
};
type LocalRun = AgentRun & {
  conversationId: string | null;
  emptySession: number;
};
export function savedChatRun(
  turn: ChatTurn,
  scope: string,
  now = Date.now(),
): AgentRun {
  const output = turn.response_data.output ?? {};
  const content = responseDraft(output);
  const interrupted =
    turn.status === "running" &&
    now - new Date(turn.created_at).getTime() > 5 * 60 * 1000;
  return {
    id: turn.request_id,
    scope,
    prompt: turn.prompt,
    text: typeof output.notes === "string" ? output.notes : "",
    status: interrupted ? "failed" : turn.status,
    activities: [],
    attachments: [],
    canApply: false,
    error: interrupted
      ? "This response was interrupted. Send a new message to continue."
      : (turn.error ?? undefined),
    ...(content && turn.status === "succeeded"
      ? {
          artifact: {
            id: turn.id,
            original: turn.original_text,
            content,
            title: "Suggested draft",
            summary: "",
          },
        }
      : {}),
  };
}
export function useAgentChat(
  state: ComposerState,
  scope: string,
  bridge: SidecarBridge | null | undefined,
  accountId: string | undefined,
  identity: { workspaceId: string; viewerId: string },
) {
  const trpc = useTRPC();
  const cache = useQueryClient();
  const auth = {
    workspace_id: identity.workspaceId,
    viewer_id: identity.viewerId,
  };
  const key = `${identity.viewerId}:${identity.workspaceId}:${scope}`;
  const [selection, setSelection] = useState<{
    key: string;
    id: string | null;
    restored: boolean;
  } | null>(null);
  const selected = selection?.key === key ? selection : null;
  const activeId = selected?.id ?? null;
  const [emptySession, setEmptySession] = useState(0);
  const [local, setLocal] = useState<LocalRun[]>([]);
  const controller = useRef<AbortController | null>(null);
  const create = useMutation(trpc.assistantChats.create.mutationOptions());
  const resume = useMutation(trpc.assistantChats.continue.mutationOptions());
  const generate = useMutation(trpc.studio.runFeature.mutationOptions());
  const detail = useInfiniteQuery(
    trpc.assistantChats.detail.infiniteQueryOptions(
      { ...auth, id: activeId ?? "00000000-0000-4000-8000-000000000000" },
      {
        enabled: !!activeId,
        getNextPageParam: (page) => page.next_cursor ?? undefined,
        refetchInterval: (query) =>
          query.state.data?.pages.some((page) =>
            page.turns.some(
              (turn) =>
                turn.status === "running" &&
                Date.now() - new Date(turn.created_at).getTime() <
                  5 * 60 * 1000,
            ),
          )
            ? 3000
            : false,
      },
    ),
  );
  const conversation = detail.data?.pages[0];
  const live = useMemo(
    () =>
      local.filter(
        (run) =>
          run.scope === key &&
          (activeId
            ? run.conversationId === activeId
            : run.conversationId === null && run.emptySession === emptySession),
      ),
    [local, key, activeId, emptySession],
  );
  const persisted = useMemo(
    () =>
      (detail.data?.pages.flatMap((page) => page.turns) ?? [])
        .sort((a, b) => a.sequence - b.sequence)
        .map((turn) => {
          const saved = savedChatRun(turn, key);
          const current = live.find((run) => run.id === saved.id);
          return current
            ? {
                ...saved,
                ...current,
                canApply: !selected?.restored && current.canApply,
                replace: selected?.restored ? undefined : current.replace,
              }
            : saved;
        }),
    [detail.data, key, live, selected?.restored],
  );
  const runs = useMemo(
    () => [
      ...persisted,
      ...live.filter((run) => !persisted.some((saved) => saved.id === run.id)),
    ],
    [persisted, live],
  );
  const busy = create.isPending || runs.some((run) => run.status === "running");
  useEffect(() => {
    controller.current?.abort();
    return () => controller.current?.abort();
  }, [key]);

  async function send(prompt: string, attachments: SourceAsset[] = []) {
    if (
      busy ||
      (controller.current && !controller.current.signal.aborted) ||
      prompt.trim().length < 3
    )
      return false;
    const abort = new AbortController();
    controller.current = abort;
    const requestId = crypto.randomUUID();
    const update = (patch: Partial<LocalRun>) =>
      setLocal((items) =>
        items.map((run) => (run.id === requestId ? { ...run, ...patch } : run)),
      );
    setLocal((items) => [
      ...items,
      {
        id: requestId,
        scope: key,
        conversationId: activeId,
        emptySession,
        prompt,
        text: "",
        status: "running",
        activities: [],
        attachments,
        canApply: !selected?.restored,
      },
    ]);
    let conversationId = activeId;
    try {
      if (attachments.length)
        throw new Error(
          "Reference-file drafting is unavailable here. Paste the source text to continue.",
        );
      if (!conversationId) {
        const created = await create.mutateAsync({
          ...auth,
          id: crypto.randomUUID(),
          title: prompt.trim().slice(0, 160),
          platform: bridge?.platform ?? state.platform,
          connected_account_id: bridge?.accountId ?? accountId,
          context: {
            source_text: (bridge?.context?.source_text ?? state.content).slice(
              0,
              10000,
            ),
            origin_scope: scope.slice(0, 2000),
            account_name: (bridge?.styleOwner ?? "").slice(0, 240),
            draft_id: bridge?.context?.draft_id ?? null,
          },
        });
        conversationId = created.id;
        update({ conversationId });
        setSelection({ key, id: conversationId, restored: false });
      }
      if (abort.signal.aborted)
        throw new DOMException("Cancelled", "AbortError");
      if (selected?.restored) {
        const result = await resume.mutateAsync({
          ...auth,
          id: conversationId,
          prompt: prompt.trim(),
          request_id: requestId,
        });
        const content = responseDraft(result.output);
        update({
          text:
            typeof result.output.notes === "string" ? result.output.notes : "",
          artifact: content
            ? {
                id: requestId,
                original:
                  runs.at(-1)?.artifact?.content ??
                  conversation?.context.source_text ??
                  "",
                content,
                title: "Suggested draft",
                summary: "",
              }
            : undefined,
          canApply: false,
        });
      } else if (bridge) {
        const result = await bridge.send(
          prompt.trim(),
          attachments,
          abort.signal,
          { id: conversationId, requestId, workspaceId: identity.workspaceId },
        );
        update({ ...result, canApply: true });
      } else {
        const result = await generate.mutateAsync({
          ...assistantDraftRequest(state, prompt.trim(), accountId),
          conversation_id: conversationId,
          request_id: requestId,
          conversation_prompt: prompt.trim(),
          conversation_source: state.content.slice(0, 10000),
          workspace_id: identity.workspaceId,
        });
        const content = responseDraft(result.output);
        if (!content)
          throw new Error(
            "The assistant did not return a draft. Please retry.",
          );
        update({
          text:
            typeof result.output.notes === "string" ? result.output.notes : "",
          artifact: {
            id: requestId,
            original: state.content,
            content,
            title: "Suggested draft",
            summary: "",
          },
          canApply: true,
        });
      }
      if (abort.signal.aborted)
        throw new DOMException("Cancelled", "AbortError");
      update({ status: "succeeded" });
    } catch (error) {
      update({
        status: abort.signal.aborted ? "cancelled" : "failed",
        artifact: undefined,
        error: abort.signal.aborted
          ? undefined
          : error instanceof Error
            ? error.message
            : "Could not save this reply. Please retry.",
      });
    } finally {
      if (controller.current === abort) controller.current = null;
      void cache.invalidateQueries({
        queryKey: trpc.assistantChats.detail.pathKey(),
      });
      void cache.invalidateQueries({
        queryKey: trpc.assistantChats.list.pathKey(),
      });
    }
    return true;
  }
  function newChat() {
    if (busy) return;
    setSelection({ key, id: null, restored: false });
    setEmptySession((value) => value + 1);
  }
  return {
    runs,
    busy,
    send,
    conversation,
    activeId,
    restored: !!selected?.restored,
    isLoading: !!activeId && detail.isPending,
    error: activeId ? detail.error : null,
    retry: detail.refetch,
    hasOlder: detail.hasNextPage,
    loadingOlder: detail.isFetchingNextPage,
    loadOlder: detail.fetchNextPage,
    open: (id: string) => {
      if (!busy) setSelection({ key, id, restored: true });
    },
    newChat,
    clear: newChat,
    stop: () => {
      controller.current?.abort();
      setLocal((items) =>
        items.map((run) =>
          run.scope === key && run.status === "running"
            ? {
                ...run,
                status: "cancelled",
                artifact: undefined,
                error: undefined,
              }
            : run,
        ),
      );
    },
  };
}
