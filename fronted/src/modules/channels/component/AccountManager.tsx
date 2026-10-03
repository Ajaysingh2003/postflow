"use client";

import { useState, type ReactNode } from "react";
import {
  AlertCircle,
  ChevronDown,
  Loader2,
  Plus,
  RefreshCw,
  ShieldCheck,
  Unplug,
} from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { Account } from "@/modules/studio/types";
import { accountStatus, type ChannelConfig } from "../channel-config";
import ChannelIcon from "./ChannelIcon";
import AccountAvatar from "./AccountAvatar";

const BTN =
  "flex !h-8 items-center gap-1.5 rounded-lg px-3 text-[12.5px] font-medium disabled:cursor-not-allowed disabled:opacity-50";

function formattedDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(
    value.endsWith("Z") || /[+-]\d\d:\d\d$/.test(value) ? value : `${value}Z`,
  );
  return Number.isNaN(date.getTime())
    ? null
    : date.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
}

export default function AccountManager({
  channel,
  accounts,
  connecting,
  busyAccountId,
  onClose,
  onConnect,
  onDisconnect,
  onRefresh,
  renderTargets,
}: {
  channel: ChannelConfig;
  accounts: Account[];
  connecting: boolean;
  busyAccountId: string | null;
  onClose: () => void;
  onConnect: (account?: Account) => void;
  onDisconnect: (account: Account) => Promise<boolean>;
  onRefresh: (account: Account) => void;
  renderTargets: (account: Account) => ReactNode;
}) {
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [detailsId, setDetailsId] = useState<string | null>(null);
  const busy = connecting || !!busyAccountId;

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent
        className="flex max-h-[85dvh] flex-col gap-0 border-border overflow-hidden rounded-2xl border-[0.5px] p-0 sm:max-w-lg"
        showCloseButton={!busy}
      >
        {/* Header */}
        <div className="flex items-center gap-3.5 px-6 pb-4 pt-6 pr-12">
          <ChannelIcon channel={channel} />
          <div className="min-w-0">
            <DialogTitle className="font-sans text-[17px] font-semibold leading-tight tracking-[-0.015em]">
              Manage {channel.name}
            </DialogTitle>
            <DialogDescription className="mt-1 text-[12.5px]">
              Your accounts and connection settings.
            </DialogDescription>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex items-center justify-between border-y-[0.5px] border-border px-6 py-2.5">
          <p className="text-[12px] text-muted-foreground">
            <span className="font-medium tabular-nums text-foreground">
              {accounts.length}
            </span>{" "}
            {accounts.length === 1 ? "account" : "accounts"} in this workspace
          </p>
          <button
            type="button"
            onClick={() => onConnect()}
            disabled={busy}
            className={cn("secondary-btn", BTN)}
          >
            <Plus className="size-3.5" strokeWidth={2} />
            Add account
          </button>
        </div>

        {/* Accounts */}
        <div className="flex-1 space-y-3 overflow-y-auto px-6 py-4">
          {accounts.map((account) => {
            const name = account.display_name || channel.name;
            const attention = account.status === "needs_reauth";
            const disabled = account.status === "disabled";
            const needsReconnect = attention || disabled;
            const details = detailsId === account.id;
            const accountBusy = busyAccountId === account.id;
            const confirming = confirmId === account.id;
            const created = formattedDate(account.created_at);
            const expires = formattedDate(account.token_expires_at);

            return (
              <section
                key={account.id}
                aria-label={`${name} account`}
                className="overflow-hidden rounded-xl border-[0.5px] border-border bg-card"
              >
                <div className="p-4">
                  {/* Identity + status */}
                  <div className="flex items-center gap-3">
                    <AccountAvatar
                      account={account}
                      className="size-9"
                      fallbackClassName="text-[11px]"
                    />
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-[13.5px] font-semibold leading-tight">
                        {name}
                      </h3>
                      <p className="mt-0.5 text-[11.5px] capitalize text-muted-foreground">
                        {account.account_type?.replaceAll("_", " ") ||
                          "Social account"}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "inline-flex shrink-0 items-center gap-1.5 rounded-full border-[0.5px] px-2 py-0.5 text-[11px] font-medium",
                        attention
                          ? "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-400"
                          : account.status === "active"
                            ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                            : "border-border bg-muted text-muted-foreground",
                      )}
                    >
                      <span className="size-1.5 rounded-full bg-current" />
                      {accountStatus(account.status)}
                    </span>
                  </div>

                  {/* Notice */}
                  {needsReconnect && (
                    <p className="mt-3 rounded-lg border-[0.5px] border-amber-500/20 bg-amber-500/[0.06] px-3 py-2 text-[12px] leading-relaxed text-amber-800 dark:text-amber-300">
                      {attention
                        ? "Reconnect this account to resume publishing your content."
                        : "This account is disabled. Reconnect it to publish again."}
                    </p>
                  )}

                  {/* Actions */}
                  <div className="mt-3.5 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => onConnect(account)}
                      className={cn(needsReconnect ? "primary-btn" : "secondary-btn", BTN)}
                    >
                      <RefreshCw
                        className={cn("size-3.5", connecting && "animate-spin")}
                        strokeWidth={1.75}
                      />
                      {connecting ? "Connecting…" : "Reconnect"}
                    </button>

                    {account.status === "active" && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => onRefresh(account)}
                        className={cn("secondary-btn", BTN)}
                      >
                        {accountBusy && !confirming ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <ShieldCheck className="size-3.5" strokeWidth={1.75} />
                        )}
                        Refresh
                      </button>
                    )}

                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setConfirmId(confirming ? null : account.id)}
                      aria-label={`Disconnect ${name}`}
                      className={cn(
                        BTN,
                        "ml-auto cursor-pointer text-muted-foreground transition-colors hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400",
                        confirming && "bg-red-500/10 text-red-600 dark:text-red-400",
                      )}
                    >
                      <Unplug className="size-3.5" strokeWidth={1.75} />
                      Disconnect
                    </button>
                  </div>

                  {/* Details toggle */}
                  <button
                    type="button"
                    onClick={() => setDetailsId(details ? null : account.id)}
                    aria-expanded={details}
                    className="mt-3.5 flex cursor-pointer items-center gap-1 text-[11.5px] font-medium text-muted-foreground transition-colors hover:text-foreground"
                  >
                    Connection details
                    <ChevronDown
                      className={cn("size-3 transition-transform duration-200", details && "rotate-180")}
                    />
                  </button>

                  {details && (
                    <div className="mt-2.5 space-y-3 rounded-lg border-[0.5px] border-border bg-primary p-3 text-[12px]">
                      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
                        <dt className="text-muted-foreground">Account ID</dt>
                        <dd className="break-all text-right font-mono text-[11px]">
                          {account.external_account_id || account.id}
                        </dd>
                        {created && (
                          <>
                            <dt className="text-muted-foreground">Connected on</dt>
                            <dd className="text-right">{created}</dd>
                          </>
                        )}
                        {expires && (
                          <>
                            <dt className="text-muted-foreground">Authorization expires</dt>
                            <dd className="text-right">{expires}</dd>
                          </>
                        )}
                      </dl>

                      {!!account.granted_scopes?.length && (
                        <div className="border-t-[0.5px] border-border pt-3">
                          <p className="mb-2 text-muted-foreground">Granted permissions</p>
                          <div className="flex flex-wrap gap-1">
                            {account.granted_scopes.map((scope) => (
                              <span
                                key={scope}
                                className="break-all rounded-md border-[0.5px] border-border bg-background px-1.5 py-0.5 font-mono text-[10.5px]"
                              >
                                {scope}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {account.status === "active" && renderTargets(account)}
                    </div>
                  )}
                </div>

                {/* Disconnect confirmation */}
                {confirming && (
                  <div
                    role="alert"
                    className="border-t-[0.5px] border-red-500/20 bg-red-500/[0.05] p-4"
                  >
                    <p className="flex items-center gap-2 text-[12.5px] font-semibold text-red-700 dark:text-red-400">
                      <AlertCircle className="size-3.5" />
                      Disconnect {name}?
                    </p>
                    <p className="mt-1.5 text-[12px] leading-relaxed text-muted-foreground">
                      Scheduled posts for this account won’t publish while it’s
                      disconnected. You can connect it again later.
                    </p>
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={async () => {
                          if (await onDisconnect(account)) setConfirmId(null);
                        }}
                        className={cn(BTN, "cursor-pointer bg-red-600 text-white transition-colors hover:bg-red-700")}
                      >
                        {accountBusy && <Loader2 className="size-3.5 animate-spin" />}
                        {accountBusy ? "Disconnecting…" : "Confirm disconnect"}
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => setConfirmId(null)}
                        className={cn("secondary-btn", BTN)}
                      >
                        Keep connected
                      </button>
                    </div>
                  </div>
                )}
              </section>
            );
          })}

          {!accounts.length && (
            <div className="rounded-xl border-[0.5px] border-dashed border-border px-5 py-10 text-center">
              <p className="text-[13.5px] font-medium">No accounts connected</p>
              <p className="mt-1.5 text-[12px] text-muted-foreground">
                Add an account to start publishing to {channel.name}.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 border-t-[0.5px] border-border bg-primary px-6 py-3 text-[11.5px] text-muted-foreground">
          <ShieldCheck className="size-3.5 shrink-0" strokeWidth={1.75} />
          Connections use {channel.name}’s secure authorization.
        </div>
      </DialogContent>
    </Dialog>
  );
}