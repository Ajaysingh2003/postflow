"use client";

import { Check, Loader2, Settings2 } from "lucide-react";

import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import type { Account } from "@/modules/studio/types";
import type { ChannelConfig } from "../channel-config";
import ChannelIcon from "./ChannelIcon";
import AccountAvatar from "./AccountAvatar";

// Kept exported in case other files still import it.
export const channelButton =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-border bg-background px-4 py-2 text-[13px] font-semibold transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400/40 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

export default function ChannelCard({
  channel,
  accounts,
  loading,
  disconnecting = false,
  onConnect,
  onDisconnect,
  onManage,
}: {
  channel: ChannelConfig;
  accounts: Account[];
  /** Connect (OAuth) is starting. */
  loading: boolean;
  /** A disconnect is saving. */
  disconnecting?: boolean;
  /** Switch turned ON. */
  onConnect: () => void;
  /** Switch turned OFF. Open your confirm dialog here. */
  onDisconnect?: () => void;
  /** Manage button, only shown when connected. */
  onManage: () => void;
}) {
  const active = accounts.filter((a) => a.status === "active");
  const attention = accounts.some((a) => a.status === "needs_reauth");
  const connected = accounts.some((a) => a.status !== "disabled");
  const first = active[0] ?? accounts.find((a) => a.status !== "disabled");
  const busy = loading || disconnecting;
  const comingSoon = !!channel.comingSoon;

  const handleSwitch = (checked: boolean) => {
    if (comingSoon || busy) return;
    if (checked) onConnect();
    else if (onDisconnect) onDisconnect();
    else onManage();
  };

  return (
    <article
      aria-label={`${channel.name} channel`}
      className={cn(
        "group flex flex-col overflow-hidden rounded-2xl border-[0.5px] border-neutral-200 bg-white",
        "transition-all duration-150 hover:border-neutral-300 shadow-sm hover:shadow-[0_6px_20px_-10px_rgba(0,0,0,0.15)]",
        "dark:border-white/10 dark:bg-white/[0.025] dark:hover:border-white/20 dark:hover:shadow-none",
        comingSoon && "opacity-60 hover:shadow-none",
      )}
    >
      {/* Body */}
      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-start justify-between gap-3">
          <ChannelIcon channel={channel} />

          {comingSoon ? (
            <span className="rounded-full border-[0.5px] border-neutral-300 px-2 py-0.5 text-[11px] font-medium text-neutral-500 dark:border-white/15 dark:text-neutral-400">
              Coming soon
            </span>
          ) : attention ? (
            <span className="flex items-center gap-1.5 rounded-full border-[0.5px] border-amber-500/25 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-400">
              <span className="size-1.5 rounded-full bg-amber-500" />
              Needs attention
            </span>
          ) : connected ? (
            <span className="flex items-center gap-1 rounded-full border-[0.5px] border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
              <Check className="size-3" strokeWidth={2.5} />
              Connected
            </span>
          ) : null}
        </div>

        <h2 className="mt-4 text-[17px] font-semibold tracking-[-0.015em] text-neutral-900 dark:text-neutral-50">
          {channel.name}
        </h2>
        <p className="mt-1.5 line-clamp-3 min-h-[3.5rem] text-[13px] leading-[1.55] text-neutral-500 dark:text-neutral-400">
          {channel.description}
        </p>

        {channel.features.length > 0 && (
          <div className="mt-3.5 flex flex-wrap gap-1.5">
            {channel.features.map((feature) => (
              <span
                key={feature}
                className="rounded-md border-[0.5px] border-neutral-200 bg-neutral-50 px-1.5 py-0.5 text-[11px] text-neutral-500 dark:border-white/10 dark:bg-white/[0.04] dark:text-neutral-400"
              >
                {feature}
              </span>
            ))}
          </div>
        )}

        {/* Account */}
        {connected && first && (
          <div className="mt-4 flex items-center gap-2.5 rounded-xl border-[0.5px] border-neutral-200 bg-neutral-50/70 p-2 dark:border-white/10 dark:bg-white/[0.03]">
            <AccountAvatar
              account={first}
              className="size-7"
              fallbackClassName="text-[10px]"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12.5px] font-medium leading-tight text-neutral-900 dark:text-neutral-100">
                {first.display_name || channel.name}
              </p>
              <p className="mt-0.5 text-[11px] leading-tight text-neutral-500 dark:text-neutral-400">
                {active.length} active{" "}
                {active.length === 1 ? "account" : "accounts"}
                {accounts.length > active.length &&
                  ` · ${accounts.length} total`}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex min-h-14 items-center justify-between gap-3 border-t-[0.5px] border-neutral-200 bg-primary px-5 py-3 dark:border-white/10">
        {connected && !comingSoon ? (
          <button
            type="button"
            onClick={onManage}
            aria-label={`Manage ${channel.name} accounts`}
            className="secondary-btn relative flex !h-9 items-center gap-2 rounded-lg px-3.5 text-[13px] font-medium text-neutral-700 dark:text-neutral-200"
          >
            <Settings2 className="size-4" strokeWidth={1.75} />
            Manage
            {/* {attention && (
              <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-amber-500 ring-2 ring-white dark:ring-[#1b1b1b]" />
            )} */}
          </button>
        ) : (
          <span className="text-[12.5px] text-neutral-500 dark:text-neutral-400">
            {comingSoon ? "Available soon" : "Turn on to connect"}
          </span>
        )}

        <div className="flex shrink-0 items-center gap-2">
          {busy && (
            <Loader2 className="size-3.5 animate-spin text-neutral-400" />
          )}
          <Switch
            className="primary-switch"
            checked={connected}
            disabled={busy || comingSoon}
            onCheckedChange={handleSwitch}
            aria-label={
              connected
                ? `Disconnect ${channel.name}`
                : `Connect ${channel.name}`
            }
          />
        </div>
      </div>
    </article>
  );
}
