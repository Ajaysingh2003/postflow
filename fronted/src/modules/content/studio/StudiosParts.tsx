"use client";
import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import {
  AlertCircle,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Plus,
  Search,
  TriangleAlert,
  Users,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PlatformMark } from "./AccountSwitcher";
import { cn } from "@/lib/utils";

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background";

const buttonBase =
  "inline-flex items-center justify-center gap-1.5 text-xs font-medium rounded-lg px-3.5 h-9 cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed " +
  focusRing;

export const primaryButtonClass =
  buttonBase + " bg-[#239a7d] hover:bg-[#198268] text-white shadow-xs";
export const secondaryButtonClass =
  buttonBase +
  " bg-card hover:bg-muted text-foreground border border-border shadow-xs";

export function ActionButton({
  variant = "secondary",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary";
}) {
  return (
    <button
      type="button"
      className={cn(
        variant === "primary" ? primaryButtonClass : secondaryButtonClass,
        className,
      )}
      {...props}
    />
  );
}

/* ---------- Full-area states (loading, error, empty) ---------- */

export function StatePanel({
  icon,
  title,
  children,
  action,
  role,
}: {
  icon: ReactNode;
  title?: string;
  children?: ReactNode;
  action?: ReactNode;
  role?: "status" | "alert";
}) {
  return (
    <div
      role={role}
      className="flex h-full min-h-[350px] flex-col items-center justify-center gap-3 p-8 text-center"
    >
      <div className="grid size-12 place-items-center rounded-2xl border border-border bg-muted/50 text-muted-foreground">
        {icon}
      </div>
      {title && (
        <h1 className="mt-1 font-serif text-[26px] leading-tight tracking-tight text-foreground">
          {title}
        </h1>
      )}
      {children && (
        <div className="max-w-[340px] text-xs leading-relaxed text-muted-foreground">
          {children}
        </div>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function LoadingState({ children }: { children: ReactNode }) {
  return (
    <StatePanel
      role="status"
      icon={<Loader2 className="animate-spin" size={20} />}
    >
      {children}
    </StatePanel>
  );
}

/* ---------- Inline notices ---------- */

export function InlineError({ children }: { children: ReactNode }) {
  return (
    <p
      role="alert"
      className="mb-4 flex items-start gap-2 whitespace-pre-wrap rounded-lg border border-destructive/20 bg-destructive/[0.06] px-3 py-2.5 text-[11px] leading-relaxed text-destructive"
    >
      <AlertCircle size={14} className="mt-px shrink-0" />
      <span>{children}</span>
    </p>
  );
}

export function ReconnectBanner() {
  return (
    <div className="mb-8 flex items-start gap-3 rounded-xl border border-amber-500/25 bg-amber-500/[0.08] p-3.5 text-[11px] leading-relaxed text-amber-700 dark:text-amber-400">
      <TriangleAlert size={16} className="mt-0.5 shrink-0" />
      <div className="space-y-1">
        <p>
          This account needs reconnecting before you publish. You can keep
          writing.
        </p>
        <Link
          href="/dashboard/channels"
          className="inline-flex items-center gap-0.5 font-medium text-foreground underline-offset-4 hover:underline"
        >
          Manage connection
          <ChevronRight size={13} />
        </Link>
      </div>
    </div>
  );
}

export function ScheduledBanner({
  time,
  busy,
  onMove,
}: {
  time: string;
  busy: boolean;
  onMove: () => void;
}) {
  return (
    <div className="mb-7 flex items-center gap-3 rounded-xl border border-border bg-muted/40 p-3.5">
      <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-background text-muted-foreground ring-1 ring-border">
        <CalendarClock size={16} />
      </div>
      <div className="min-w-0 flex-1">
        <strong className="block truncate text-xs font-semibold">
          Scheduled for {time}
        </strong>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          Move it back to drafts to make changes.
        </p>
      </div>
      <ActionButton className="h-8 px-3" disabled={busy} onClick={onMove}>
        Move to drafts
      </ActionButton>
    </div>
  );
}

export function PublishingNote() {
  return (
    <p className="mt-5 flex items-center gap-2 text-[11px] leading-relaxed text-muted-foreground">
      <Loader2 size={13} className="animate-spin" />
      Publishing is in progress. This post will update automatically.
    </p>
  );
}

export function PublishAsRow({ children }: { children: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-border bg-muted/20 px-3.5 py-2.5">
      {children}
    </div>
  );
}

export function ShareToMore({
  disabled,
  onClick,
}: {
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <div className="mx-auto mt-6 flex max-w-[600px] items-center gap-3 rounded-xl border border-border bg-card p-3.5 shadow-xs">
      <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-[#239a7d]/10 text-[#239a7d]">
        <Users size={16} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold">Share to more accounts</p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          Keep this idea, adjust each version.
        </p>
      </div>
      <ActionButton className="h-8 px-3" disabled={disabled} onClick={onClick}>
        Choose accounts
      </ActionButton>
    </div>
  );
}

export function IssuesAlert({ issues }: { issues: string[] }) {
  return (
    <div
      role="alert"
      className="mt-6 rounded-xl border border-destructive/20 bg-destructive/[0.06] p-4 text-[11px] leading-relaxed text-destructive"
    >
      <strong className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold">
        <AlertCircle size={14} />
        Check before publishing
      </strong>
      <ul className="list-disc space-y-1 pl-5">
        {issues.map((issue, i) => (
          <li key={i}>{issue}</li>
        ))}
      </ul>
    </div>
  );
}

/* ---------- Dialogs ---------- */

export function ConfirmSaveDialog({
  open,
  busy,
  onOpenChange,
  onDiscard,
  onSave,
}: {
  open: boolean;
  busy: boolean;
  onOpenChange: (open: boolean) => void;
  onDiscard: () => void;
  onSave: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-6 sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Save your changes?</DialogTitle>
          <DialogDescription>
            Your current draft has changes. Save them before opening another
            post.
          </DialogDescription>
        </DialogHeader>
        <div className="mt-4 flex flex-col-reverse justify-end gap-2 sm:flex-row">
          <ActionButton disabled={busy} onClick={onDiscard}>
            Discard changes
          </ActionButton>
          <ActionButton variant="primary" disabled={busy} onClick={onSave}>
            Save and continue
          </ActionButton>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export type PostRow = {
  id: string;
  when: string;
  badge?: string;
  text: string;
  platform: string;
  selected: boolean;
};

export function PostsDialog({
  open,
  onOpenChange,
  accountName,
  platformName,
  tabs,
  view,
  onView,
  busy,
  onNew,
  search,
  onSearch,
  loading,
  error,
  localDraftText,
  rows,
  emptyText,
  onLoad,
  canPrev,
  canNext,
  onPrev,
  onNext,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountName: string;
  platformName: string;
  tabs: string[];
  view: string;
  onView: (tab: string) => void;
  busy: boolean;
  onNew: () => void;
  search: string;
  onSearch: (value: string) => void;
  loading: boolean;
  error?: string;
  /** Set when an unsaved draft is open: shown as the first row. */
  localDraftText: { text: string; platform: string } | null;
  rows: PostRow[];
  emptyText: string;
  onLoad: (id: string) => void;
  canPrev: boolean;
  canNext: boolean;
  onPrev: () => void;
  onNext: () => void;
}) {
  const rowClass = (selected: boolean) =>
    cn(
      "relative block w-full border-b border-border px-5 py-3.5 text-left transition-colors cursor-pointer",
      "before:absolute before:inset-y-3 before:left-0 before:w-[3px] before:rounded-r-full before:transition-colors",
      "hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-40",
      "focus-visible:outline-none focus-visible:bg-muted/60 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/60",
      selected
        ? "bg-muted/40 before:bg-[#239a7d]"
        : "before:bg-transparent",
    );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg gap-0 overflow-hidden rounded-2xl p-0 text-[13px]">
        <DialogHeader className="px-5 pb-4 pt-5">
          <DialogTitle>Your posts</DialogTitle>
          <DialogDescription>
            Drafts, scheduled posts and published content for {accountName}.
          </DialogDescription>
        </DialogHeader>

        <div className="px-5 pb-3">
          <div
            role="tablist"
            aria-label="Post status"
            className="flex gap-0.5 rounded-lg bg-muted p-0.5"
          >
            {tabs.map((tab) => (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={view === tab}
                onClick={() => onView(tab)}
                className={cn(
                  "flex-1 cursor-pointer rounded-md px-1 py-1.5 text-[11px] transition-all",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
                  view === tab
                    ? "bg-background font-semibold text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 border-b border-border px-5 pb-3.5">
          <label className="flex h-9 flex-1 items-center gap-2 rounded-lg border border-border bg-background px-3 text-muted-foreground transition-colors focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/30">
            <Search size={14} className="shrink-0" />
            <input
              aria-label="Search account posts on this page"
              placeholder="Find a post…"
              value={search}
              onChange={(e) => onSearch(e.target.value)}
              className="w-full bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground/60"
            />
          </label>
          <ActionButton variant="primary" disabled={busy} onClick={onNew}>
            <Plus size={14} />
            New draft
          </ActionButton>
        </div>

        <div className="max-h-[45vh] min-h-[170px] flex-1 overflow-y-auto">
          {localDraftText && (
            <button
              type="button"
              className={rowClass(true)}
              onClick={() => onOpenChange(false)}
            >
              <div className="mb-1.5 flex items-center gap-2 text-[10px] text-muted-foreground">
                <PlatformMark platform={localDraftText.platform} />
                <span>In progress</span>
                <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px]">
                  Local backup
                </span>
              </div>
              <p className="line-clamp-3 text-xs leading-relaxed">
                {localDraftText.text || "Empty draft"}
              </p>
            </button>
          )}

          {loading && (
            <p className="flex items-center gap-2 px-5 py-6 text-[11px] text-muted-foreground">
              <Loader2 size={13} className="animate-spin" />
              Loading posts…
            </p>
          )}
          {error && (
            <p
              role="alert"
              className="whitespace-pre-wrap px-5 py-3 text-[11px] leading-relaxed text-destructive"
            >
              {error}
            </p>
          )}

          {rows.map((row) => (
            <button
              key={row.id}
              type="button"
              className={rowClass(row.selected)}
              disabled={busy}
              onClick={() => onLoad(row.id)}
            >
              <div className="mb-1.5 flex items-center gap-2 text-[10px] text-muted-foreground">
                <PlatformMark platform={row.platform} />
                <span>{row.when}</span>
                {row.badge && (
                  <span className="rounded-full bg-destructive/10 px-1.5 py-0.5 text-[10px] font-medium capitalize text-destructive">
                    {row.badge}
                  </span>
                )}
              </div>
              <p className="line-clamp-3 text-xs leading-relaxed">{row.text}</p>
            </button>
          ))}

          {!loading && !error && !rows.length && !localDraftText && (
            <p className="px-5 py-10 text-center text-[11px] leading-relaxed text-muted-foreground">
              {emptyText}
            </p>
          )}
        </div>

        <footer className="flex items-center justify-between border-t border-border bg-muted/30 px-5 py-3 text-xs text-muted-foreground">
          <span>
            {platformName}, {view.toLowerCase()}
          </span>
          <div className="flex gap-1.5">
            {[
              {
                label: "Previous posts page",
                icon: <ChevronLeft size={15} />,
                disabled: !canPrev,
                onClick: onPrev,
              },
              {
                label: "Next posts page",
                icon: <ChevronRight size={15} />,
                disabled: !canNext,
                onClick: onNext,
              },
            ].map((b) => (
              <button
                key={b.label}
                type="button"
                aria-label={b.label}
                disabled={b.disabled}
                onClick={b.onClick}
                className={cn(
                  "grid size-7 cursor-pointer place-items-center rounded-md border border-border bg-background transition-colors",
                  "hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
                )}
              >
                {b.icon}
              </button>
            ))}
          </div>
        </footer>
      </DialogContent>
    </Dialog>
  );
}