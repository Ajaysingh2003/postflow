"use client";
import { useEffect, useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import {
  ArrowUpRight,
  Clock3,
  MessageSquare,
  Plus,
  Search,
  X,
} from "lucide-react";
import { useTRPC } from "@/trpc/client";
import { Skeleton } from "@/components/ui/skeleton";
import { groupConversations, type Conversation } from "../chatTypes";
import { profileFor } from "../studio/model";

export function HistorySkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading conversations"
      className="space-y-4 px-4 py-5"
    >
      {Array.from({ length: 5 }, (_, index) => (
        <div key={index} className="space-y-2">
          <Skeleton className="h-4 w-4/5" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      ))}
    </div>
  );
}
export function HistoryList({
  items,
  activeId,
  busy,
  open,
  search = "",
  now,
}: {
  items: Conversation[];
  activeId: string | null;
  busy: boolean;
  open: (id: string) => void;
  search?: string;
  now?: Date;
}) {
  if (!items.length)
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
        <span className="mb-4 flex size-11 items-center justify-center rounded-xl border border-border/70 bg-background">
          <MessageSquare className="size-5 text-muted-foreground" />
        </span>
        <h3 className="font-heading text-lg font-medium">
          {search
            ? "No matching conversations"
            : "Your conversations live here"}
        </h3>
        <p className="mt-2 max-w-64 text-xs leading-6 text-muted-foreground">
          {search
            ? "Try a different word from the conversation’s title."
            : "Start a chat with Draftva. Your messages and writing context will be saved so you can pick up where you left off."}
        </p>
      </div>
    );
  return (
    <div className="space-y-5 px-3 py-4">
      {groupConversations(items, now).map(([label, conversations]) => (
        <section key={label}>
          <h3 className="mb-2 px-2 text-[10px] font-medium tracking-wide text-muted-foreground">
            {label}
          </h3>
          <ul className="space-y-1">
            {conversations.map((chat) => (
              <li key={chat.id}>
                <button
                  type="button"
                  aria-label={`Open conversation: ${chat.title}`}
                  aria-current={chat.id === activeId ? "true" : undefined}
                  disabled={busy}
                  onClick={() => open(chat.id)}
                  className={`group flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 disabled:opacity-50 ${chat.id === activeId ? "border-border/80 bg-background shadow-xs" : "border-transparent hover:border-border/50 hover:bg-background/70"}`}
                >
                  <MessageSquare className="size-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium text-foreground">
                      {chat.title}
                    </span>
                    <span className="mt-1 block truncate text-[10px] text-muted-foreground">
                      {profileFor(chat.platform).name}
                      {chat.context.account_name
                        ? ` · ${chat.context.account_name}`
                        : ""}{" "}
                      · {chat.turn_count}{" "}
                      {chat.turn_count === 1 ? "message" : "messages"}
                    </span>
                  </span>
                  <ArrowUpRight className="size-3.5 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
export function AssistantHistory({
  workspaceId,
  viewerId,
  activeId,
  busy,
  onOpen,
  onNew,
}: {
  workspaceId: string;
  viewerId: string;
  activeId: string | null;
  busy: boolean;
  onOpen: (id: string) => void;
  onNew: () => void;
}) {
  const trpc = useTRPC();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setFilter(search.trim()), 250);
    return () => clearTimeout(timer);
  }, [search]);
  const query = useInfiniteQuery(
    trpc.assistantChats.list.infiniteQueryOptions(
      { workspace_id: workspaceId, viewer_id: viewerId, search: filter },
      { getNextPageParam: (page) => page.next_cursor ?? undefined },
    ),
  );
  const items = [
    ...new Map(
      (query.data?.pages.flatMap((page) => page.items) ?? []).map((chat) => [
        chat.id,
        chat,
      ]),
    ).values(),
  ];
  return (
    <section
      aria-label="Conversation history"
      className="flex min-h-0 flex-1 flex-col"
    >
      <div className="shrink-0 px-4 pb-4 pt-5">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground" />
          <input
            type="search"
            aria-label="Search conversations"
            value={search}
            maxLength={160}
            placeholder="Search conversations…"
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 w-full rounded-xl border border-border/80 bg-background pl-9 pr-9 text-xs outline-none focus:ring-2 focus:ring-emerald-200"
          />
          {search && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => setSearch("")}
              className="absolute right-2 top-2 flex size-6 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
            >
              <X size={13} />
            </button>
          )}
        </div>
        <p className="mt-3 flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <Clock3 size={11} />
          Private to you in this workspace
        </p>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto pb-5 [scrollbar-width:thin]">
        {query.isPending ? (
          <HistorySkeleton />
        ) : query.isError ? (
          <div
            role="alert"
            className="mx-4 rounded-xl border border-red-200 bg-red-50 p-4 text-xs leading-6 text-red-700"
          >
            <p>
              History couldn’t load. Your saved conversations are still there.
            </p>
            <button
              type="button"
              className="secondary-btn mt-3 !text-xs"
              onClick={() => void query.refetch()}
            >
              Try again
            </button>
          </div>
        ) : (
          <>
            <HistoryList
              items={items}
              activeId={activeId}
              busy={busy}
              open={onOpen}
              search={filter}
            />
            {query.hasNextPage && (
              <div className="px-5">
                <button
                  type="button"
                  disabled={query.isFetchingNextPage}
                  onClick={() => void query.fetchNextPage()}
                  className="secondary-btn w-full justify-center !text-xs"
                >
                  {query.isFetchingNextPage
                    ? "Loading…"
                    : "Load more conversations"}
                </button>
              </div>
            )}
          </>
        )}
      </div>
      <footer className="shrink-0 border-t border-border/60 p-4">
        <button
          type="button"
          disabled={busy}
          onClick={onNew}
          className="primary-btn w-full justify-center rounded-lg disabled:opacity-40"
        >
          <Plus size={15} />
          New conversation
        </button>
      </footer>
    </section>
  );
}
