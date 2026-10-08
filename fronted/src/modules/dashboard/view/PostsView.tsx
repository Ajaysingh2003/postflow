"use client";

import {
  Component,
  Suspense,
  useDeferredValue,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  QueryErrorResetBoundary,
  useSuspenseQuery,
} from "@tanstack/react-query";
import {
  ArrowUpRight,
  CalendarClock,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  FilePenLine,
  ImageIcon,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import { useTRPC } from "@/trpc/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useComposer } from "@/modules/content/context/ComposerContext";
import { PlatformMark } from "@/modules/content/studio/AccountSwitcher";
import { type Account, type PostLibraryItem } from "@/modules/studio/types";
import {
  editorLink,
  libraryLink,
  libraryPostDate,
  libraryPostText,
  newPostLink,
  POSTS_PAGE_SIZE,
  POST_TABS,
  postStatus,
  postTab,
  TAB_LABELS,
  type PostTab,
} from "../postsModel";

const historyOptions = {
  staleTime: 30_000,
  refetchOnWindowFocus: false,
  retry: false,
} as const;
type FeedProps = { account: Account; tab: PostTab; page: number };
const subscribe = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;

export function PostsLoading() {
  return (
    <div className="space-y-5 p-5" role="status" aria-label="Loading posts">
      <div className="grid grid-cols-3 gap-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-28 rounded-2xl" />
        ))}
      </div>
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="h-40 rounded-2xl" />
      ))}
    </div>
  );
}

class PostsErrorBoundary extends Component<
  { children: ReactNode; onReset: () => void },
  { error: Error | null }
> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error)
      return (
        <div
          role="alert"
          className="m-5 rounded-2xl border border-border bg-card p-8 text-center"
        >
          <TriangleAlert className="mx-auto mb-3 size-6 text-amber-500" />
          <h2 className="text-lg font-semibold">We couldn’t load your posts</h2>
          <p className="mx-auto my-3 max-w-md text-sm text-muted-foreground">
            {this.state.error.message}
          </p>
          <Button
            variant="outline"
            onClick={() => {
              this.props.onReset();
              this.setState({ error: null });
            }}
          >
            Try again
          </Button>
        </div>
      );
    return this.props.children;
  }
}

function QueryBoundary({ children }: { children: ReactNode }) {
  return (
    <QueryErrorResetBoundary>
      {({ reset }) => (
        <PostsErrorBoundary onReset={reset}>
          <Suspense fallback={<PostsLoading />}>{children}</Suspense>
        </PostsErrorBoundary>
      )}
    </QueryErrorResetBoundary>
  );
}

export default function PostsView() {
  // Private queries use the signed-in browser transport, avoiding an unauthenticated SSR round trip.
  const hydrated = useSyncExternalStore(
    subscribe,
    clientSnapshot,
    serverSnapshot,
  );
  if (!hydrated) return <PostsLoading />;
  return (
    <QueryBoundary>
      <PostsWorkspace />
    </QueryBoundary>
  );
}

function PostsWorkspace() {
  const trpc = useTRPC();
  const router = useRouter();
  const params = useSearchParams();
  const { data: accounts } = useSuspenseQuery(
    trpc.studio.accounts.queryOptions(undefined, historyOptions),
  );
  const { setStudioNavigation } = useComposer();
  const account =
    accounts.find((a) => a.id === params.get("account")) ??
    accounts.find((a) => a.status === "active") ??
    accounts[0];
  const tab = postTab(params.get("tab"));
  const rawPage = Number(params.get("page") ?? 0);
  const page =
    Number.isSafeInteger(rawPage) && rawPage >= 0 && rawPage <= 200
      ? rawPage
      : 0;

  useEffect(() => {
    if (!account) return;
    setStudioNavigation({
      account,
      accounts,
      onSelect: (id) => router.push(libraryLink(id, tab)),
    });
    return () => setStudioNavigation(null);
  }, [account, accounts, router, setStudioNavigation, tab]);

  if (!account)
    return (
      <div className="mx-auto flex max-w-xl flex-col items-center gap-4 px-6 py-24 text-center">
        <Sparkles className="size-9 text-emerald-500" />
        <h1 className="text-3xl font-semibold tracking-tight">
          Your story starts here
        </h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Connect a channel to see your posts and plan what comes next.
        </p>
        <Button asChild>
          <Link href="/dashboard/channels">
            Connect a channel <ArrowUpRight className="size-4" />
          </Link>
        </Button>
      </div>
    );

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-5 sm:p-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Your publishing space
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">Posts</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Your Postflow posts, from first draft to published.
          </p>
        </div>
        <Button
          asChild
          className="bg-emerald-500 primary-btn text-white hover:bg-emerald-600"
        >
          <Link href={newPostLink(account.id)}>
            <Plus className="size-4" />
            New post
          </Link>
        </Button>
      </header>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav
          aria-label="Post categories"
          className="flex max-w-full gap-1 overflow-x-auto rounded-xl bg-muted/60 p-1"
        >
          {POST_TABS.map((t) => (
            <Link
              key={t}
              href={libraryLink(account.id, t)}
              scroll={false}
              prefetch={false}
              aria-current={tab === t ? "page" : undefined}
              className={cn(
                "shrink-0 rounded-lg px-3 py-2 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500",
                tab === t
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {TAB_LABELS[t]}
            </Link>
          ))}
        </nav>
      </div>
      <QueryBoundary key={`${account.id}:${tab}:${page}`}>
        <PostLibrary account={account} tab={tab} page={page} />
      </QueryBoundary>
    </div>
  );
}

function OverviewCards({
  account,
  tab,
  counts,
}: Omit<FeedProps, "page"> & { counts: Record<string, number> }) {
  return (
    <div className="grid grid-cols-3 gap-2 sm:gap-3">
      {[
        {
          tab: "posts" as const,
          icon: CheckCheck,
          color: "text-emerald-600 bg-emerald-500/10",
          hint: "Shared through Postflow",
        },
        {
          tab: "scheduled" as const,
          icon: CalendarClock,
          color: "text-sky-500 bg-sky-500/10",
          hint: "Ready for their moment",
        },
        {
          tab: "drafts" as const,
          icon: FilePenLine,
          color: "text-amber-500 bg-amber-500/10",
          hint: "Pick up where you left off",
        },
      ].map((card) => (
        <Link
          key={card.tab}
          href={libraryLink(account.id, card.tab)}
          prefetch={false}
          scroll={false}
          className={cn(
            "group rounded-2xl border bg-card p-3 transition-colors hover:border-emerald-500/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 sm:p-4",
            tab === card.tab ? "border-emerald-500/35" : "border-border",
          )}
        >
          <div className="flex items-center justify-between">
            <span className={cn("rounded-lg p-2", card.color)}>
              <card.icon className="size-4" />
            </span>
            <ArrowUpRight className="size-4 text-muted-foreground" />
          </div>
          <p className="mt-3 text-2xl font-semibold tabular-nums">
            {(counts[card.tab] ?? 0).toLocaleString()}
          </p>
          <p className="mt-1 text-xs font-medium">{TAB_LABELS[card.tab]}</p>
          <p className="mt-1 hidden text-[11px] text-muted-foreground sm:block">
            {card.hint}
          </p>
        </Link>
      ))}
    </div>
  );
}

export function LibraryPostCard({
  post,
  account,
}: {
  post: PostLibraryItem;
  account: Account;
}) {
  const attention = post.status === "failed" || post.status === "rejected";
  const date = libraryPostDate(post);
  return (
    <Link
      href={editorLink(post)}
      prefetch={false}
      className="group rounded-2xl border border-border bg-card p-5 transition-colors hover:border-emerald-500/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
    >
      <div className="mb-3 flex items-center justify-between gap-3 text-xs">
        <span className="flex min-w-0 items-center gap-2 text-muted-foreground">
          <PlatformMark platform={post.platform} />
          <span className="truncate">{account.display_name}</span>
        </span>
        <span
          className={cn(
            "shrink-0 rounded-full px-2 py-1 text-[10px] font-medium",
            attention
              ? "bg-red-500/10 text-red-500"
              : post.status === "published"
                ? "bg-emerald-500/10 text-emerald-600"
                : "bg-muted text-muted-foreground",
          )}
        >
          {postStatus(post.status)}
        </span>
      </div>
      <p className="line-clamp-5 whitespace-pre-wrap break-words text-sm leading-7">
        {libraryPostText(post) ||
          (post.title !== "Untitled"
            ? post.title
            : "An idea waiting for words…")}
      </p>
      {attention && post.last_error && (
        <p className="mt-3 line-clamp-2 text-xs leading-5 text-red-500">
          {post.last_error}
        </p>
      )}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-3 text-[11px] text-muted-foreground">
        <time dateTime={date ?? undefined}>{displayDate(date)}</time>
        <span className="flex items-center gap-2">
          {post.media_asset_ids.length > 0 && (
            <>
              <ImageIcon className="size-3.5" />
              {post.media_asset_ids.length}
            </>
          )}
          <span className="group-hover:text-emerald-600">
            {post.status === "published" ? "View post" : "Open editor"}
          </span>
          <ArrowUpRight className="size-3.5" />
        </span>
      </div>
    </Link>
  );
}

function displayDate(value: string | null) {
  if (!value || !Number.isFinite(Date.parse(value))) return "Date unavailable";
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function Toolbar({
  search,
  onSearch,
  refreshing,
  onRefresh,
  title,
  subtitle,
}: {
  search: string;
  onSearch: (value: string) => void;
  refreshing: boolean;
  onRefresh: () => void;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
      </div>
      <div className="flex items-center gap-2">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 size-3.5 text-muted-foreground" />
          <Input
            aria-label="Search this page"
            value={search}
            onChange={(event) => onSearch(event.target.value)}
            placeholder="Search this page…"
            className="h-9 w-44 pl-9 text-xs sm:w-52"
          />
        </div>
        <Button
          variant="outline"
          size="icon"
          aria-label="Refresh posts"
          disabled={refreshing}
          onClick={onRefresh}
        >
          <RefreshCw className={cn("size-4", refreshing && "animate-spin")} />
        </Button>
      </div>
    </div>
  );
}

function PostLibrary(props: FeedProps) {
  const { account, tab, page } = props;
  const trpc = useTRPC();
  // One bounded request supplies saved variants and all three counts. No social API calls.
  const query = useSuspenseQuery(
    trpc.studio.postLibrary.queryOptions(
      {
        connected_account_id: account.id,
        category: tab,
        offset: page * POSTS_PAGE_SIZE,
        limit: POSTS_PAGE_SIZE,
      },
      historyOptions,
    ),
  );
  const [search, setSearch] = useState("");
  const term = useDeferredValue(search).trim().toLocaleLowerCase();
  const data = query.data;
  const posts = data.items.filter((post) =>
    `${libraryPostText(post)} ${post.title}`.toLocaleLowerCase().includes(term),
  );
  return (
    <div className="space-y-6">
      <OverviewCards {...props} counts={data.counts} />
      <Toolbar
        title={TAB_LABELS[tab]}
        subtitle={
          tab === "posts"
            ? "Posts published through Postflow."
            : tab === "scheduled"
              ? "Upcoming posts and those currently publishing."
              : "Saved ideas and posts that need attention."
        }
        search={search}
        onSearch={setSearch}
        refreshing={query.isFetching}
        onRefresh={() => void query.refetch()}
      />
      {query.error && (
        <p
          role="alert"
          className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-xs"
        >
          Refresh failed. Showing posts already loaded. {query.error.message}
        </p>
      )}
      {posts.length ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {posts.map((post) => (
            <LibraryPostCard key={post.id} post={post} account={account} />
          ))}
        </div>
      ) : (
        <EmptyPosts search={!!term} tab={tab} account={account.id} />
      )}
      <Pagination
        {...props}
        hasNext={data.next_offset !== null}
        label={
          data.items.length
            ? `${page * POSTS_PAGE_SIZE + 1}–${page * POSTS_PAGE_SIZE + data.items.length} of ${data.total.toLocaleString()}`
            : `0 of ${data.total.toLocaleString()}`
        }
      />
    </div>
  );
}

function EmptyPosts({
  search,
  tab,
  account,
}: {
  search: boolean;
  tab: PostTab;
  account: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-muted/20 px-6 py-14 text-center">
      <FilePenLine className="mx-auto mb-3 size-7 text-muted-foreground/60" />
      <h3 className="text-base font-medium">
        {search
          ? "No matches on this page"
          : tab === "posts"
            ? "Your next post starts here"
            : tab === "scheduled"
              ? "Your schedule is clear"
              : "Room for your next idea"}
      </h3>
      <p className="mx-auto mt-2 max-w-sm text-xs leading-6 text-muted-foreground">
        {search
          ? "Try another phrase or browse the next page."
          : tab === "posts"
            ? "Posts you publish through Postflow will appear here."
            : tab === "scheduled"
              ? "Choose a time in the editor to add a post to your schedule."
              : "Save a draft in the editor to continue writing later."}
      </p>
      {!search && (
        <Button variant="outline" className="mt-5" asChild>
          <Link href={newPostLink(account)}>
            <Plus className="size-4" />
            Write a post
          </Link>
        </Button>
      )}
    </div>
  );
}

function Pagination({
  account,
  tab,
  page,
  hasNext,
  label,
}: FeedProps & { hasNext: boolean; label: string }) {
  return (
    <nav
      aria-label="Post pagination"
      className="flex items-center justify-between gap-3 text-xs text-muted-foreground"
    >
      <span>{label}</span>
      <div className="flex gap-2">
        {page > 0 ? (
          <Button size="sm" variant="outline" asChild>
            <Link
              href={libraryLink(account.id, tab, page - 1)}
              prefetch={false}
              scroll={false}
            >
              <ChevronLeft className="size-4" />
              Previous
            </Link>
          </Button>
        ) : (
          <Button size="sm" variant="outline" disabled>
            <ChevronLeft className="size-4" />
            Previous
          </Button>
        )}
        {hasNext ? (
          <Button size="sm" variant="outline" asChild>
            <Link
              href={libraryLink(account.id, tab, page + 1)}
              prefetch={false}
              scroll={false}
            >
              Next
              <ChevronRight className="size-4" />
            </Link>
          </Button>
        ) : (
          <Button size="sm" variant="outline" disabled>
            Next
            <ChevronRight className="size-4" />
          </Button>
        )}
      </div>
    </nav>
  );
}




