"use client";
import Link from "next/link";
import { useState } from "react";
import { Check, ChevronDown, Plus } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import AccountAvatar from "@/modules/channels/component/AccountAvatar";
import type { Account } from "@/modules/studio/types";
import { profileFor } from "./model";
import { cn } from "@/lib/utils";

const PLATFORM_BADGE_STYLES: Record<string, string> = {
  linkedin: "bg-[#0a66c2] text-white rounded-[3px] text-[11px]",
  reddit: "text-[#ed5825]",
  bluesky: "text-[#0285ff]",
  mastodon: "text-[#6364ff]",
  facebook: "text-[#1877f2]",
  instagram: "text-[#d94982]",
  x: "text-foreground",
};

export function PlatformMark({
  platform,
  className,
}: {
  platform: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center font-semibold w-[17px] h-[17px] text-[13px] tracking-[-0.8px] leading-none shrink-0",
        PLATFORM_BADGE_STYLES[platform] ?? "text-foreground",
        className,
      )}
      aria-label={profileFor(platform).name}
    >
      {platform === "x"
        ? "𝕏"
        : platform === "linkedin"
          ? "in"
          : platform === "reddit"
            ? "r/"
            : profileFor(platform).name.slice(0, 1)}
    </span>
  );
}

export function AccountSwitcher({
  accounts,
  account,
  onSelect,
}: {
  accounts: Account[];
  account: Account;
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className="flex items-center gap-1 sm:gap-2 min-w-0 text-left w-auto p-0 cursor-pointer rounded-lg hover:bg-muted/50 transition-colors"
        aria-label="Switch active account"
      >
        <AccountAvatar
          key={account.id}
          account={account}
          className="size-[26px] hidden sm:inline-flex text-[10px] shrink-0"
        />
        <div className="min-w-0 flex-1">
          <strong className="block truncate text-[11px] sm:text-xs font-semibold max-w-[100px] sm:max-w-[190px]">
            {account.display_name}
          </strong>
        </div>
        <ChevronDown size={14} className="text-muted-foreground shrink-0" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-2">
        <p className="px-2 py-2 text-xs font-medium text-muted-foreground">
          Switch writing account
        </p>
        <div className="max-h-72 overflow-y-auto space-y-0.5">
          {accounts.map((item) => (
            <button
              className="flex items-center gap-2.5 p-2.5 w-full text-left rounded-lg hover:bg-muted transition-colors cursor-pointer"
              aria-pressed={item.id === account.id}
              key={item.id}
              onClick={() => {
                onSelect(item.id);
                setOpen(false);
              }}
            >
              <AccountAvatar
                account={item}
                className="size-9 text-xs shrink-0"
              />
              <div className="min-w-0 flex-1">
                <strong className="text-xs block truncate font-semibold">
                  {item.display_name}
                </strong>
                <span className="block text-[11px] text-muted-foreground mt-0.5">
                  {profileFor(item.platform).name} ·{" "}
                  {item.status === "active"
                    ? "Connected"
                    : item.status === "disabled"
                      ? "Disabled"
                      : "Reconnect needed"}
                </span>
              </div>
              {item.id === account.id && (
                <Check size={15} className="shrink-0 text-primary" />
              )}
            </button>
          ))}
        </div>
        <Link
          className="flex items-center gap-1.5 border-t border-border pt-3.5 px-2.5 pb-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          href="/dashboard/channels"
        >
          <Plus size={14} />
          Connect or manage accounts
        </Link>
      </PopoverContent>
    </Popover>
  );
}
