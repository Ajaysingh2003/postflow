"use client";

import { useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  Plus,
  Search,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Account } from "@/modules/studio/types";
import {
  CHANNELS,
  channelAccounts,
  connectionSummary,
  filterChannels,
  type ChannelConfig,
  type ChannelFilter,
} from "../channel-config";
import ChannelCard, { channelButton } from "./ChannelCard";
import ChannelToolbar from "./ChannelToolbar";

export default function ChannelsPanel({
  compact = false,
  accounts,
  loading = false,
  error,
  refreshing = false,
  connectingPlatform,
  onRefresh,
  onConnect,
  onManage,
  onAdd,
}: {
  compact?: boolean;
  accounts: Account[];
  loading?: boolean;
  error?: string;
  refreshing?: boolean;
  connectingPlatform: string | null;
  onRefresh: () => void;
  onConnect: (channel: ChannelConfig) => void;
  onManage: (channel: ChannelConfig) => void;
  onAdd: () => void;
}) {
  const [filter, setFilter] = useState<ChannelFilter>("all");
  const [search, setSearch] = useState("");
  const summary = connectionSummary(accounts);
  const channels = filterChannels(accounts, filter, search);
  const filters: { id: ChannelFilter; label: string; count: number }[] = [
    { id: "all", label: "All channels", count: CHANNELS.length },
    { id: "connected", label: "Connected", count: summary.platforms },
    {
      id: "attention",
      label: "Needs attention",
      count: new Set(
        accounts
          .filter((account) => account.status === "needs_reauth")
          .map((account) => account.platform),
      ).size,
    },
  ];

  return (
    <div
      className={
        compact
          ? "min-w-0 [&_h2]:text-base"
          : "mx-auto max-w-[1240px] px-5 py-8 sm:px-8 lg:px-10 lg:py-10"
      }
    >
      <header className="flex flex-wrap items-center justify-between gap-5">
        <div className={compact ? "hidden" : undefined}>
          <p className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground"></p>
          <h1 className="font-heading !text-[36px] capitalize leading-normalz tracking-[-0.035em] sm:text-5xl">
            manage channels<span className="text-emerald-500">.</span>
          </h1>
          <p className="mt-2.5 max-w-lg text-[13px] leading-relaxed text-muted-foreground">
            All your audiences, one place. Connect your accounts and keep your
            content flowing.
          </p>
        </div>
        <button
          type="button"
          onClick={onAdd}
          disabled={!!connectingPlatform || loading || !!error}
          className={cn(channelButton, " primary-btn roundded-md")}
        >
          <Plus className="size-4" />
          Add a channel
        </button>
      </header>

      {/* <section
        aria-label="Connection overview"
        className="mt-7 grid grid-cols-3 divide-x divide-border/70 rounded-2xl border border-border/70 bg-muted/30 py-5"
      >
        {[
          { label: "Active accounts", value: summary.active, icon: Link2 },
          {
            label: "Channels connected",
            value: summary.platforms,
            icon: Layers3,
          },
          {
            label: "Need attention",
            value: summary.attention,
            icon: AlertCircle,
          },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="px-3 sm:px-6">
            <div className="flex items-center gap-2">
              <Icon
                className={cn(
                  "hidden size-4 sm:block",
                  label === "Need attention" && value
                    ? "text-amber-500"
                    : "text-muted-foreground",
                )}
              />
              <span className="text-[24px] font-semibold leading-none tracking-tight">
                {loading || error ? "—" : value}
              </span>
              {label === "Need attention" && !value && !loading && !error && (
                <Check className="size-3.5 text-emerald-500" />
              )}
            </div>
            <p className="mt-2 text-[10px] text-muted-foreground sm:text-xs">
              {label}
            </p>
          </div>
        ))}
      </section> */}

      {summary.attention > 0 && !error && (
        <button
          type="button"
          onClick={() => setFilter("attention")}
          className="mt-5 flex w-full items-center gap-2.5 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3.5 text-left text-xs text-amber-800 dark:text-amber-300"
        >
          <AlertCircle className="size-4 shrink-0" />
          <span>
            {summary.attention === 1
              ? "An account needs"
              : `${summary.attention} accounts need`}{" "}
            to be reconnected to keep publishing.
          </span>
          <ArrowRight className="ml-auto size-4 shrink-0" />
        </button>
      )}

      <ChannelToolbar
        filters={filters}
        filter={filter}
        onFilterChange={setFilter}
        search={search}
        onSearchChange={setSearch}
        loading={loading}
        error={!!error}
        refreshing={refreshing}
        onRefresh={onRefresh}
      />
      {error ? (
        <div
          role="alert"
          className="mt-5 rounded-2xl border border-border p-8 text-center"
        >
          <AlertCircle className="mx-auto mb-3 size-6 text-amber-500" />
          <h2 className="font-semibold">Couldn’t load your connections</h2>
          <p className="mt-2 text-sm text-muted-foreground">{error}</p>
          <button
            type="button"
            disabled={refreshing}
            onClick={onRefresh}
            className={cn(channelButton, "mt-5")}
          >
            Try again
          </button>
        </div>
      ) : loading ? (
        <div
          role="status"
          aria-label="Loading channels"
          className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3"
        >
          {CHANNELS.map((channel) => (
            <div
              key={channel.id}
              className="h-[310px] animate-pulse rounded-[22px] border border-border bg-muted/30 p-6"
            >
              <div className="size-14 rounded-2xl bg-muted" />
              <div className="mt-5 h-5 w-24 rounded bg-muted" />
              <div className="mt-3 h-9 rounded bg-muted" />
              <div className="mt-16 h-10 rounded-xl bg-muted" />
            </div>
          ))}
        </div>
      ) : channels.length ? (
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {channels.map((channel) => (
            <ChannelCard
              key={channel.id}
              channel={channel}
              accounts={channelAccounts(accounts, channel.id)}
              loading={connectingPlatform === channel.id}
              onConnect={() => onConnect(channel)}
              onManage={() => onManage(channel)}
            />
          ))}
        </div>
      ) : (
        <div className="mt-5 rounded-2xl border border-dashed border-border px-6 py-14 text-center">
          <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl bg-muted">
            <Search className="size-5 text-muted-foreground" />
          </div>
          <h2 className="text-sm font-semibold">
            {search
              ? "No matching channels"
              : filter === "attention"
                ? "You’re all caught up"
                : "Your next connection starts here"}
          </h2>
          <p className="mt-2 text-xs text-muted-foreground">
            {search
              ? "Try a different channel or account name."
              : filter === "attention"
                ? "None of your accounts need to be reconnected."
                : "Connect a channel to start sharing with your audience."}
          </p>
          <button
            type="button"
            className={cn(channelButton, "mt-5")}
            onClick={() => {
              setSearch("");
              setFilter("all");
            }}
          >
            Show all channels
          </button>
        </div>
      )}

      <p className="mt-7 flex items-center justify-center gap-2 text-center text-[10px] leading-relaxed text-muted-foreground">
        <ShieldCheck className="size-3.5 shrink-0" />
        Secure connections through each platform. Your passwords stay with you.
      </p>
    </div>
  );
}
