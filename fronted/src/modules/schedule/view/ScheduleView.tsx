"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  Suspense,
  type ReactNode,
} from "react";
import {
  useMutation,
  useQueryClient,
  useSuspenseInfiniteQuery,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import {
  CalendarClock,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Send,
  SlidersHorizontal,
  TriangleAlert,
  Undo2,
} from "lucide-react";
import { toast } from "sonner";
import { useTRPC } from "@/trpc/client";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import AccountAvatar from "@/modules/channels/component/AccountAvatar";
import type { Account } from "@/modules/studio/types";
import { draftText, profileFor } from "@/modules/content/studio/model";
import { PlatformMark } from "@/modules/content/studio/AccountSwitcher";
import { cn } from "@/lib/utils";
import {
  calendarRange,
  calendarTime,
  dateKey,
  layoutDay,
  localDateTime,
  moveCalendar,
  scheduleInstant,
  utcDate,
  type CalendarEntry,
  type CalendarView,
} from "../calendarModel";
import ScheduleSkeleton from "../component/ScheduleSkeleton";

/* -------------------------------------------------------------------------- */
/*  Constants & helpers                                                       */
/* -------------------------------------------------------------------------- */

const subscribe = () => () => {};
const HOUR_HEIGHT = 84;
const SLOT_HEIGHT = HOUR_HEIGHT / 2;

const line = (alpha: number) =>
  `color-mix(in srgb, var(--border) ${alpha}%, transparent)`;
// Clean hour lines, with a fainter marker on every half hour.
const gridLines = [
  `repeating-linear-gradient(to bottom, ${line(55)} 0 1px, transparent 1px ${HOUR_HEIGHT}px)`,
  `repeating-linear-gradient(to bottom, transparent 0 ${SLOT_HEIGHT}px, ${line(22)} ${SLOT_HEIGHT}px ${SLOT_HEIGHT + 1}px, transparent ${SLOT_HEIGHT + 1}px ${HOUR_HEIGHT}px)`,
].join(", ");

const statusNames: Record<string, string> = {
  scheduled: "Scheduled",
  publishing: "Publishing",
  published: "Published",
  failed: "Failed",
};
const statusDot: Record<string, string> = {
  scheduled: "bg-amber-500",
  publishing: "bg-amber-500",
  published: "bg-emerald-500",
  failed: "bg-rose-500",
};
const statusTone: Record<string, string> = {
  scheduled: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  publishing: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  published: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  failed: "bg-rose-500/10 text-rose-700 dark:text-rose-400",
};
const statusOptions = [
  { value: "all", label: "All statuses", dot: "bg-muted-foreground/40" },
  { value: "scheduled", label: "Queue", dot: "bg-amber-500" },
  { value: "published", label: "Published", dot: "bg-emerald-500" },
  { value: "failed", label: "Failed", dot: "bg-rose-500" },
];
const platformSwatch: Record<string, string> = {
  x: "bg-foreground",
  twitter: "bg-foreground",
  facebook: "bg-blue-500",
  instagram: "bg-fuchsia-500",
  linkedin: "bg-sky-600",
  mastodon: "bg-indigo-500",
  bluesky: "bg-sky-400",
  reddit: "bg-orange-500",
};
const swatch = (platform: string) =>
  platformSwatch[platform] ?? "bg-muted-foreground";
const inlinePlatforms = ["x", "twitter", "bluesky", "mastodon"];

const pillClass =
  "inline-flex h-8 items-center gap-2 rounded-full border border-border/60 bg-background px-3 text-xs font-medium outline-none transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring/50 data-[popup-open]:bg-muted/70 data-[state=open]:bg-muted/70";

type DialogAction = "reschedule" | "publish" | "cancel";
type SelectEntry = (entry: CalendarEntry, action?: DialogAction) => void;

const pad = (n: number) => String(n).padStart(2, "0");
const editorHref = (variant: CalendarEntry["variant"]) =>
  `/dashboard/content?post=${variant.post_id}&variant=${variant.id}`;

// The editor can read `schedule` to pre-fill the time. Ignored if unsupported.
function newPostHref(at?: Date) {
  return at
    ? `/dashboard/content?new=1&schedule=${encodeURIComponent(localDateTime(at))}`
    : "/dashboard/content?new=1";
}

// Default slot for "+ Schedule" on a month cell: 9:00, or the next full hour today.
function defaultSlot(day: Date) {
  const now = new Date();
  const slot = new Date(day);
  slot.setHours(9, 0, 0, 0);
  if (slot.getTime() < now.getTime()) {
    if (dateKey(day) !== dateKey(now)) return null;
    slot.setTime(now.getTime());
    slot.setHours(now.getHours() + 1, 0, 0, 0);
    if (dateKey(slot) !== dateKey(day)) return null;
  }
  return slot;
}

// Defensive read of optional thread/media info. Adjust to your payload shape.
function postExtras(payload: unknown) {
  const p = (payload ?? {}) as Record<string, unknown>;
  const thread = [p.thread, p.posts, p.tweets, p.items].find(Array.isArray) as
    | unknown[]
    | undefined;
  const media = (Array.isArray(p.media) ? p.media : []) as Record<
    string,
    unknown
  >[];
  const url = media[0]?.thumbnail_url ?? media[0]?.url ?? media[0]?.src;
  return {
    threadCount: thread && thread.length > 1 ? thread.length : 0,
    mediaUrl: typeof url === "string" ? url : undefined,
    mediaCount: media.length,
  };
}







const CARD_HEIGHT = (HOUR_HEIGHT * 100) / 60 - 6;
const CLUSTER_MINUTES = 100; // posts closer than this share one stack

// Groups posts whose cards would overlap into a single stack.
function clusterDay(entries: CalendarEntry[]) {
  const items = entries
    .map((entry) => {
      const d = utcDate(entry.time);
      return { entry, at: d.getTime(), minute: d.getHours() * 60 + d.getMinutes() };
    })
    .sort((a, b) => a.at - b.at);
  const clusters: { minute: number; entries: CalendarEntry[] }[] = [];
  for (const item of items) {
    const last = clusters[clusters.length - 1];
    if (last && item.minute - last.minute < CLUSTER_MINUTES)
      last.entries.push(item.entry);
    else clusters.push({ minute: item.minute, entries: [item.entry] });
  }
  return clusters;
}















function useMediaQuery(query: string) {
  const subscribeQuery = useCallback(
    (callback: () => void) => {
      const media = window.matchMedia(query);
      media.addEventListener("change", callback);
      return () => media.removeEventListener("change", callback);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribeQuery,
    () => window.matchMedia(query).matches,
    () => false,
  );
}

function useNow(interval = 60_000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), interval);
    return () => clearInterval(id);
  }, [interval]);
  return now;
}

/* -------------------------------------------------------------------------- */
/*  Small shared pieces                                                       */
/* -------------------------------------------------------------------------- */

function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  fill = false,
  className,
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: ReactNode; disabled?: boolean }[];
  label: string;
  fill?: boolean;
  className?: string;
}) {
  const id = useId();
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn(
        "relative inline-flex items-center rounded-lg bg-muted/60 p-0.5",
        fill && "flex w-full",
        className,
      )}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={option.disabled}
            onClick={() => onChange(option.value)}
            className={cn(
              "relative z-0 inline-flex h-7 items-center justify-center gap-1.5 rounded-md px-3 text-xs font-medium text-muted-foreground outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-40",
              fill && "flex-1 px-2",
              active && "text-foreground",
            )}
          >
            {active && (
              <motion.span
                layoutId={`${id}-pill`}
                className="absolute inset-0 -z-10 rounded-md bg-background shadow-xs ring-1 ring-border/60"
                transition={{ type: "spring", stiffness: 500, damping: 38 }}
              />
            )}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function OptionRow({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs outline-none transition-colors hover:bg-muted focus-visible:bg-muted",
        selected && "bg-muted/60 font-medium",
      )}
    >
      {children}
      <Check
        className={cn(
          "ml-auto size-3.5 shrink-0",
          selected ? "opacity-100" : "opacity-0",
        )}
      />
    </button>
  );
}

function StatusPill({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium",
        statusTone[status],
      )}
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          statusDot[status],
          status === "publishing" && "animate-pulse",
        )}
      />
      {statusNames[status] ?? status}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/*  Entry                                                                     */
/* -------------------------------------------------------------------------- */

export default function ScheduleView() {
  const hydrated = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  if (!hydrated) {
    return <ScheduleSkeleton />;
  }
  return (
    <Suspense fallback={<ScheduleSkeleton />}>
      <CalendarWorkspace />
    </Suspense>
  );
}

/* -------------------------------------------------------------------------- */
/*  Workspace + command bar                                                   */
/* -------------------------------------------------------------------------- */

function CalendarWorkspace() {
  const trpc = useTRPC();
  const isMobile = useMediaQuery("(max-width: 767px)");
  const [date, setDate] = useState(() => new Date());
  const [view, setView] = useState<CalendarView>(() =>
    typeof window !== "undefined" &&
    window.matchMedia("(max-width: 640px)").matches
      ? "day"
      : "week",
  );
  const [accountFilter, setAccountFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selected, setSelected] = useState<{
    entry: CalendarEntry;
    action?: DialogAction;
  } | null>(null);
  const accounts = useSuspenseQuery(trpc.studio.accounts.queryOptions());
  const range = calendarRange(date, view);
  const calendar = useSuspenseInfiniteQuery(
    trpc.studio.calendar.infiniteQueryOptions(
      { start: range.start.toISOString(), end: range.end.toISOString() },
      {
        getNextPageParam: (page) => page.next_cursor ?? undefined,
        refetchInterval: 15000,
      },
    ),
  );
  const entries = calendar.data?.pages.flatMap((page) => page.items) ?? [];
  const visible = entries.filter(
    (entry) =>
      (accountFilter === "all" ||
        entry.variant.connected_account_id === accountFilter) &&
      (statusFilter === "all" ||
        entry.variant.status === statusFilter ||
        (statusFilter === "scheduled" &&
          entry.variant.status === "publishing")),
  );
  const currentSelected = selected
    ? (entries.find((entry) => entry.variant.id === selected.entry.variant.id) ??
      selected.entry)
    : null;
  const select: SelectEntry = (entry, action) => setSelected({ entry, action });
  const label =
    view === "month"
      ? date.toLocaleDateString(undefined, { month: "long", year: "numeric" })
      : view === "day"
        ? date.toLocaleDateString(undefined, {
            month: "long",
            day: "numeric",
            year: "numeric",
          })
        : `${range.start.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${range.days[6].toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`;

  return (
    <MotionConfig reducedMotion="user">
      <div className="flex h-full min-h-0 flex-col font-content">
        <header className="shrink-0 border-b border-border/60">
          <div className="flex items-center justify-between gap-3 px-4 pt-4 sm:px-6">
            <div className="min-w-0">
              <h1 className="text-xl font-semibold tracking-tight">Schedule</h1>
              <p className="mt-0.5 hidden text-xs text-muted-foreground sm:block">
                Plan your posts across every connected account.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <StatusCluster
                count={visible.length}
                hasMore={Boolean(calendar.hasNextPage)}
                fetching={calendar.isFetching}
                onRefresh={() => void calendar.refetch()}
              />
              <Button asChild className="primary-btn rounded-xl">
                <Link href={newPostHref()}>
                  <Plus className="size-4" />
                  New post
                </Link>
              </Button>
            </div>
          </div>
          <CommandBar
            date={date}
            view={view}
            label={label}
            isMobile={isMobile}
            accounts={accounts.data ?? []}
            accountFilter={accountFilter}
            statusFilter={statusFilter}
            onDate={setDate}
            onView={setView}
            onAccount={setAccountFilter}
            onStatus={setStatusFilter}
          />
        </header>
        {calendar.error || accounts.error ? (
          <div
            role="alert"
            className="m-6 rounded-xl border border-destructive/20 p-5 text-sm"
          >
            <p>{calendar.error?.message ?? accounts.error?.message}</p>
            <Button
              variant="outline"
              className="mt-3"
              onClick={() => {
                void calendar.refetch();
                void accounts.refetch();
              }}
            >
              Try again
            </Button>
          </div>
        ) : (
          <>
            {!visible.length && (
              <p className="mx-4 mt-3 text-xs text-muted-foreground sm:mx-6">
                {entries.length
                  ? "No posts match these filters."
                  : "No posts in this period. Schedule a post from the editor to add it here."}
              </p>
            )}
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={view}
                className="flex min-h-0 flex-1 flex-col"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.16, ease: "easeOut" }}
              >
                {view === "month" ? (
                  <MonthCalendar
                    date={date}
                    days={range.days}
                    entries={visible}
                    accounts={accounts.data ?? []}
                    mobile={isMobile}
                    onSelect={select}
                    onDay={(day) => {
                      setDate(day);
                      setView("day");
                    }}
                  />
                ) : (
                  <TimeCalendar
                    days={range.days}
                    entries={visible}
                    accounts={accounts.data ?? []}
                    onSelect={select}
                  />
                )}
              </motion.div>
            </AnimatePresence>
            {calendar.hasNextPage && (
              <div className="shrink-0 border-t border-border/60 p-3 text-center">
                <Button
                  variant="outline"
                  disabled={calendar.isFetchingNextPage}
                  onClick={() => void calendar.fetchNextPage()}
                >
                  {calendar.isFetchingNextPage
                    ? "Loading…"
                    : "Load more posts in this period"}
                </Button>
              </div>
            )}
          </>
        )}
        {currentSelected && (
          <CalendarPostDialog
            key={currentSelected.variant.id}
            entry={currentSelected}
            initialAction={selected?.action}
            account={accounts.data?.find(
              (account) =>
                account.id === currentSelected.variant.connected_account_id,
            )}
            onClose={() => setSelected(null)}
          />
        )}
      </div>
    </MotionConfig>
  );
}

function StatusCluster({
  count,
  hasMore,
  fetching,
  onRefresh,
}: {
  count: number;
  hasMore: boolean;
  fetching: boolean;
  onRefresh: () => void;
}) {
  return (
    <div className="flex h-9 items-center gap-1 rounded-xl border border-border/60 bg-background pl-3 pr-1">
      <span
        className="flex items-center gap-1.5 text-xs text-muted-foreground"
        title="Updates every 15 seconds"
      >
        <span className="relative flex size-1.5">
          <span
            className={cn(
              "absolute inline-flex size-full rounded-full bg-emerald-500/60 motion-reduce:animate-none",
              !fetching && "animate-ping",
            )}
          />
          <span className="relative inline-flex size-1.5 rounded-full bg-emerald-500" />
        </span>
        <span className="tabular-nums">
          {count} {count === 1 ? "post" : "posts"}
          {hasMore ? " loaded" : ""}
        </span>
      </span>
      <Button
        variant="ghost"
        size="icon-sm"
        className="size-7"
        aria-label="Refresh calendar"
        disabled={fetching}
        onClick={onRefresh}
      >
        <RefreshCw className={cn("size-3.5", fetching && "animate-spin")} />
      </Button>
    </div>
  );
}

function FilterPill({
  ariaLabel,
  icon,
  label,
  active,
  contentClassName,
  children,
}: {
  ariaLabel: string;
  icon: ReactNode;
  label: ReactNode;
  active?: boolean;
  contentClassName?: string;
  children: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button
            type="button"
            aria-label={ariaLabel}
            className={cn(pillClass, active && "border-foreground/25")}
          >
            {icon}
            <span className="max-w-32 truncate">{label}</span>
            <ChevronDown className="size-3 text-muted-foreground" />
          </button>
        }
      />
      <PopoverContent
        align="start"
        className={cn("w-64 p-1", contentClassName)}
      >
        {children(() => setOpen(false))}
      </PopoverContent>
    </Popover>
  );
}

function AccountOptions({
  accounts,
  value,
  onChange,
}: {
  accounts: Account[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-0.5">
      <OptionRow selected={value === "all"} onClick={() => onChange("all")}>
        <span className="flex -space-x-1.5">
          {accounts.slice(0, 3).map((account) => (
            <AccountAvatar
              key={account.id}
              account={account}
              className="size-5 rounded-md text-[8px] ring-2 ring-popover [&_img]:rounded-md"
            />
          ))}
        </span>
        All accounts
      </OptionRow>
      {accounts.map((account) => (
        <OptionRow
          key={account.id}
          selected={value === account.id}
          onClick={() => onChange(account.id)}
        >
          <AccountAvatar
            account={account}
            className="size-5 rounded-md text-[8px] [&_img]:rounded-md"
          />
          <span className="min-w-0 flex-1 truncate">
            {account.display_name}
          </span>
          <span className="flex shrink-0 items-center gap-1.5 text-muted-foreground">
            <span
              className={cn("size-1.5 rounded-full", swatch(account.platform))}
            />
            {profileFor(account.platform).name}
          </span>
        </OptionRow>
      ))}
    </div>
  );
}

function StatusOptions({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-0.5">
      {statusOptions.map((option) => (
        <OptionRow
          key={option.value}
          selected={value === option.value}
          onClick={() => onChange(option.value)}
        >
          <span className={cn("size-2 rounded-full", option.dot)} />
          {option.label}
        </OptionRow>
      ))}
    </div>
  );
}

function DateJump({
  date,
  label,
  onPick,
}: {
  date: Date;
  label: string;
  onPick: (date: Date) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button
            type="button"
            aria-label="Jump to date"
            className="inline-flex h-8 items-center gap-2 rounded-lg px-2.5 text-sm font-medium outline-none transition-colors hover:bg-muted/70 focus-visible:ring-2 focus-visible:ring-ring/50 data-[popup-open]:bg-muted/70 data-[state=open]:bg-muted/70"
          >
            <CalendarDays className="size-3.5 text-muted-foreground" />
            {label}
          </button>
        }
      />
      <PopoverContent align="start" className="w-auto p-0">
        <Calendar
          mode="single"
          selected={date}
          defaultMonth={date}
          onSelect={(picked) => {
            if (!picked) return;
            onPick(
              new Date(
                picked.getFullYear(),
                picked.getMonth(),
                picked.getDate(),
                12,
              ),
            );
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

function CommandBar({
  date,
  view,
  label,
  isMobile,
  accounts,
  accountFilter,
  statusFilter,
  onDate,
  onView,
  onAccount,
  onStatus,
}: {
  date: Date;
  view: CalendarView;
  label: string;
  isMobile: boolean;
  accounts: Account[];
  accountFilter: string;
  statusFilter: string;
  onDate: (date: Date) => void;
  onView: (view: CalendarView) => void;
  onAccount: (value: string) => void;
  onStatus: (value: string) => void;
}) {
  const selectedAccount = accounts.find(
    (account) => account.id === accountFilter,
  );
  const status = statusOptions.find((option) => option.value === statusFilter);
  const activeCount =
    Number(accountFilter !== "all") + Number(statusFilter !== "all");
  return (
    <div className="flex flex-wrap items-center gap-2 px-4 py-3 sm:px-6">
      <div className="inline-flex items-center rounded-lg border border-border/60 bg-background p-0.5">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 rounded-md px-2.5 text-xs"
          onClick={() => onDate(new Date())}
        >
          Today
        </Button>
        <span className="mx-0.5 h-4 w-px bg-border/60" />
        <Button
          variant="ghost"
          size="icon-sm"
          className="size-7"
          aria-label="Previous period"
          onClick={() => onDate(moveCalendar(date, view, -1))}
        >
          <ChevronLeft />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          className="size-7"
          aria-label="Next period"
          onClick={() => onDate(moveCalendar(date, view, 1))}
        >
          <ChevronRight />
        </Button>
      </div>
      <DateJump date={date} label={label} onPick={onDate} />
      <Segmented
        label="Calendar view"
        value={view}
        onChange={onView}
        className="ml-auto"
        options={[
          { value: "day", label: "Day" },
          { value: "week", label: "Week" },
          { value: "month", label: "Month" },
        ]}
      />
      <span className="hidden h-5 w-px bg-border/60 md:block" />
      {isMobile ? (
        <FilterPill
          ariaLabel="Open filters"
          icon={<SlidersHorizontal className="size-3.5" />}
          label={
            <>
              Filters
              {activeCount > 0 && (
                <span className="ml-1.5 rounded-full bg-foreground px-1.5 text-[10px] text-background">
                  {activeCount}
                </span>
              )}
            </>
          }
          active={activeCount > 0}
          contentClassName="max-h-[70svh] w-[min(20rem,calc(100vw-2rem))] overflow-y-auto p-2"
        >
          {() => (
            <div className="space-y-3">
              <div>
                <p className="px-2 pb-1 text-xs font-medium text-muted-foreground">
                  Account
                </p>
                <AccountOptions
                  accounts={accounts}
                  value={accountFilter}
                  onChange={onAccount}
                />
              </div>
              <div>
                <p className="px-2 pb-1 text-xs font-medium text-muted-foreground">
                  Status
                </p>
                <StatusOptions value={statusFilter} onChange={onStatus} />
              </div>
            </div>
          )}
        </FilterPill>
      ) : (
        <>
          <FilterPill
            ariaLabel="Filter calendar by account"
            active={accountFilter !== "all"}
            icon={
              selectedAccount ? (
                <AccountAvatar
                  account={selectedAccount}
                  className="size-4 rounded-md text-[8px] [&_img]:rounded-md"
                />
              ) : (
                <span className="flex -space-x-1.5">
                  {accounts.slice(0, 3).map((account) => (
                    <AccountAvatar
                      key={account.id}
                      account={account}
                      className="size-4 rounded-md text-[8px] ring-2 ring-background [&_img]:rounded-md"
                    />
                  ))}
                </span>
              )
            }
            label={selectedAccount?.display_name ?? "All accounts"}
          >
            {(close) => (
              <AccountOptions
                accounts={accounts}
                value={accountFilter}
                onChange={(value) => {
                  onAccount(value);
                  close();
                }}
              />
            )}
          </FilterPill>
          <FilterPill
            ariaLabel="Filter calendar by status"
            active={statusFilter !== "all"}
            icon={
              <span className={cn("size-2 rounded-full", status?.dot)} />
            }
            label={status?.label}
            contentClassName="w-44"
          >
            {(close) => (
              <StatusOptions
                value={statusFilter}
                onChange={(value) => {
                  onStatus(value);
                  close();
                }}
              />
            )}
          </FilterPill>
        </>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Cards                                                                     */
/* -------------------------------------------------------------------------- */

export function CalendarCard({
  entry,
  account,
  dense = false,
  onSelect,
}: {
  entry: CalendarEntry;
  account?: Account;
  dense?: boolean;
  onSelect: SelectEntry;
}) {
  const { variant } = entry;
  const text = draftText(variant.payload, variant.platform) || entry.post_title;
  const name = account?.display_name ?? "Disconnected account";
  const platform = profileFor(variant.platform).name;
  const time = calendarTime(entry.time);
  const status = statusNames[variant.status] ?? variant.status;
  const queued = variant.status === "scheduled";
  const { threadCount, mediaUrl } = postExtras(variant.payload);
  const actionClass =
    "size-6 rounded-md text-muted-foreground hover:text-foreground";
  return (
    <div
      data-calendar-card
      className={cn(
        "group relative flex h-full min-w-0 flex-col justify-between gap-2 overflow-hidden rounded-xl border border-border/60 bg-background/90 p-2.5 shadow-xs backdrop-blur-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-foreground/20 hover:shadow-md",
        variant.status === "failed" && "border-rose-500/30",
      )}
    >
      <button
        type="button"
        onClick={() => onSelect(entry)}
        aria-label={`${status} ${platform} post by ${name} at ${time}: ${text.slice(0, 80)}`}
        className="absolute inset-0 z-0 rounded-[inherit] outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
      />
      <div className="pointer-events-none relative flex min-w-0 items-center gap-2">
        <span className="relative shrink-0">
          <AccountAvatar
            account={account}
            className="size-6 rounded-md text-[9px] [&_img]:rounded-md"
          />
          <span className="absolute -bottom-1 -right-1 grid place-items-center rounded-[5px] bg-background p-px ring-1 ring-border/60">
            <PlatformMark
              platform={variant.platform}
              className="!size-3 !text-[9px]"
            />
          </span>
        </span>
        {!dense && (
          <span className="min-w-0 flex-1 truncate text-xs font-medium">
            {name}
          </span>
        )}
        <span
          role="img"
          aria-label={status}
          title={status}
          className={cn(
            "ml-auto size-1.5 shrink-0 rounded-full",
            statusDot[variant.status],
            variant.status === "publishing" && "animate-pulse",
          )}
        />
      </div>
      <div className="pointer-events-none relative flex min-h-0 flex-1 gap-2">
        <p
          className={cn(
            "min-w-0 flex-1 break-words text-[13px] leading-snug text-foreground/90",
            dense ? "line-clamp-4" : "line-clamp-3",
          )}
        >
          {text}
        </p>
        {mediaUrl && !dense && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={mediaUrl}
            alt=""
            className="size-11 shrink-0 rounded-md border border-border/60 object-cover"
          />
        )}
      </div>
      <div className="relative flex h-6 items-center justify-between gap-1">
        <span className="pointer-events-none inline-flex items-center gap-1 rounded-md bg-muted/70 px-1.5 py-0.5 text-[11px] tabular-nums text-muted-foreground">
          <Clock3 className="size-3 shrink-0" />
          <time
            dateTime={utcDate(entry.time).toISOString()}
            title={utcDate(entry.time).toLocaleString()}
            className="truncate"
          >
            {time}
          </time>
        </span>
        {threadCount > 0 && !dense && (
          <span className="pointer-events-none rounded-md border border-border/60 px-1.5 py-0.5 text-[10px] text-muted-foreground">
            Thread #1 of {threadCount}
          </span>
        )}
        {!dense && (
          <div className="pointer-events-none absolute inset-y-0 right-0 z-10 flex items-center gap-0.5 bg-background pl-1 opacity-0 transition-opacity group-focus-within:pointer-events-auto group-focus-within:opacity-100 group-hover:pointer-events-auto group-hover:opacity-100">
            <Button
              asChild
              variant="ghost"
              size="icon-xs"
              className={actionClass}
              aria-label="Edit post"
              title="Edit post"
            >
              <Link href={editorHref(variant)}>
                <Pencil className="size-3" />
              </Link>
            </Button>
            {queued && (
              <>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className={actionClass}
                  aria-label="Reschedule post"
                  title="Reschedule"
                  onClick={() => onSelect(entry, "reschedule")}
                >
                  <CalendarClock className="size-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className={actionClass}
                  aria-label="Move post to drafts"
                  title="Move to drafts"
                  onClick={() => onSelect(entry, "cancel")}
                >
                  <Undo2 className="size-3" />
                </Button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function CalendarChip({
  entry,
  account,
  onSelect,
}: {
  entry: CalendarEntry;
  account?: Account;
  onSelect: SelectEntry;
}) {
  const { variant } = entry;
  const text = draftText(variant.payload, variant.platform) || entry.post_title;
  const time = calendarTime(entry.time);
  const status = statusNames[variant.status] ?? variant.status;
  return (
    <button
      type="button"
      onClick={() => onSelect(entry)}
      aria-label={`${status} ${profileFor(variant.platform).name} post by ${account?.display_name ?? "disconnected account"} at ${time}: ${text.slice(0, 80)}`}
      className="flex w-full min-w-0 items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-[11px] leading-none outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50"
    >
      <span
        className={cn(
          "size-1.5 shrink-0 rounded-full",
          statusDot[variant.status],
        )}
      />
      <span className="shrink-0 tabular-nums text-muted-foreground">{time}</span>
      <span className="min-w-0 flex-1 truncate">{text}</span>
    </button>
  );
}




function CalendarRow({
  entry,
  account,
  roomy,
  onSelect,
}: {
  entry: CalendarEntry;
  account?: Account;
  roomy: boolean;
  onSelect: SelectEntry;
}) {
  const { variant } = entry;
  const text = draftText(variant.payload, variant.platform) || entry.post_title;
  const time = calendarTime(entry.time);
  const status = statusNames[variant.status] ?? variant.status;
  const name = account?.display_name ?? "Disconnected account";
  return (
    <button
      type="button"
      data-calendar-card
      onClick={() => onSelect(entry)}
      aria-label={`${status} ${profileFor(variant.platform).name} post by ${name} at ${time}: ${text.slice(0, 80)}`}
      className={cn(
        "flex h-full w-full min-w-0 items-center gap-2 overflow-hidden rounded-xl border border-border/60 bg-background/90 px-2 text-left shadow-xs outline-none backdrop-blur-sm transition-all duration-200 hover:-translate-y-px hover:border-foreground/20 hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring/60",
        variant.status === "failed" && "border-rose-500/30",
      )}
    >
      <span className="relative shrink-0">
        <AccountAvatar
          account={account}
          className="size-6 rounded-md text-[9px] [&_img]:rounded-md"
        />
        <span className="absolute -bottom-1 -right-1 grid place-items-center rounded-[5px] bg-background p-px ring-1 ring-border/60">
          <PlatformMark
            platform={variant.platform}
            className="!size-3 !text-[9px]"
          />
        </span>
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex items-center gap-1.5 text-[11px] tabular-nums text-muted-foreground">
          <span
            role="img"
            aria-label={status}
            title={status}
            className={cn(
              "size-1.5 shrink-0 rounded-full",
              statusDot[variant.status],
              variant.status === "publishing" && "animate-pulse",
            )}
          />
          <time
            dateTime={utcDate(entry.time).toISOString()}
            title={utcDate(entry.time).toLocaleString()}
          >
            {time}
          </time>
        </span>
        <span
          className={cn(
            "break-words text-xs leading-snug text-foreground/90",
            roomy ? "line-clamp-2" : "truncate",
          )}
        >
          {text}
        </span>
      </span>
    </button>
  );
}

const STACK_MAX = 3;

function CalendarStack({
  day,
  entries,
  accounts,
  onSelect,
}: {
  day: Date;
  entries: CalendarEntry[];
  accounts: Account[];
  onSelect: SelectEntry;
}) {
  const overflow = entries.length > STACK_MAX;
  const shown = overflow ? entries.slice(0, STACK_MAX - 1) : entries;
  return (
    <div className="flex h-full flex-col gap-1">
      {shown.map((entry) => (
        <div key={entry.variant.id} className="min-h-0 flex-1">
          <CalendarRow
            entry={entry}
            roomy={shown.length < 3}
            account={accounts.find(
              (account) => account.id === entry.variant.connected_account_id,
            )}
            onSelect={onSelect}
          />
        </div>
      ))}
      {overflow && (
        <div className="shrink-0 rounded-lg border border-dashed border-border/60 bg-background/70">
          <DayOverflow
            day={day}
            entries={entries}
            extra={entries.length - shown.length}
            accounts={accounts}
            onSelect={onSelect}
          />
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Month grid                                                                */
/* -------------------------------------------------------------------------- */

function DayOverflow({
  day,
  entries,
  extra,
  accounts,
  onSelect,
}: {
  day: Date;
  entries: CalendarEntry[];
  extra: number;
  accounts: Account[];
  onSelect: SelectEntry;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button
            type="button"
            className="w-full rounded-md px-1.5 py-1 text-left text-[11px] font-medium text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            +{extra} more
          </button>
        }
      />
      <PopoverContent align="start" className="w-80 p-2">
        <p className="px-1 pb-2 text-xs font-medium">
          {day.toLocaleDateString(undefined, {
            weekday: "long",
            month: "short",
            day: "numeric",
          })}
          <span className="ml-2 font-normal text-muted-foreground">
            {entries.length} posts
          </span>
        </p>
        <div className="max-h-96 space-y-2 overflow-y-auto p-1">
          {entries.map((entry) => (
            <div key={entry.variant.id} className="h-32">
              <CalendarCard
                entry={entry}
                account={accounts.find(
                  (account) => account.id === entry.variant.connected_account_id,
                )}
                onSelect={(picked, action) => {
                  setOpen(false);
                  onSelect(picked, action);
                }}
              />
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function MonthCalendar({
  date,
  days,
  entries,
  accounts,
  mobile = false,
  onSelect,
  onDay,
}: {
  date: Date;
  days: Date[];
  entries: CalendarEntry[];
  accounts: Account[];
  mobile?: boolean;
  onSelect: SelectEntry;
  onDay: (date: Date) => void;
}) {
  const byDay = new Map<string, CalendarEntry[]>();
  for (const entry of [...entries].sort(
    (a, b) => utcDate(a.time).getTime() - utcDate(b.time).getTime(),
  )) {
    const key = dateKey(utcDate(entry.time));
    byDay.set(key, [...(byDay.get(key) ?? []), entry]);
  }
  const todayKey = dateKey(new Date());
  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <div className={cn("grid grid-cols-7", !mobile && "min-w-[700px]")}>
        {days.slice(0, 7).map((day) => (
          <div
            key={dateKey(day)}
            className="sticky top-0 z-10 border-b border-border/40 bg-background/90 py-2 text-center text-[11px] font-medium text-muted-foreground backdrop-blur-sm"
          >
            {day.toLocaleDateString(undefined, {
              weekday: mobile ? "narrow" : "short",
            })}
          </div>
        ))}
        {days.map((day) => {
          const key = dateKey(day);
          const events = byDay.get(key) ?? [];
          const outside = day.getMonth() !== date.getMonth();
          const slot = defaultSlot(day);
          return (
            <div
              key={key}
              className={cn(
                "group/cell relative flex flex-col gap-1 border-b border-r border-border/40 p-1.5",
                mobile ? "min-h-16 p-1" : "min-h-32",
                outside && "bg-muted/20",
              )}
            >
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  aria-label={`View ${day.toLocaleDateString()}`}
                  onClick={() => onDay(day)}
                  className={cn(
                    "grid size-6 place-items-center rounded-full text-xs tabular-nums outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50",
                    outside && "text-muted-foreground/60",
                    key === todayKey &&
                      "bg-foreground font-semibold text-background hover:bg-foreground/85",
                  )}
                >
                  {day.getDate()}
                </button>
                {slot && !mobile && (
                  <Link
                    href={newPostHref(slot)}
                    aria-label={`Schedule a post on ${day.toLocaleDateString()}`}
                    className="inline-flex h-5 items-center gap-0.5 rounded-md px-1.5 text-[11px] text-muted-foreground opacity-0 outline-none transition-opacity hover:bg-muted hover:text-foreground focus-visible:opacity-100 group-hover/cell:opacity-100"
                  >
                    <Plus className="size-3" />
                    Schedule
                  </Link>
                )}
              </div>
              {mobile ? (
                events.length > 0 && (
                  <button
                    type="button"
                    onClick={() => onDay(day)}
                    aria-label={`${events.length} ${events.length === 1 ? "post" : "posts"} on ${day.toLocaleDateString()}`}
                    className="flex flex-wrap gap-0.5 px-0.5 text-left"
                  >
                    {events.slice(0, 6).map((entry) => (
                      <span
                        key={entry.variant.id}
                        className={cn(
                          "size-1.5 rounded-full",
                          statusDot[entry.variant.status],
                        )}
                      />
                    ))}
                  </button>
                )
              ) : (
                <>
                  {events.slice(0, 3).map((entry) => (
                    <CalendarChip
                      key={entry.variant.id}
                      entry={entry}
                      account={accounts.find(
                        (account) =>
                          account.id === entry.variant.connected_account_id,
                      )}
                      onSelect={onSelect}
                    />
                  ))}
                  {events.length > 3 && (
                    <DayOverflow
                      day={day}
                      entries={events}
                      extra={events.length - 3}
                      accounts={accounts}
                      onSelect={onSelect}
                    />
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Day / week time grid                                                      */
/* -------------------------------------------------------------------------- */

export function TimeCalendar({
  days,
  entries,
  accounts,
  onSelect,
}: {
  days: Date[];
  entries: CalendarEntry[];
  accounts: Account[];
  onSelect: SelectEntry;
}) {
  const scroll = useRef<HTMLDivElement>(null);
  const scrolledPeriod = useRef("");
  const now = useNow();
  const [ghost, setGhost] = useState<{ key: string; minute: number } | null>(
    null,
  );
  const period = `${dateKey(days[0])}:${days.length}`;
  const todayKey = dateKey(now);
  const nowTop = ((now.getHours() * 60 + now.getMinutes()) / 60) * HOUR_HEIGHT;

  useEffect(() => {
    if (!scroll.current || scrolledPeriod.current === period) return;
    scrolledPeriod.current = period;
    const todayVisible = days.some((day) => dateKey(day) === dateKey(new Date()));
    const firstHour = todayVisible
      ? Math.max(0, new Date().getHours() - 2)
      : Math.min(
          8,
          ...entries.map((entry) =>
            Math.max(0, utcDate(entry.time).getHours() - 1),
          ),
        );
    scroll.current.scrollTop = HOUR_HEIGHT * firstHour;
  }, [period, entries, days]);

  const zone =
    new Intl.DateTimeFormat(undefined, { timeZoneName: "shortOffset" })
      .formatToParts(days[0])
      .find((part) => part.type === "timeZoneName")?.value ?? "Local";
  const columns = `64px repeat(${days.length}, minmax(0, 1fr))`;

  return (
    <div
      ref={scroll}
      className="min-h-0 flex-1 overflow-auto"
      aria-label={`${days.length === 1 ? "Day" : "Week"} calendar`}
    >
      <div style={{ minWidth: days.length > 1 ? 840 : 0 }}>
        <div
          className="sticky top-0 z-30 grid border-b border-border/40 bg-background/90 backdrop-blur-md"
          style={{ gridTemplateColumns: columns }}
        >
          <span className="flex items-end justify-center pb-3 text-[10px] text-muted-foreground">
            {zone}
          </span>
          {days.map((day) => {
            const today = dateKey(day) === todayKey;
            return (
              <div
                key={dateKey(day)}
                className="flex flex-col items-center gap-1 border-l border-border/40 py-2.5"
              >
                <span
                  className={cn(
                    "text-[11px] font-medium",
                    today ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {day.toLocaleDateString(undefined, { weekday: "short" })}
                </span>
                <span
                  className={cn(
                    "grid size-7 place-items-center rounded-full text-sm tabular-nums",
                    today && "bg-foreground font-semibold text-background",
                  )}
                >
                  {day.getDate()}
                </span>
              </div>
            );
          })}
        </div>
        <div className="grid" style={{ gridTemplateColumns: columns }}>
          <div className="relative">
            {Array.from({ length: 24 }, (_, hour) => (
              <div
                key={hour}
                style={{ height: HOUR_HEIGHT }}
                className="pr-3 pt-1 text-right text-[10px] text-muted-foreground"
              >
                {new Date(2026, 0, 1, hour).toLocaleTimeString(undefined, {
                  hour: "numeric",
                })}
              </div>
            ))}
            {days.some((day) => dateKey(day) === todayKey) && (
              <span
                className="pointer-events-none absolute right-1.5 z-30 -translate-y-1/2 rounded bg-rose-500 px-1 py-0.5 text-[10px] font-medium tabular-nums text-white"
                style={{ top: nowTop }}
              >
                {now.toLocaleTimeString(undefined, {
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </span>
            )}
          </div>
          {days.map((day) => {
            const key = dateKey(day);
            const today = key === todayKey;
            const slot = ghost?.key === key ? ghost.minute : null;
            return (
              <div
                key={key}
                className={cn(
                  "relative border-l border-border/40",
                  today && "bg-muted/20",
                )}
                style={{ height: HOUR_HEIGHT * 24, backgroundImage: gridLines }}
                onPointerMove={(event) => {
                  if (event.pointerType !== "mouse") return;
                  if ((event.target as HTMLElement).closest("[data-calendar-card]")) {
                    setGhost(null);
                    return;
                  }
                  const rect = event.currentTarget.getBoundingClientRect();
                  const minute = Math.min(
                    1410,
                    Math.max(
                      0,
                      Math.floor(((event.clientY - rect.top) / HOUR_HEIGHT) * 2) *
                        30,
                    ),
                  );
                  const at = new Date(day);
                  at.setHours(0, minute, 0, 0);
                  const next =
                    at.getTime() < Date.now() ? null : { key, minute };
                  setGhost((prev) =>
                    prev?.key === next?.key && prev?.minute === next?.minute
                      ? prev
                      : next,
                  );
                }}
                onPointerLeave={() => setGhost(null)}
              >
                {slot !== null &&
                  (() => {
                    const at = new Date(day);
                    at.setHours(0, slot, 0, 0);
                    return (
                      <Link
                        href={newPostHref(at)}
                        tabIndex={-1}
                        aria-label={`Schedule a post on ${at.toLocaleString()}`}
                        className="absolute inset-x-1 z-0 flex items-center gap-1.5 rounded-lg border border-dashed border-border bg-muted/40 px-2 text-xs text-muted-foreground transition-colors animate-in fade-in-0 duration-100 hover:text-foreground"
                        style={{
                          top: (slot / 60) * HOUR_HEIGHT + 2,
                          height: SLOT_HEIGHT - 4,
                        }}
                      >
                        <Plus className="size-3" />
                        Schedule
                        <span className="ml-auto tabular-nums">
                          {at.toLocaleTimeString(undefined, {
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </span>
                      </Link>
                    );
                  })()}
               {(() => {
  const dayEntries = entries.filter(
    (entry) => dateKey(utcDate(entry.time)) === key,
  );
  const accountOf = (entry: CalendarEntry) =>
    accounts.find((a) => a.id === entry.variant.connected_account_id);

  // Day view is wide, so side-by-side lanes still look good there.
  if (days.length === 1)
    return layoutDay(dayEntries).map(({ entry, minute, lane, lanes }) => (
      <div
        key={entry.variant.id}
        className="absolute z-10 px-1"
        style={{
          top: (minute / 60) * HOUR_HEIGHT + 3,
          left: `${(lane / lanes) * 100}%`,
          width: `${100 / lanes}%`,
          height: CARD_HEIGHT,
        }}
      >
        <CalendarCard
          entry={entry}
          account={accountOf(entry)}
          onSelect={onSelect}
        />
      </div>
    ));

  // Week view: one full card, or a tidy vertical stack when posts overlap.
  return clusterDay(dayEntries).map((cluster) => (
    <div
      key={cluster.entries[0].variant.id}
      className="absolute inset-x-0 z-10 px-1"
      style={{
        top: (cluster.minute / 60) * HOUR_HEIGHT + 3,
        height: CARD_HEIGHT,
      }}
    >
      {cluster.entries.length === 1 ? (
        <CalendarCard
          entry={cluster.entries[0]}
          account={accountOf(cluster.entries[0])}
          onSelect={onSelect}
        />
      ) : (
        <CalendarStack
          day={day}
          entries={cluster.entries}
          accounts={accounts}
          onSelect={onSelect}
        />
      )}
    </div>
  ));
})()}
                {today && (
                  <div
                    className="pointer-events-none absolute inset-x-0 z-20"
                    style={{ top: nowTop }}
                    aria-hidden
                  >
                    <div className="h-px w-full bg-rose-500" />
                    <span className="absolute -left-1 -top-[3px] flex size-[7px]">
                      <span className="absolute inline-flex size-full animate-ping rounded-full bg-rose-500/60 motion-reduce:animate-none" />
                      <span className="relative inline-flex size-[7px] rounded-full bg-rose-500" />
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Preview + reschedule dialog                                               */
/* -------------------------------------------------------------------------- */

function PreviewCard({
  entry,
  account,
}: {
  entry: CalendarEntry;
  account?: Account;
}) {
  const { variant } = entry;
  const text = draftText(variant.payload, variant.platform) || "Media post";
  const { threadCount, mediaUrl, mediaCount } = postExtras(variant.payload);
  const inline = inlinePlatforms.includes(variant.platform);
  const when = utcDate(entry.time).toLocaleString();
  const whenLabel =
    variant.status === "published"
      ? "Published"
      : variant.status === "failed"
        ? "Failed at"
        : "Scheduled for";
  const identity = (
    <div className="flex min-w-0 items-center gap-1.5 text-sm">
      <span className="truncate font-semibold">
        {account?.display_name ?? "Disconnected account"}
      </span>
      <span className="shrink-0 text-xs text-muted-foreground">
        on {profileFor(variant.platform).name}
      </span>
    </div>
  );
  const media = mediaUrl && (
    <div className={cn("relative mt-3", !inline && "-mx-4")}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={mediaUrl}
        alt=""
        className={cn(
          "max-h-56 w-full object-cover",
          inline
            ? "rounded-xl border border-border/60"
            : "border-y border-border/60",
        )}
      />
      {mediaCount > 1 && (
        <span className="absolute bottom-2 right-2 rounded-full bg-foreground/80 px-2 py-0.5 text-[11px] text-background">
          +{mediaCount - 1}
        </span>
      )}
    </div>
  );
  const body = (
    <>
      <p className="mt-1.5 whitespace-pre-wrap break-words text-[15px] leading-relaxed">
        {text}
      </p>
      {threadCount > 0 && (
        <p className="mt-2 text-xs text-muted-foreground">
          Thread of {threadCount} posts
        </p>
      )}
      {media}
    </>
  );
  return (
    <article className="rounded-2xl border border-border/60 bg-background p-4 shadow-sm">
      {inline ? (
        <div className="flex gap-3">
          <AccountAvatar
            account={account}
            className="size-10 shrink-0 rounded-full [&_img]:rounded-full"
          />
          <div className="min-w-0 flex-1">
            {identity}
            {body}
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3">
            <AccountAvatar
              account={account}
              className="size-9 shrink-0 rounded-full [&_img]:rounded-full"
            />
            {identity}
          </div>
          {body}
        </>
      )}
      <p className="mt-3 flex items-center gap-1.5 border-t border-border/40 pt-3 text-xs text-muted-foreground">
        <Clock3 className="size-3.5" />
        {whenLabel} {when}
      </p>
    </article>
  );
}

function TimeList({
  slots,
  selected,
  datePart,
  onPick,
}: {
  slots: string[];
  selected: string;
  datePart: string;
  onPick: (time: string) => void;
}) {
  const [now] = useState(Date.now);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const container = ref.current;
    const target = container?.querySelector<HTMLElement>(
      '[data-selected="true"]',
    );
    if (container && target)
      container.scrollTop = target.offsetTop - container.clientHeight / 2;
  }, []);
  return (
    <div ref={ref} className="relative max-h-56 space-y-0.5 overflow-y-auto">
      {slots.map((slot) => {
        const past = new Date(`${datePart}T${slot}`).getTime() < now;
        return (
          <button
            key={slot}
            type="button"
            disabled={past}
            data-selected={slot === selected}
            onClick={() => onPick(slot)}
            className={cn(
              "flex w-full items-center justify-between rounded-md px-2 py-1.5 text-xs tabular-nums outline-none transition-colors hover:bg-muted focus-visible:bg-muted disabled:pointer-events-none disabled:opacity-35",
              slot === selected && "bg-muted font-medium",
            )}
          >
            {formatTime(slot)}
            {slot === selected && <Check className="size-3.5" />}
          </button>
        );
      })}
    </div>
  );
}

const timeGrid = Array.from(
  { length: 96 },
  (_, i) => `${pad(Math.floor(i / 4))}:${pad((i % 4) * 15)}`,
);
const formatTime = (time: string) =>
  time
    ? new Date(`2026-01-01T${time}:00`).toLocaleTimeString(undefined, {
        hour: "numeric",
        minute: "2-digit",
      })
    : "Pick a time";

function DateTimePicker({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const [datePart = "", rawTime = ""] = value.split("T");
  const timePart = rawTime.slice(0, 5);
  const dateValue = datePart ? new Date(`${datePart}T12:00:00`) : undefined;
  const [dateOpen, setDateOpen] = useState(false);
  const [timeOpen, setTimeOpen] = useState(false);
  const valid = Boolean(scheduleInstant(value));
  const slots =
    !timePart || timeGrid.includes(timePart)
      ? timeGrid
      : [...timeGrid, timePart].sort();
  const zone =
    new Intl.DateTimeFormat(undefined, { timeZoneName: "short" })
      .formatToParts(new Date())
      .find((part) => part.type === "timeZoneName")?.value ?? "local time";
  const presets = [
    {
      label: "In 1 hour",
      at: () => {
        const d = new Date(Date.now() + 3_600_000);
        d.setMinutes(Math.ceil(d.getMinutes() / 5) * 5, 0, 0);
        return d;
      },
    },
    {
      label: "Tomorrow, 9:00",
      at: () => {
        const d = new Date();
        d.setDate(d.getDate() + 1);
        d.setHours(9, 0, 0, 0);
        return d;
      },
    },
    {
      label: "Next Monday, 9:00",
      at: () => {
        const d = new Date();
        d.setDate(d.getDate() + ((1 - d.getDay() + 7) % 7 || 7));
        d.setHours(9, 0, 0, 0);
        return d;
      },
    },
  ];
  const triggerClass =
    "inline-flex h-9 items-center gap-2 rounded-lg border border-border/60 bg-background px-3 text-sm outline-none transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 data-[popup-open]:bg-muted/70 data-[state=open]:bg-muted/70";
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <Popover open={dateOpen} onOpenChange={setDateOpen}>
          <PopoverTrigger
            disabled={disabled}
            render={
              <button type="button" className={triggerClass}>
                <CalendarDays className="size-3.5 text-muted-foreground" />
                {dateValue
                  ? dateValue.toLocaleDateString(undefined, {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })
                  : "Pick a date"}
              </button>
            }
          />
          <PopoverContent align="start" className="w-auto p-0">
            <Calendar
              mode="single"
              selected={dateValue}
              defaultMonth={dateValue}
              disabled={{ before: new Date(new Date().setHours(0, 0, 0, 0)) }}
              onSelect={(picked) => {
                if (!picked) return;
                onChange(
                  `${picked.getFullYear()}-${pad(picked.getMonth() + 1)}-${pad(picked.getDate())}T${timePart || "09:00"}`,
                );
                setDateOpen(false);
              }}
            />
          </PopoverContent>
        </Popover>
        <Popover open={timeOpen} onOpenChange={setTimeOpen}>
          <PopoverTrigger
            disabled={disabled}
            render={
              <button type="button" className={triggerClass}>
                <Clock3 className="size-3.5 text-muted-foreground" />
                {formatTime(timePart)}
              </button>
            }
          />
          <PopoverContent align="end" className="w-36 p-1">
            <TimeList
              slots={slots}
              selected={timePart}
              datePart={datePart}
              onPick={(time) => {
                onChange(`${datePart}T${time}`);
                setTimeOpen(false);
              }}
            />
          </PopoverContent>
        </Popover>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {presets.map((preset) => (
          <button
            key={preset.label}
            type="button"
            disabled={disabled}
            onClick={() => onChange(localDateTime(preset.at()))}
            className="h-7 rounded-full border border-border/60 px-2.5 text-xs text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50"
          >
            {preset.label}
          </button>
        ))}
      </div>
      <p
        role={valid ? undefined : "alert"}
        className={cn(
          "text-xs",
          valid ? "text-muted-foreground" : "text-destructive",
        )}
      >
        {valid
          ? `Posts in your local time (${zone}).`
          : "Choose a valid future date and time."}
      </p>
    </div>
  );
}

function CalendarPostDialog({
  entry,
  account,
  initialAction,
  onClose,
}: {
  entry: CalendarEntry;
  account?: Account;
  initialAction?: DialogAction;
  onClose: () => void;
}) {
  const trpc = useTRPC();
  const client = useQueryClient();
  const queued = entry.variant.status === "scheduled";
  const canPublish = account?.status === "active";
  const [time, setTime] = useState(localDateTime(utcDate(entry.time)));
  const [action, setAction] = useState<DialogAction | null>(
    queued
      ? initialAction === "publish" && !canPublish
        ? "reschedule"
        : (initialAction ?? "reschedule")
      : null,
  );
  const [error, setError] = useState("");
  const lock = useRef(false);
  const schedule = useMutation(trpc.studio.schedule.mutationOptions());
  const cancel = useMutation(trpc.studio.cancel.mutationOptions());
  const publish = useMutation(trpc.studio.publish.mutationOptions());
  const busy = schedule.isPending || cancel.isPending || publish.isPending;
  async function apply() {
    if (lock.current || !action) return;
    const instant = scheduleInstant(time);
    if (action === "reschedule" && !instant) {
      setError("Choose a valid future date and time.");
      return;
    }
    lock.current = true;
    setError("");
    try {
      if (action === "reschedule")
        await schedule.mutateAsync({
          id: entry.variant.id,
          scheduled_time: instant!,
        });
      else if (action === "cancel")
        await cancel.mutateAsync({ id: entry.variant.id });
      else {
        const result = await publish.mutateAsync({ id: entry.variant.id });
        if (["failed", "rejected"].includes(String(result.status)))
          throw new Error(
            String(result.last_error ?? "Publishing failed. Review this post."),
          );
      }
      toast.success(
        action === "cancel"
          ? "Moved back to drafts"
          : action === "reschedule"
            ? "Schedule updated"
            : "Post submitted",
      );
      onClose();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not update this post.",
      );
    } finally {
      lock.current = false;
      await Promise.all([
        client.invalidateQueries({ queryKey: trpc.studio.calendar.queryKey() }),
        client.invalidateQueries({ queryKey: trpc.studio.home.queryKey() }),
        client.invalidateQueries({ queryKey: trpc.studio.posts.queryKey() }),
        client.invalidateQueries({ queryKey: trpc.studio.postLibrary.queryKey() }),
        client.invalidateQueries({ queryKey: trpc.studio.post.queryKey() }),
      ]);
    }
  }
  const platform = profileFor(entry.variant.platform).name;
  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent
        showCloseButton={!busy}
        className="flex max-h-[90svh] flex-col gap-0 overflow-hidden p-0 sm:max-w-xl"
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border/60 bg-muted/40 py-3.5 pl-5 pr-12">
          <DialogHeader className="min-w-0 flex-1 flex-row items-center gap-3 space-y-0 text-left">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-background ring-1 ring-border/60">
              <PlatformMark
                platform={entry.variant.platform}
                className="!size-5"
              />
            </span>
            <div className="min-w-0">
              <DialogTitle className="truncate text-sm font-semibold">
                {entry.post_title}
              </DialogTitle>
              <DialogDescription className="truncate text-xs">
                {account?.display_name ?? "Disconnected account"} on {platform}
              </DialogDescription>
            </div>
          </DialogHeader>
          <StatusPill status={entry.variant.status} />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="bg-muted/30 p-5">
            <PreviewCard entry={entry} account={account} />
          </div>
          {(entry.variant.last_error || error || queued) && (
            <div className="space-y-4 p-5">
              {entry.variant.last_error && (
                <p
                  role="alert"
                  className="flex items-start gap-2 break-words rounded-lg border border-rose-500/20 bg-rose-500/5 p-3 text-xs text-rose-700 dark:text-rose-400"
                >
                  <TriangleAlert className="mt-px size-3.5 shrink-0" />
                  {entry.variant.last_error}
                </p>
              )}
              {queued && (
                <>
                  <Segmented
                    label="Post action"
                    fill
                    value={action ?? "reschedule"}
                    onChange={(value) => {
                      setAction(value);
                      setError("");
                    }}
                    options={[
                      {
                        value: "reschedule",
                        disabled: busy,
                        label: (
                          <>
                            <CalendarClock className="hidden size-3.5 sm:block" />
                            Reschedule
                          </>
                        ),
                      },
                      {
                        value: "publish",
                        disabled: busy || !canPublish,
                        label: (
                          <>
                            <Send className="hidden size-3.5 sm:block" />
                            Publish now
                          </>
                        ),
                      },
                      {
                        value: "cancel",
                        disabled: busy,
                        label: (
                          <>
                            <Undo2 className="hidden size-3.5 sm:block" />
                            Move to drafts
                          </>
                        ),
                      },
                    ]}
                  />
                  {!canPublish && (
                    <p className="text-xs text-muted-foreground">
                      Reconnect this account to publish now.
                    </p>
                  )}
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.div
                      key={action}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.14 }}
                    >
                      {action === "reschedule" && (
                        <DateTimePicker
                          value={time}
                          onChange={setTime}
                          disabled={busy}
                        />
                      )}
                      {action === "publish" && (
                        <p className="text-sm">
                          Publish this post now instead of its scheduled time?
                        </p>
                      )}
                      {action === "cancel" && (
                        <p className="text-sm">
                          Remove this post from the queue and keep it as a
                          draft?
                        </p>
                      )}
                    </motion.div>
                  </AnimatePresence>
                </>
              )}
              {error && (
                <p role="alert" className="text-xs text-destructive">
                  {error}
                </p>
              )}
            </div>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-border/60 bg-muted/20 px-5 py-3">
          <Button asChild variant="outline" size="sm" disabled={busy}>
            <Link href={editorHref(entry.variant)}>
              {queued
                ? "Open scheduled post"
                : entry.variant.status === "failed"
                  ? "Review and retry in editor"
                  : "Open post"}
            </Link>
          </Button>
          {queued && action && (
            <Button
              className="primary-btn rounded-xl"
              disabled={
                busy || (action === "reschedule" && !scheduleInstant(time))
              }
              onClick={() => void apply()}
            >
              {busy && <Loader2 className="size-4 animate-spin" />}
              {action === "reschedule"
                ? "Save schedule"
                : action === "cancel"
                  ? "Move to drafts"
                  : "Publish now"}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
