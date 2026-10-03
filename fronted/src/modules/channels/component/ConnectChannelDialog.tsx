"use client";

import { useState } from "react";
import { ArrowUpRight, Loader2, ShieldCheck } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { connectionOptions, type ChannelConfig } from "../channel-config";
import ChannelIcon from "./ChannelIcon";
import { channelButton } from "./ChannelCard";

export default function ConnectChannelDialog({ channel, hint = "", loading, onClose, onSubmit }: {
  channel: ChannelConfig;
  hint?: string;
  loading: boolean;
  onClose: () => void;
  onSubmit: (options: Record<string, string>) => void;
}) {
  const [value, setValue] = useState(hint);
  const [error, setError] = useState("");
  const bluesky = channel.id === "bluesky";
  return <Dialog open onOpenChange={(open) => { if (!open && !loading) onClose(); }}>
    <DialogContent className="rounded-3xl p-6 sm:max-w-md" showCloseButton={!loading}>
      <ChannelIcon channel={channel} />
      <DialogTitle className="font-sans text-xl font-semibold leading-normal">Connect {channel.name}</DialogTitle>
      <DialogDescription className="text-xs leading-relaxed">{bluesky ? "Enter your handle so we can take you to the right sign-in page." : "Enter the instance where your Mastodon account lives."}</DialogDescription>
      <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); try { const options = connectionOptions(channel.id, value); setError(""); onSubmit(options); } catch (err) { setError(err instanceof Error ? err.message : "Check your account details."); } }}>
        <label className="block space-y-2 text-xs font-medium"><span>{bluesky ? "Bluesky handle" : "Instance domain"}</span><input autoComplete="off" spellCheck={false} required disabled={loading} value={value} onChange={(event) => setValue(event.target.value)} aria-invalid={!!error} aria-describedby={error ? "channel-connect-error" : undefined} placeholder={bluesky ? "you.bsky.social" : "mastodon.social"} className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-emerald-500/30" /></label>
        {error && <p id="channel-connect-error" role="alert" className="text-xs text-red-600">{error}</p>}
        <button type="submit" disabled={loading || !value.trim()} className={cn(channelButton, "w-full border-transparent bg-foreground text-background hover:bg-foreground/85")}>{loading ? <Loader2 className="size-4 animate-spin" /> : <ArrowUpRight className="size-4" />}{loading ? "Connecting…" : `Continue to ${channel.name}`}</button>
      </form>
      <p className="flex items-center gap-2 text-[10px] text-muted-foreground"><ShieldCheck className="size-3.5" />You’ll sign in securely with your provider.</p>
    </DialogContent>
  </Dialog>;
}
