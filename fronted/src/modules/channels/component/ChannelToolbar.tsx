"use client";

import { RefreshCw, Search, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

type FilterOption<T extends string> = { id: T; label: string; count: number };

type ChannelToolbarProps<T extends string> = {
  filters: FilterOption<T>[];
  filter: T;
  onFilterChange: (id: T) => void;
  search: string;
  onSearchChange: (value: string) => void;
  loading?: boolean;
  error?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  className?: string;
};

export default function ChannelToolbar<T extends string>({
  filters,
  filter,
  onFilterChange,
  search,
  onSearchChange,
  loading = false,
  error = false,
  refreshing = false,
  onRefresh,
  className,
}: ChannelToolbarProps<T>) {
  return (
    <div
      className={cn(
        "mt-8 flex flex-wrap items-center justify-between gap-3",
        className,
      )}
    >
      {/* Segmented filter */}
      <div
        role="group"
        aria-label="Filter channels"
        className="flex max-w-full items-center gap-0.5 overflow-x-auto rounded-lg border-[0.5px] border-neutral-200 bg-neutral-100/80 p-0.5 dark:border-white/10 dark:bg-white/[0.04]"
      >
        {filters.map(({ id, label, count }) => {
          const active = filter === id;
          return (
            <button
              key={id}
              type="button"
              aria-pressed={active}
              onClick={() => onFilterChange(id)}
              className={cn(
                "flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-md px-3 text-[12.5px] font-medium transition-all duration-150",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400/40",
                active
                  ? "bg-white text-neutral-900 shadow-[0_1px_2px_rgba(0,0,0,0.08)] dark:bg-white/[0.10] dark:text-white dark:shadow-none"
                  : "text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white",
              )}
            >
              {label}
              <span
                className={cn(
                  "text-[11px] tabular-nums",
                  active
                    ? "text-neutral-500 dark:text-neutral-300"
                    : "text-neutral-400 dark:text-neutral-500",
                )}
              >
                {loading || error ? "–" : count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Search + refresh */}
      <div className="flex w-full items-center gap-2 sm:w-auto">
        <label
          className={cn(
            "flex h-9 min-w-0 flex-1 items-center gap-2 rounded-lg border-[0.5px] border-neutral-200 bg-white px-2.5 transition-colors sm:w-60 sm:flex-none",
            "focus-within:border-neutral-400 focus-within:ring-2 focus-within:ring-neutral-400/20",
            "dark:border-white/10 dark:bg-white/[0.03] dark:focus-within:border-white/30 dark:focus-within:ring-white/10",
          )}
        >
          <Search className="size-3.5 shrink-0 text-neutral-400" strokeWidth={1.75} />
          <Input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search channels"
            aria-label="Search channels or accounts"
            className="w-full min-w-0 bg-transparent text-[13px] text-neutral-900 outline-none placeholder:text-neutral-400 dark:text-neutral-100"
          />
          {search && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => onSearchChange("")}
              className="flex size-4 shrink-0 cursor-pointer items-center justify-center rounded-full text-neutral-400 transition-colors hover:text-neutral-900 dark:hover:text-white"
            >
              <X className="size-3" strokeWidth={2} />
            </button>
          )}
        </label>

        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing}
          aria-label="Refresh connections"
          className="secondary-btn flex size-9 shrink-0 items-center justify-center rounded-lg !px-0 disabled:opacity-60"
        >
          <RefreshCw
            className={cn(
              "size-3.5 text-neutral-600 dark:text-neutral-300",
              refreshing && "animate-spin",
            )}
            strokeWidth={1.75}
          />
        </button>
      </div>
    </div>
  );
}