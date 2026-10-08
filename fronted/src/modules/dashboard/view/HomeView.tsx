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

const panel = "rounded-2xl border border-border/80 bg-card shadow-xs";
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
  subtitle: string;
  href?: string;
  action?: string;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="font-heading text-base font-semibold tracking-tight">
          {title}
        </h2>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          {subtitle}
        </p>
      </div>
      {href && (
        <Button
          asChild
          variant="outline"
          className="secondary-btn dark:!bg-card dark:!bg-none dark:!text-foreground rounded-lg !text-xs"
        >
          <Link href={href} prefetch={false}>
            {action}
            <ArrowUpRight className="size-3.5" />
          </Link>
        </Button>
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
        "group flex min-w-0 flex-col p-4 transition-colors hover:border-emerald-500/40 hover:bg-emerald-500/[0.025]",
      )}
    >
      <Destination post={post} data={data} />
      <h3 className="mt-4 line-clamp-2 break-words text-sm font-medium leading-6">
        {homePostTitle(post)}
      </h3>
      <p className="mt-2 line-clamp-3 whitespace-pre-wrap break-words text-xs leading-6 text-muted-foreground">
        {post.text || "A blank page, ready for your next idea."}
      </p>
      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-5 text-[11px]">
        <span className="text-muted-foreground">
          Edited {homePostTime(post, data.fetched_at, timeZone)}
        </span>
        <span className="inline-flex items-center gap-1 font-medium text-emerald-700 dark:text-emerald-400">
          {data.can_edit ? "Continue" : "View draft"}
          <ArrowUpRight className="size-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
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
      title: "Room for your next idea",
      text: "Save a draft and it will be waiting here when inspiration comes back.",
      href: "/dashboard/content?new=1",
      action: "Start a draft",
    },
    upcoming: {
      icon: CalendarDays,
      title: "A little breathing room",
      text: "Your schedule is clear. Choose a time in the editor to plan your next post.",
      href: "/dashboard/content",
      action: "Choose a draft",
    },
    published: {
      icon: CheckCheck,
      title: "Your first post belongs here",
      text: "Posts published through Postflow will appear here as you share them.",
      href: "/dashboard/content",
      action: "Open content",
    },
  }[kind];
  return (
    <div className="flex min-h-48 flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/15 px-5 py-8 text-center">
      <settings.icon className="mb-3 size-6 text-muted-foreground/60" />
      <h3 className="text-sm font-medium">{settings.title}</h3>
      <p className="mt-2 max-w-xs text-xs leading-6 text-muted-foreground">
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
  const attention = data.counts.failed + reconnect.length;
  const steps = homeSetup(data);
  const showSetup = !steps.every((s) => s.done);
  const newPostHref = active[0]
    ? `/dashboard/content?${new URLSearchParams({ new: "1", account: active[0].id })}`
    : "/dashboard/content?new=1";
  const connectFirst = !active.length && data.can_manage_channels;
  return (
    <div
      data-slot="workspace-home"
      aria-busy={refreshing}
      className="@container/home mx-auto max-w-7xl space-y-6 px-5 pb-10 pt-6 sm:px-8 lg:px-10"
    >
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            {data.workspace_name}
          </p>
          <h1 className="font-heading text-3xl font-semibold tracking-tight">
            Home
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Your writing, your schedule, your next step.
          </p>
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
          className="rounded-xl border border-amber-500/25 bg-amber-500/5 px-4 py-3 text-xs leading-5"
        >
          We couldn’t refresh Home. Your last loaded overview is still shown.
          Try Refresh again.
        </p>
      )}
      <div className="grid gap-3 @xl/home:grid-cols-3">
        {[
          {
            label: "Drafts",
            value: data.counts.drafts,
            note: "Ideas ready to return to",
            icon: FilePenLine,
            color: "bg-violet-500/10 text-violet-500",
            href: "#continue-writing",
          },
          {
            label: "Scheduled",
            value: data.counts.scheduled,
            note: "Planned across your channels",
            icon: CalendarDays,
            color: "bg-sky-500/10 text-sky-500",
            href: "#upcoming-posts",
          },
          {
            label: "Published",
            value: data.counts.published_week,
            note: "Through Postflow · last 7 days",
            icon: CheckCheck,
            color: "bg-emerald-500/10 text-emerald-600",
            href: "#recently-published",
          },
        ].map((card) => (
          <Link
            key={card.label}
            href={card.href}
            className={cn(
              panel,
              focus,
              "group flex items-center justify-between gap-3 p-4 transition-colors hover:border-emerald-500/30 sm:p-5",
            )}
          >
            <div>
              <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <card.icon className="size-3.5" />
                {card.label}
              </p>
              <p className="mt-2 font-heading text-3xl font-semibold tabular-nums tracking-tight">
                {card.value.toLocaleString("en-US")}
              </p>
              <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
                {card.note}
              </p>
            </div>
            <span
              className={cn(
                "flex size-10 shrink-0 items-center justify-center rounded-xl",
                card.color,
              )}
            >
              <ArrowUpRight className="size-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </span>
          </Link>
        ))}
      </div>
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
                    "flex max-w-40 items-center gap-2 rounded-lg border border-border/60 bg-background/80 px-2.5 py-2 text-xs",
                  )}
                >
                  <PlatformMark platform={a.platform} />
                  <span className="truncate">{a.display_name}</span>
                </Link>
              ))}
              {active.length > 4 && (
                <Link
                  href="/dashboard/channels"
                  className="rounded-lg border border-border/60 px-2.5 py-2 text-xs"
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
      {showSetup && (
        <section aria-label="Getting started" className={cn(panel, "p-5")}>
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="font-heading text-sm font-semibold">
              Make yourself at home
            </h2>
            <span className="text-[11px] text-muted-foreground">
              {steps.filter((s) => s.done).length} of 3 complete
            </span>
          </div>
          <ol className="grid gap-3 sm:grid-cols-3">
            {steps.map((step, i) => (
              <li key={step.title}>
                <Link
                  href={step.href}
                  className={cn(
                    focus,
                    "group flex h-full items-start gap-3 rounded-xl border border-border/60 px-3 py-4 transition-colors hover:bg-muted/40",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-medium",
                      step.done
                        ? "bg-emerald-500/10 text-emerald-600"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    {step.done ? <Check className="size-3.5" /> : i + 1}
                  </span>
                  <div>
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
      <div className="grid items-start gap-7 @3xl/home:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-7">
          <section
            id="continue-writing"
            className="@container/drafts scroll-mt-5"
          >
            <SectionHeading
              title="Continue writing"
              subtitle="A few ideas worth coming back to."
              href="/dashboard/content"
              action="Open content"
            />
            {data.drafts.length ? (
              <div className="grid gap-3 @sm/drafts:grid-cols-2 @lg/drafts:grid-cols-3">
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
          <section id="recently-published" className="scroll-mt-5">
            <SectionHeading
              title="Recently published"
              subtitle="The latest posts you’ve shared through Postflow."
            />
            {data.published.length ? (
              <div className={cn(panel, "divide-y divide-border/70")}>
                {data.published.map((post) => (
                  <Link
                    key={post.variant_id}
                    href={homePostLink(post)}
                    prefetch={false}
                    className={cn(
                      focus,
                      "group flex items-start gap-3 p-4 transition-colors first:rounded-t-2xl last:rounded-b-2xl hover:bg-muted/30",
                    )}
                  >
                    <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10">
                      <CheckCheck className="size-4 text-emerald-600" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 break-words text-xs font-medium leading-6">
                        {homePostTitle(post)}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                        <Destination post={post} data={data} />
                        <span className="text-[11px] text-muted-foreground">
                          {homePostTime(post, data.fetched_at, timeZone)}
                        </span>
                      </div>
                    </div>
                    <ArrowUpRight className="mt-1 size-3.5 shrink-0 text-muted-foreground" />
                  </Link>
                ))}
              </div>
            ) : (
              <EmptySection kind="published" canEdit={data.can_edit} />
            )}
          </section>
        </div>
        <div className="min-w-0 space-y-6">
          <section id="upcoming-posts" className={cn(panel, "scroll-mt-5 p-5")}>
            <SectionHeading
              title="Coming up next"
              subtitle={`Across your channels · ${timeZone.replaceAll("_", " ")}`}
              href="/dashboard/schedule"
              action="Schedule"
            />
            {data.upcoming.length ? (
              <ol className="space-y-1">
                {data.upcoming.map((post, i) => (
                  <li key={post.variant_id}>
                    <Link
                      href={homePostLink(post)}
                      prefetch={false}
                      className={cn(
                        focus,
                        "group flex gap-3 rounded-xl py-3 pr-2 transition-colors hover:bg-muted/30",
                      )}
                    >
                      <div className="relative flex w-6 shrink-0 justify-center">
                        <span
                          className={cn(
                            "z-10 mt-1 flex size-5 items-center justify-center rounded-full border bg-card",
                            i === 0
                              ? "border-emerald-500/40 text-emerald-600"
                              : "border-border text-muted-foreground",
                          )}
                        >
                          <Clock3 className="size-3" />
                        </span>
                        {i < data.upcoming.length - 1 && (
                          <span
                            aria-hidden="true"
                            className="absolute bottom-[-18px] top-6 w-px bg-border"
                          />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p
                          className={cn(
                            "text-[11px] font-medium",
                            post.status === "publishing"
                              ? "text-emerald-600"
                              : "text-muted-foreground",
                          )}
                        >
                          {homePostTime(post, data.fetched_at, timeZone)}
                        </p>
                        <p className="mt-1 line-clamp-2 break-words text-xs font-medium leading-6">
                          {homePostTitle(post)}
                        </p>
                        <div className="mt-2">
                          <Destination post={post} data={data} />
                        </div>
                      </div>
                      <ChevronRight className="mt-1 size-3.5 shrink-0 text-muted-foreground/60" />
                    </Link>
                  </li>
                ))}
              </ol>
            ) : (
              <EmptySection kind="upcoming" canEdit={data.can_edit} />
            )}
          </section>
          <section className={cn(panel, "p-5")} aria-label="Needs attention">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="font-heading text-sm font-semibold">
                Needs attention
              </h2>
              <span
                className={cn(
                  "flex size-6 items-center justify-center rounded-full text-[11px] font-medium",
                  attention
                    ? "bg-amber-500/10 text-amber-700 dark:text-amber-400"
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
                      "flex gap-3 rounded-xl bg-amber-500/[0.055] p-3",
                    )}
                  >
                    <Unplug className="mt-0.5 size-4 shrink-0 text-amber-600" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium">
                        Reconnect your channel
                      </p>
                      <p className="mt-1 truncate text-[11px] text-muted-foreground">
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
                      "flex gap-3 rounded-xl bg-amber-500/[0.055] p-3",
                    )}
                  >
                    <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-600" />
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-1 text-xs font-medium">
                        {homePostTitle(post)}
                      </p>
                      <p className="mt-1 line-clamp-2 break-words text-[11px] leading-5 text-muted-foreground">
                        {homeFailureMessage(post)}
                      </p>
                    </div>
                    <ArrowUpRight className="size-3.5 shrink-0 text-muted-foreground" />
                  </Link>
                ))}
                {data.counts.failed > data.failed.length && (
                  <p className="pt-2 text-[11px] leading-5 text-muted-foreground">
                    {data.counts.failed - data.failed.length} more{" "}
                    {data.counts.failed - data.failed.length === 1
                      ? "post needs"
                      : "posts need"}{" "}
                    review in Content.
                  </p>
                )}
              </div>
            ) : (
              <div className="flex items-start gap-3 py-2">
                <CircleCheck className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                <div>
                  <p className="text-xs font-medium">You’re all caught up</p>
                  <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
                    No failed posts or channels waiting to reconnect.
                  </p>
                </div>
              </div>
            )}
          </section>
          <Link
            href="/dashboard/analytics"
            className={cn(
              focus,
              "group flex items-center gap-3 rounded-xl px-1 py-2",
            )}
          >
            <span className="flex size-9 items-center justify-center rounded-xl bg-violet-500/10">
              <Layers3 className="size-4 text-violet-500" />
            </span>
            <div className="flex-1">
              <p className="text-xs font-medium">
                See how your posts are doing
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Explore your account performance in Analytics.
              </p>
            </div>
            <ArrowUpRight className="size-4 text-muted-foreground" />
          </Link>
        </div>
      </div>
      <p className="text-center text-[10px] leading-5 text-muted-foreground/70">
        {data.can_edit
          ? "Your workspace at a glance"
          : "You have view access to this workspace"}{" "}
        · Post counts include each channel version · Updated{" "}
        {homeClock(data.fetched_at, timeZone)}
      </p>
    </div>
  );
}
