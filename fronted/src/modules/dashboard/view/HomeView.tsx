"use client";

import {
  Component,
  Suspense,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import Link from "next/link";
import {
  QueryErrorResetBoundary,
  useSuspenseQuery,
} from "@tanstack/react-query";
import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Check,
  CheckCheck,
  ChevronRight,
  CircleCheck,
  Clock3,
  FilePenLine,
  Layers3,
  Users,
  Plus,
  RefreshCw,
  StarCheckIcon,
  TriangleAlert,
  Unplug,
} from "lucide-react";
import { useTRPC } from "@/trpc/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PlatformMark } from "@/modules/content/studio/AccountSwitcher";
import HomeSkeleton from "../component/HomeSkeleton";
import {
  HOME_QUERY_OPTIONS,
  homeClock,
  homeFailureMessage,
  homePostLink,
  homePostTime,
  homePostTitle,
  homeSetup,
  type HomeSummary,
  type HomePost,
} from "../homeModel";

import { HomeAiUsageCard } from "../component/HomeAiUsageCard";
import {
  HomeAnalyticsCard,
  HomeConnectionCard,
} from "../component/HomeDiscoveryCards";

const panel = "rounded-2xl border border-border/70 bg-card shadow-xs";
const focus =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";
const subscribe = () => () => {};
const browserZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;
const serverZone = () => "UTC";

export class HomeErrorBoundary extends Component<
  { children: ReactNode; onReset: () => void },
  { error: boolean }
> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    if (this.state.error)
      return (
        <div role="alert" className="mx-auto max-w-2xl px-5 py-20 text-center">
          <div className="mx-auto mb-5 flex size-14 items-center justify-center rounded-2xl bg-amber-500/10">
            <TriangleAlert className="size-6 text-amber-600" />
          </div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            Your workspace couldn’t load
          </h1>
          <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-muted-foreground">
            Try again in a moment. You can still go directly to your content.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button
              className="primary-btn rounded-lg"
              onClick={() => {
                this.props.onReset();
                this.setState({ error: false });
              }}
            >
              <RefreshCw className="size-4" />
              Try again
            </Button>
            <Button
              asChild
              variant="outline"
              className="secondary-btn dark:!bg-card dark:!bg-none dark:!text-foreground rounded-lg"
            >
              <Link href="/dashboard/content">
                Open content
                <ArrowUpRight className="size-4" />
              </Link>
            </Button>
          </div>
        </div>
      );
    return this.props.children;
  }
}

export default function HomeView({ workspaceId }: { workspaceId?: string }) {
  return (
    <QueryErrorResetBoundary>
      {({ reset }) => (
        <HomeErrorBoundary onReset={reset}>
          <Suspense fallback={<HomeSkeleton />}>
            <HomeContent workspaceId={workspaceId} />
          </Suspense>
        </HomeErrorBoundary>
      )}
    </QueryErrorResetBoundary>
  );
}

function HomeContent({ workspaceId }: { workspaceId?: string }) {
  const trpc = useTRPC();
  const query = useSuspenseQuery(
    trpc.studio.home.queryOptions(
      { workspace_id: workspaceId },
      HOME_QUERY_OPTIONS,
    ),
  );
  const timeZone = useSyncExternalStore(subscribe, browserZone, serverZone);
  return (
    <HomeOverview
      data={query.data}
      timeZone={timeZone}
      refreshing={query.isFetching}
      refreshError={!!query.error}
      onRefresh={() => void query.refetch()}
    />
  );
}

function SectionHeading({
  title,
  subtitle,
  href,
  action,
}: {
  title: string;
  subtitle?: string;
  href?: string;
  action?: string;
}) {
  return (
    <div className="mb-4 flex items-end justify-between gap-3">
      <div className="min-w-0">
        <h2 className="font-heading text-[15px] font-semibold tracking-tight">
          {title}
        </h2>
        {subtitle && (
          <p className="mt-0.5 truncate text-xs leading-5 text-muted-foreground">
            {subtitle}
          </p>
        )}
      </div>
      {href && (
        <Link
          href={href}
          prefetch={false}
          className={cn(
            focus,
            "group/link inline-flex shrink-0 items-center gap-1 rounded-md text-xs font-medium text-muted-foreground transition-colors hover:text-foreground",
          )}
        >
          {action}
          <ArrowUpRight className="size-3.5 transition-transform group-hover/link:-translate-y-px group-hover/link:translate-x-px" />
        </Link>
      )}
    </div>
  );
}

function Destination({ post, data }: { post: HomePost; data: HomeSummary }) {
  const account = data.accounts.find((a) => a.id === post.connected_account_id);
  return (
    <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
      {post.platform ? (
        <PlatformMark platform={post.platform} />
      ) : (
        <FilePenLine className="size-3.5" />
      )}
      <span className="truncate">
        {account?.display_name ??
          (post.platform
            ? post.status === "draft"
              ? "Choose an account"
              : "Account removed"
            : "Unassigned draft")}
      </span>
    </span>
  );
}

export function HomeDraftCard({
  post,
  data,
  timeZone,
}: {
  post: HomePost;
  data: HomeSummary;
  timeZone: string;
}) {
  return (
    <Link
      href={homePostLink(post)}
      prefetch={false}
      className={cn(
        panel,
        focus,
        "group flex min-w-0 flex-col p-4 transition-all hover:-translate-y-px hover:border-emerald-500/40 hover:shadow-sm",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <Destination post={post} data={data} />
        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted/60 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
          <ArrowUpRight className="size-3.5" />
        </span>
      </div>
      <h3 className="mt-4 line-clamp-2 break-words text-sm font-medium leading-5">
        {homePostTitle(post)}
      </h3>
      <p className="mt-1.5 line-clamp-3 whitespace-pre-wrap break-words text-xs leading-5 text-muted-foreground">
        {post.text || "A blank page, ready for your next idea."}
      </p>
      <div className="mt-auto flex items-center justify-between gap-2 border-t border-border/60 pt-3 text-[11px]">
        <span className="text-muted-foreground">
          Edited {homePostTime(post, data.fetched_at, timeZone)}
        </span>
        <span className="font-medium text-emerald-700 dark:text-emerald-400">
          {data.can_edit ? "Continue" : "View draft"}
        </span>
      </div>
    </Link>
  );
}

function EmptySection({
  kind,
  canEdit,
}: {
  kind: "drafts" | "upcoming" | "published";
  canEdit: boolean;
}) {
  const settings = {
    drafts: {
      icon: FilePenLine,
      title: "No drafts yet",
      text: "Save a draft and it will wait for you here.",
      href: "/dashboard/content?new=1",
      action: "Start a draft",
    },
    upcoming: {
      icon: CalendarDays,
      title: "Nothing scheduled",
      text: "Pick a time in the editor to plan your next post.",
      href: "/dashboard/content",
      action: "Choose a draft",
    },
    published: {
      icon: CheckCheck,
      title: "No published posts yet",
      text: "Posts you publish through Postflow will show up here.",
      href: "/dashboard/content",
      action: "Open content",
    },
  }[kind];
  return (
    <div className="flex min-h-44 flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/10 px-5 py-8 text-center">
      <span className="mb-3 flex size-10 items-center justify-center rounded-xl bg-muted/60">
        <settings.icon className="size-5 text-muted-foreground" />
      </span>
      <h3 className="text-sm font-medium">{settings.title}</h3>
      <p className="mt-1.5 max-w-xs text-xs leading-5 text-muted-foreground">
        {settings.text}
      </p>
      {canEdit && (
        <Button
          asChild
          variant="outline"
          className="secondary-btn dark:!bg-card dark:!bg-none dark:!text-foreground mt-4 rounded-lg !text-xs"
        >
          <Link href={settings.href}>
            {settings.action}
            <ArrowRight className="size-3.5" />
          </Link>
        </Button>
      )}
    </div>
  );
}

export function HomeOverview({
  data,
  timeZone = "UTC",
  refreshing = false,
  refreshError = false,
  onRefresh,
}: {
  data: HomeSummary;
  timeZone?: string;
  refreshing?: boolean;
  refreshError?: boolean;
  onRefresh?: () => void;
}) {
  const active = data.accounts.filter((a) => a.status === "active");
  const reconnect = data.accounts.filter((a) => a.status === "needs_reauth");
  const hasConnectedAccounts = active.length + reconnect.length > 0;
  const attention = data.counts.failed + reconnect.length;
  const steps = homeSetup(data);
  const doneCount = steps.filter((s) => s.done).length;
  const showSetup = doneCount !== steps.length;
  const newPostHref = active[0]
    ? `/dashboard/content?${new URLSearchParams({ new: "1", account: active[0].id })}`
    : "/dashboard/content?new=1";
  const connectFirst = !active.length && data.can_manage_channels;

  const stats = [
    {
      label: "Drafts",
      value: data.counts.drafts,
      note: "Ready to return to",
      icon: FilePenLine,
      href: "#continue-writing",
    },
    {
      label: "Scheduled",
      value: data.counts.scheduled,
      note: "Planned across channels",
      icon: CalendarDays,
      href: "#upcoming-posts",
    },
    {
      label: "Published",
      value: data.counts.published_week,
      note: "Last 7 days",
      icon: CheckCheck,
      href: "#recently-published",
    },
    {
      label: "Connected accounts",
      value: data.usage.connected_accounts.used,
      note:
        data.usage.connected_accounts.limit === null
          ? "Unlimited connections"
          : `of ${data.usage.connected_accounts.limit} included`,
      icon: Users,
      href: "/dashboard/channels",
    },
  ];

  return (
    <div
      data-slot="workspace-home"
      aria-busy={refreshing}
      className="@container/home mx-auto max-w-7xl space-y-6 px-5 pb-12 pt-6 sm:px-8 lg:px-10"
    >
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-muted-foreground">
            {data.workspace_name}
          </p>
          <h1 className="mt-1 font-heading text-3xl font-semibold tracking-tight">
            Home
          </h1>
        </div>
        <Button
          variant="outline"
          className="secondary-btn dark:!bg-card dark:!bg-none dark:!text-foreground rounded-lg !text-xs"
          disabled={refreshing}
          onClick={onRefresh}
        >
          <RefreshCw className={cn("size-3.5", refreshing && "animate-spin")} />
          {refreshing ? "Refreshing" : "Refresh"}
        </Button>
      </header>

      {refreshError && (
        <p
          role="alert"
          className="flex items-center gap-2 rounded-xl border border-amber-500/25 bg-amber-500/5 px-4 py-3 text-xs leading-5"
        >
          <TriangleAlert className="size-4 shrink-0 text-amber-600" />
          We couldn’t refresh Home. Your last loaded overview is still shown.
          Try Refresh again.
        </p>
      )}

      {/* Stats: one joined panel */}
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border/70 bg-border/70 shadow-xs @3xl/home:grid-cols-4">
        {stats.map((card) => (
          <Link
            key={card.label}
            href={card.href}
            className={cn(
              focus,
              "group relative flex flex-col gap-3 bg-card p-4 transition-colors hover:bg-muted/30 sm:p-5",
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <card.icon className="size-3.5 shrink-0" />
                <span className="truncate">{card.label}</span>
              </p>
              <ArrowUpRight className="size-3.5 shrink-0 text-muted-foreground/0 transition-all group-hover:text-muted-foreground group-hover:-translate-y-px group-hover:translate-x-px" />
            </div>
            <p className="font-heading text-3xl font-semibold tabular-nums tracking-tight">
              {card.value.toLocaleString("en-US")}
            </p>
            <p className="-mt-1 text-[11px] leading-4 text-muted-foreground">
              {card.note}
            </p>
          </Link>
        ))}
      </div>

      {/* Hero (kept) */}
      <section className="relative overflow-hidden rounded-2xl border border-emerald-500/15 bg-gradient-to-br from-emerald-500/[0.09] via-emerald-500/[0.025] to-background px-5 py-6 sm:px-7 sm:py-7">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-16 -top-28 size-80 rounded-full border-[35px] border-emerald-500/[0.04]"
        />
        <div className="relative flex flex-wrap items-center justify-between gap-6">
          <div className="max-w-lg">
            <span className="mb-3 inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-400">
              <StarCheckIcon className="size-3.5" />A little momentum
            </span>
            <h2 className="font-heading text-2xl font-semibold tracking-tight sm:text-[28px]">
              Your next post starts here.
            </h2>
            <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
              Capture a thought, give it your voice, and find the right moment
              to share it.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Button asChild className="primary-btn rounded-lg">
                <Link
                  href={
                    connectFirst
                      ? "/dashboard/channels"
                      : data.can_edit
                        ? newPostHref
                        : "/dashboard/content"
                  }
                >
                  <Plus className="size-4" />
                  {connectFirst
                    ? "Connect a channel"
                    : data.can_edit
                      ? "New post"
                      : "View content"}
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                className="secondary-btn dark:!bg-card dark:!bg-none dark:!text-foreground rounded-lg"
              >
                <Link href="/dashboard/schedule">
                  <CalendarDays className="size-4" />
                  View schedule
                </Link>
              </Button>
            </div>
          </div>
          <div className="min-w-0 self-end">
            <p className="mb-2 text-[11px] font-medium text-muted-foreground">
              {active.length
                ? `Writing across ${active.length} ${active.length === 1 ? "channel" : "channels"}`
                : "Your audience is one connection away"}
            </p>
            <div className="flex flex-wrap gap-2">
              {active.slice(0, 4).map((a) => (
                <Link
                  key={a.id}
                  href="/dashboard/channels"
                  className={cn(
                    focus,
                    "flex max-w-40 items-center gap-2 rounded-lg border border-border/60 bg-background/80 px-2.5 py-2 text-xs transition-colors hover:border-emerald-500/30",
                  )}
                >
                  <PlatformMark platform={a.platform} />
                  <span className="truncate">{a.display_name}</span>
                </Link>
              ))}
              {active.length > 4 && (
                <Link
                  href="/dashboard/channels"
                  className={cn(
                    focus,
                    "rounded-lg border border-border/60 bg-background/80 px-2.5 py-2 text-xs",
                  )}
                >
                  +{active.length - 4} more
                </Link>
              )}
              {!active.length && (
                <Button
                  asChild
                  variant="outline"
                  className="secondary-btn dark:!bg-card dark:!bg-none dark:!text-foreground rounded-lg !text-xs"
                >
                  <Link href="/dashboard/channels">
                    <Layers3 className="size-3.5" />
                    View channels
                    <ArrowUpRight className="size-3.5" />
                  </Link>
                </Button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Setup: slim progress strip */}
      {showSetup && (
        <section aria-label="Getting started" className={cn(panel, "p-5")}>
          <div className="mb-4 flex items-center justify-between gap-4">
            <h2 className="font-heading text-sm font-semibold">
              Finish setting up
            </h2>
            <div className="flex items-center gap-3">
              <div
                className="hidden h-1.5 w-28 overflow-hidden rounded-full bg-muted sm:block"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={steps.length}
                aria-valuenow={doneCount}
              >
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all"
                  style={{ width: `${(doneCount / steps.length) * 100}%` }}
                />
              </div>
              <span className="text-[11px] tabular-nums text-muted-foreground">
                {doneCount} of {steps.length} complete
              </span>
            </div>
          </div>
          <ol className="grid gap-3 sm:grid-cols-3">
            {steps.map((step, i) => (
              <li key={step.title}>
                <Link
                  href={step.href}
                  className={cn(
                    focus,
                    "group flex h-full items-start gap-3 rounded-xl border px-3.5 py-3.5 transition-colors hover:bg-muted/40",
                    step.done
                      ? "border-emerald-500/20 bg-emerald-500/[0.03]"
                      : "border-border/60",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-medium",
                      step.done
                        ? "bg-emerald-500 text-white"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    {step.done ? <Check className="size-3.5" /> : i + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-medium">
                      {step.title}
                      {step.done && (
                        <span className="sr-only"> — complete</span>
                      )}
                    </p>
                    <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
                      {step.detail}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ol>
        </section>
      )}

      <div className="grid items-stretch gap-6 @3xl/home:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        {!hasConnectedAccounts ? (
          <HomeConnectionCard
            canManage={data.can_manage_channels}
            canEdit={data.can_edit}
            drafts={data.counts.drafts}
          />
        ) : (
          <section
            id="continue-writing"
            className={cn(
              panel,
              "@container/drafts flex min-w-0 scroll-mt-5 flex-col p-5",
            )}
          >
            <SectionHeading
              title="Continue writing"
              subtitle="Ideas worth coming back to"
              href="/dashboard/content"
              action="Open content"
            />
            {data.drafts.length ? (
              <div className="grid flex-1 gap-3 @sm/drafts:grid-cols-2 @lg/drafts:grid-cols-3">
                {data.drafts.map((post) => (
                  <HomeDraftCard
                    key={post.variant_id ?? post.post_id}
                    post={post}
                    data={data}
                    timeZone={timeZone}
                  />
                ))}
              </div>
            ) : (
              <EmptySection kind="drafts" canEdit={data.can_edit} />
            )}
          </section>
        )}
        <HomeAiUsageCard usage={data.usage} />
        <section
          id="recently-published"
          className={cn(panel, "flex min-w-0 scroll-mt-5 flex-col p-5")}
        >
          <SectionHeading
            title="Recently published"
            subtitle="Latest posts shared through Postflow"
          />
          {data.published.length ? (
            <div className={cn(panel, "divide-y divide-border/60")}>
              {data.published.map((post) => (
                <Link
                  key={post.variant_id}
                  href={homePostLink(post)}
                  prefetch={false}
                  className={cn(
                    focus,
                    "group flex items-center gap-3 p-4 transition-colors first:rounded-t-2xl last:rounded-b-2xl hover:bg-muted/30",
                  )}
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10">
                    <CheckCheck className="size-4 text-emerald-600" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-1 break-words text-[13px] font-medium leading-5">
                      {homePostTitle(post)}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                      <Destination post={post} data={data} />
                      <span className="text-[11px] text-muted-foreground">
                        {homePostTime(post, data.fetched_at, timeZone)}
                      </span>
                    </div>
                  </div>
                  <ArrowUpRight className="size-3.5 shrink-0 text-muted-foreground/50 transition-colors group-hover:text-foreground" />
                </Link>
              ))}
            </div>
          ) : (
            <EmptySection kind="published" canEdit={data.can_edit} />
          )}
        </section>
        <section
          id="upcoming-posts"
          className={cn(panel, "flex min-w-0 scroll-mt-5 flex-col p-5")}
        >
          <SectionHeading
            title="Coming up next"
            subtitle={timeZone.replaceAll("_", " ")}
            href="/dashboard/schedule"
            action="Schedule"
          />
          {data.upcoming.length ? (
            <ol>
              {data.upcoming.map((post, i) => (
                <li key={post.variant_id}>
                  <Link
                    href={homePostLink(post)}
                    prefetch={false}
                    className={cn(
                      focus,
                      "group relative flex gap-3 rounded-xl py-3 pr-2 transition-colors hover:bg-muted/30",
                    )}
                  >
                    <div className="relative flex w-6 shrink-0 justify-center">
                      <span
                        className={cn(
                          "z-10 mt-0.5 flex size-5 items-center justify-center rounded-full border bg-card",
                          i === 0
                            ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-600"
                            : "border-border text-muted-foreground",
                        )}
                      >
                        <Clock3 className="size-3" />
                      </span>
                      {i < data.upcoming.length - 1 && (
                        <span
                          aria-hidden="true"
                          className="absolute bottom-[-14px] top-6 w-px bg-border"
                        />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p
                        className={cn(
                          "text-[11px] font-medium",
                          post.status === "publishing" || i === 0
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-muted-foreground",
                        )}
                      >
                        {homePostTime(post, data.fetched_at, timeZone)}
                      </p>
                      <p className="mt-0.5 line-clamp-2 break-words text-[13px] font-medium leading-5">
                        {homePostTitle(post)}
                      </p>
                      <div className="mt-1.5">
                        <Destination post={post} data={data} />
                      </div>
                    </div>
                    <ChevronRight className="mt-1 size-3.5 shrink-0 text-muted-foreground/40 transition-transform group-hover:translate-x-0.5" />
                  </Link>
                </li>
              ))}
            </ol>
          ) : (
            <EmptySection kind="upcoming" canEdit={data.can_edit} />
          )}
        </section>
        <section
          className={cn(panel, "min-w-0 p-5")}
          aria-label="Needs attention"
        >
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="font-heading text-[15px] font-semibold tracking-tight">
              Needs attention
            </h2>
            <span
              className={cn(
                "flex size-6 items-center justify-center rounded-full text-[11px] font-semibold tabular-nums",
                attention
                  ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                  : "bg-emerald-500/10 text-emerald-600",
              )}
            >
              {attention || <Check className="size-3.5" />}
            </span>
          </div>
          {attention ? (
            <div className="space-y-2">
              {reconnect.map((a) => (
                <Link
                  key={a.id}
                  href="/dashboard/channels"
                  className={cn(
                    focus,
                    "flex gap-3 rounded-xl border border-amber-500/15 bg-amber-500/[0.05] p-3 transition-colors hover:bg-amber-500/[0.09]",
                  )}
                >
                  <Unplug className="mt-0.5 size-4 shrink-0 text-amber-600" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium">
                      Reconnect your channel
                    </p>
                    <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                      {a.display_name}
                    </p>
                  </div>
                  <ArrowUpRight className="size-3.5 shrink-0 text-muted-foreground" />
                </Link>
              ))}
              {data.failed.map((post) => (
                <Link
                  key={post.variant_id}
                  href={homePostLink(post)}
                  prefetch={false}
                  className={cn(
                    focus,
                    "flex gap-3 rounded-xl border border-amber-500/15 bg-amber-500/[0.05] p-3 transition-colors hover:bg-amber-500/[0.09]",
                  )}
                >
                  <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-600" />
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-1 text-xs font-medium">
                      {homePostTitle(post)}
                    </p>
                    <p className="mt-0.5 line-clamp-2 break-words text-[11px] leading-5 text-muted-foreground">
                      {homeFailureMessage(post)}
                    </p>
                  </div>
                  <ArrowUpRight className="size-3.5 shrink-0 text-muted-foreground" />
                </Link>
              ))}
              {data.counts.failed > data.failed.length && (
                <p className="pt-1 text-[11px] leading-5 text-muted-foreground">
                  {data.counts.failed - data.failed.length} more{" "}
                  {data.counts.failed - data.failed.length === 1
                    ? "post needs"
                    : "posts need"}{" "}
                  review in Content.
                </p>
              )}
            </div>
          ) : (
            <div className="flex items-start gap-3 rounded-xl bg-emerald-500/[0.04] p-3">
              <CircleCheck className="mt-0.5 size-4 shrink-0 text-emerald-600" />
              <div>
                <p className="text-xs font-medium">You’re all caught up</p>
                <p className="mt-0.5 text-[11px] leading-5 text-muted-foreground">
                  No failed posts or channels waiting to reconnect.
                </p>
              </div>
            </div>
          )}
        </section>
        <HomeAnalyticsCard connected={hasConnectedAccounts} />
      </div>

      <p className="text-center text-[11px] leading-5 text-muted-foreground/70">
        {data.can_edit
          ? "Your workspace at a glance."
          : "You have view access to this workspace."}{" "}
        Post counts include each channel version. Updated{" "}
        {homeClock(data.fetched_at, timeZone)}.
      </p>
    </div>
  );
}
