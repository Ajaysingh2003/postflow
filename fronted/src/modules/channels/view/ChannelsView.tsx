"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUpRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useTRPC } from "@/trpc/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Account } from "@/modules/studio/types";

import {
  CHANNELS,
  channelAccounts,
  isSafeAuthUrl,
  reconnectHint,
  type ChannelConfig,
} from "../channel-config";

import ChannelsPanel from "../component/ChannelsPanel";
import AccountManager from "../component/AccountManager";
import ChannelIcon from "../component/ChannelIcon";
import ConnectChannelDialog from "../component/ConnectChannelDialog";

export { CHANNELS } from "../channel-config";
export type { ChannelConfig } from "../channel-config";

function AccountTargets({ account }: { account: Account }) {
  const trpc = useTRPC();
  const targets = useQuery(
    trpc.studio.targets.queryOptions({ id: account.id }),
  );
  return (
    <div className="border-t border-border pt-3">
      <p className="mb-2 font-medium">Posting destinations</p>
      {targets.isPending ? (
        <p
          role="status"
          className="flex items-center gap-2 text-muted-foreground"
        >
          <Loader2 className="size-3 animate-spin" />
          Loading destinations…
        </p>
      ) : targets.error ? (
        <div role="alert">
          <p className="text-muted-foreground">{targets.error.message}</p>
          <button
            type="button"
            onClick={() => void targets.refetch()}
            className="mt-2 font-medium underline underline-offset-2"
          >
            Try again
          </button>
        </div>
      ) : targets.data.targets.length ? (
        <ul className="max-h-36 space-y-1 overflow-y-auto">
          {targets.data.targets.map((target) => (
            <li
              key={target.id}
              className="break-words rounded-lg bg-background px-2 py-1.5"
            >
              {target.name}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground">
          Posts publish directly to this account.
        </p>
      )}
    </div>
  );
}

function ChannelsViewContent() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const accountQuery = useQuery(trpc.studio.accounts.queryOptions());
  const accounts = accountQuery.data ?? [];
  const [manageChannel, setManageChannel] = useState<ChannelConfig | null>(
    null,
  );
  const [pickerOpen, setPickerOpen] = useState(false);
  const [connectPrompt, setConnectPrompt] = useState<{
    channel: ChannelConfig;
    hint: string;
  } | null>(null);
  const connect = useMutation(trpc.studio.connect.mutationOptions());
  const disconnect = useMutation(trpc.studio.disconnect.mutationOptions());
  const refreshAccount = useMutation(
    trpc.studio.refreshAccount.mutationOptions(),
  );
  const connectingPlatform = connect.isPending
    ? connect.variables.platform
    : null;
  const busyAccountId = disconnect.isPending
    ? disconnect.variables.id
    : refreshAccount.isPending
      ? refreshAccount.variables.id
      : null;

  async function refreshAccounts() {
    await queryClient.invalidateQueries({
      queryKey: trpc.studio.accounts.queryKey(),
    });
  }

  useEffect(() => {
    // Read the live URL as well, so Strict Mode cannot replay a callback toast.
    const url = new URL(window.location.href);
    const connected = url.searchParams.get("connected");
    const error = url.searchParams.get("error");
    if (!connected && !error) return;
    url.searchParams.delete("connected");
    url.searchParams.delete("error");
    window.history.replaceState({}, "", url.pathname + url.search + url.hash);
    if (connected) {
      toast.success(
        `${CHANNELS.find((channel) => channel.id === connected)?.name ?? connected} connected`,
      );
      void queryClient.invalidateQueries({
        queryKey: trpc.studio.accounts.queryKey(),
      });
    } else if (error) {
      // URLSearchParams already decoded the provider's message.
      toast.error(`Connection failed: ${error}`);
    }
  }, [searchParams, queryClient, trpc]);

  function startConnection(
    channel: ChannelConfig,
    options: Record<string, string> = {},
  ) {
    if (
      channel.comingSoon ||
      channel.id === "tiktok" ||
      connect.isPending ||
      busyAccountId
    )
      return;
    connect.mutate(
      { platform: channel.id, options },
      {
        onSuccess: (result) => {
          if (!isSafeAuthUrl(result.auth_url)) {
            toast.error("The provider returned an invalid connection URL.");
            return;
          }
          window.location.assign(result.auth_url);
        },
        onError: (error) =>
          toast.error(
            error.message || "Couldn’t start the connection. Please try again.",
          ),
      },
    );
  }

  function handleConnect(channel: ChannelConfig, account?: Account) {
    if (connect.isPending || busyAccountId || channel.comingSoon) return;
    setPickerOpen(false);
    if (channel.id === "bluesky" || channel.id === "mastodon") {
      setManageChannel(null);
      setConnectPrompt({
        channel,
        hint: account ? reconnectHint(account) : "",
      });
    } else {
      startConnection(channel);
    }
  }

  async function handleDisconnect(account: Account) {
    if (connect.isPending || busyAccountId) return false;
    try {
      await disconnect.mutateAsync({ id: account.id });
      queryClient.setQueryData(trpc.studio.accounts.queryKey(), (current) =>
        current?.filter((item) => item.id !== account.id),
      );
      toast.success(`${account.display_name || "Account"} disconnected`);
      await refreshAccounts();
      return true;
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Couldn’t disconnect this account.",
      );
      // Revocation failure can mark the account as needing reauthentication.
      await refreshAccounts();
      return false;
    }
  }

  function handleRefresh(account: Account) {
    if (connect.isPending || busyAccountId) return;
    refreshAccount.mutate(
      { id: account.id },
      {
        onSuccess: (updated) => {
          queryClient.setQueryData(trpc.studio.accounts.queryKey(), (current) =>
            current?.map((item) => (item.id === updated.id ? updated : item)),
          );
          if (updated.status === "active")
            toast.success("Connection refreshed");
          else toast.error("This account needs to be reconnected.");
        },
        onError: (error) =>
          toast.error(error.message || "Couldn’t refresh this connection."),
        onSettled: () => {
          void refreshAccounts();
          void queryClient.invalidateQueries({
            queryKey: trpc.studio.targets.queryKey({ id: account.id }),
          });
        },
      },
    );
  }

  return (
    <>
      <ChannelsPanel
        accounts={accounts}
        loading={accountQuery.isPending}
        error={accountQuery.error?.message}
        refreshing={accountQuery.isFetching}
        connectingPlatform={connectingPlatform}
        onRefresh={() => void accountQuery.refetch()}
        onConnect={handleConnect}
        onManage={setManageChannel}
        onAdd={() => setPickerOpen(true)}
      />
      {manageChannel && (
        <AccountManager
          key={manageChannel.id}
          channel={manageChannel}
          accounts={channelAccounts(accounts, manageChannel.id)}
          connecting={connectingPlatform === manageChannel.id}
          busyAccountId={busyAccountId}
          onClose={() => setManageChannel(null)}
          onConnect={(account) => handleConnect(manageChannel, account)}
          onDisconnect={handleDisconnect}
          onRefresh={handleRefresh}
          renderTargets={(account) => <AccountTargets account={account} />}
        />
      )}
      {connectPrompt && (
        <ConnectChannelDialog
          key={`${connectPrompt.channel.id}:${connectPrompt.hint}`}
          channel={connectPrompt.channel}
          hint={connectPrompt.hint}
          loading={connectingPlatform === connectPrompt.channel.id}
          onClose={() => setConnectPrompt(null)}
          onSubmit={(options) =>
            startConnection(connectPrompt.channel, options)
          }
        />
      )}
      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="max-h-[85dvh] overflow-y-auto rounded-3xl p-6 sm:max-w-lg">
          <DialogTitle className="font-sans text-xl font-semibold leading-normal">
            Grow your circle
          </DialogTitle>
          <DialogDescription className="text-xs leading-relaxed">
            Choose a channel to connect. You can add multiple accounts to each
            one.
          </DialogDescription>
          <div className="grid gap-2 sm:grid-cols-2">
            {CHANNELS.filter((channel) => !channel.comingSoon).map(
              (channel) => (
                <button
                  key={channel.id}
                  type="button"
                  onClick={() => handleConnect(channel)}
                  disabled={!!connectingPlatform || !!busyAccountId}
                  className="flex items-center gap-3 rounded-2xl border border-border p-3 text-left transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:opacity-50"
                >
                  <ChannelIcon channel={channel} small />
                  <span className="text-xs font-semibold">{channel.name}</span>
                  <ArrowUpRight className="ml-auto size-3.5 shrink-0 text-muted-foreground" />
                </button>
              ),
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function ChannelsView() {
  return (
    <Suspense
      fallback={
        <ChannelsPanel
          accounts={[]}
          loading
          connectingPlatform={null}
          onRefresh={() => {}}
          onConnect={() => {}}
          onManage={() => {}}
          onAdd={() => {}}
        />
      }
    >
      <ChannelsViewContent />
    </Suspense>
  );
}
