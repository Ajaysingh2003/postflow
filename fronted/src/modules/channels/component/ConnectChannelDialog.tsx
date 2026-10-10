"use client";

import { useState } from "react";
import { ArrowUpRight, AtSign, Globe, Loader2, ShieldCheck } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { connectionOptions, type ChannelConfig } from "../channel-config";
import ChannelIcon from "./ChannelIcon";
import { channelButton } from "./ChannelCard";

interface ConnectChannelDialogProps {
  channel: ChannelConfig;
  hint?: string;
  loading: boolean;
  onClose: () => void;
  onSubmit: (options: Record<string, string>) => void;
}

export default function ConnectChannelDialog({
  channel,
  hint = "",
  loading,
  onClose,
  onSubmit,
}: ConnectChannelDialogProps) {
  const [value, setValue] = useState(hint);
  const [error, setError] = useState("");
  const bluesky = channel.id === "bluesky";

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!value.trim() || loading) return;

    try {
      const options = connectionOptions(channel.id, value.trim());
      setError("");
      onSubmit(options);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Check your account details.",
      );
    }
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !loading) onClose();
      }}
    >
      <DialogContent
        className="w-full sm:max-w-[420px] rounded-2xl sm:rounded-2xl p-6 border-border/80 bg-background/95 shadow-xl backdrop-blur-md"
        showCloseButton={!loading}
      >
        {/* Header Section */}
        <DialogHeader className="flex flex-col items-center text-center space-y-3 pb-1">
          <div className="flex size-12 items-center justify-center rounded-xl border border-border/80 bg-muted/40 shadow-2xs">
            <ChannelIcon channel={channel}  />
          </div>

          <div className="space-y-1.5">
            <DialogTitle className="font-heading text-lg font-semibold tracking-tight text-foreground">
              Connect {channel.name}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground leading-relaxed max-w-xs mx-auto">
              {bluesky
                ? "Enter your Bluesky handle to authenticate with your provider."
                : "Enter your Mastodon instance domain to begin connection."}
            </DialogDescription>
          </div>
        </DialogHeader>

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="mt-2 space-y-4">
          <div className="space-y-2">
            <label
              htmlFor="channel-identifier"
              className="text-xs font-medium text-foreground/90 block"
            >
              {bluesky ? "Account handle" : "Instance domain"}
            </label>

            <div className="relative flex items-center">
              <span className="pointer-events-none absolute left-3.5 text-muted-foreground">
                {bluesky ? (
                  <AtSign className="size-4" />
                ) : (
                  <Globe className="size-4" />
                )}
              </span>

              <input
                id="channel-identifier"
                autoComplete="off"
                spellCheck={false}
                autoFocus
                required
                disabled={loading}
                value={value}
                onChange={(e) => {
                  setValue(e.target.value);
                  if (error) setError("");
                }}
                aria-invalid={!!error}
                aria-describedby={error ? "channel-connect-error" : undefined}
                placeholder={bluesky ? "handle.bsky.social" : "mastodon.social"}
                className={cn(
                  "h-10 w-full rounded-xl border border-border/80 bg-background/60 pl-10 pr-3.5 text-xs text-foreground placeholder:text-muted-foreground/60 shadow-2xs outline-none transition-all",
                  "focus:border-emerald-500/40 focus:ring-2 focus:ring-emerald-500/20",
                  "disabled:opacity-50 disabled:cursor-not-allowed",
                  error && "border-destructive/80 focus:ring-destructive/20 focus:border-destructive",
                )}
              />
            </div>

            {error && (
              <p
                id="channel-connect-error"
                role="alert"
                className="text-[11px] font-medium text-destructive transition-all"
              >
                {error}
              </p>
            )}
          </div>

          {/* Action Button */}
          <Button
            type="submit"
            disabled={loading || !value.trim()}
            className={cn(
              channelButton,
              "w-full h-10 rounded-xl font-medium text-xs shadow-xs transition-all",
              "primary-btn",
            )}
          >
            {loading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <ArrowUpRight className="size-4" />
            )}
            <span>{loading ? "Redirecting…" : `Continue to ${channel.name}`}</span>
          </Button>
        </form>

        {/* Security Reassurance Footer */}
        <div className="mt-1 pt-3 border-t border-border/50 flex items-center justify-center gap-2 text-[11px] text-muted-foreground">
          <ShieldCheck className="size-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>You will sign in securely on the official provider website.</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}