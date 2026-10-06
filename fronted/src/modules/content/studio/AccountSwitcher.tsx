// "use client";
// import Link from "next/link";
// import { useState } from "react";
// import { Check, ChevronDown, Plus } from "lucide-react";
// import {
//   Popover,
//   PopoverContent,
//   PopoverTrigger,
// } from "@/components/ui/popover";
// import AccountAvatar from "@/modules/channels/component/AccountAvatar";
// import type { Account } from "@/modules/studio/types";
// import { profileFor } from "./model";
// import { cn } from "@/lib/utils";

// const PLATFORM_BADGE_STYLES: Record<string, string> = {
//   linkedin: "bg-[#0a66c2] text-white rounded-[3px] text-[11px]",
//   reddit: "text-[#ed5825]",
//   bluesky: "text-[#0285ff]",
//   mastodon: "text-[#6364ff]",
//   facebook: "text-[#1877f2]",
//   instagram: "text-[#d94982]",
//   x: "text-foreground",
// };

// export function PlatformMark({
//   platform,
//   className,
// }: {
//   platform: string;
//   className?: string;
// }) {
//   return (
//     <span
//       className={cn(
//         "inline-flex items-center justify-center font-semibold w-[17px] h-[17px] text-[13px] tracking-[-0.8px] leading-none shrink-0",
//         PLATFORM_BADGE_STYLES[platform] ?? "text-foreground",
//         className,
//       )}
//       aria-label={profileFor(platform).name}
//     >
//       {platform === "x"
//         ? "𝕏"
//         : platform === "linkedin"
//           ? "in"
//           : platform === "reddit"
//             ? "r/"
//             : profileFor(platform).name.slice(0, 1)}
//     </span>
//   );
// }

// export function AccountSwitcher({
//   accounts,
//   account,
//   onSelect,
// }: {
//   accounts: Account[];
//   account: Account;
//   onSelect: (id: string) => void;
// }) {
//   const [open, setOpen] = useState(false);
//   return (
//     <Popover open={open} onOpenChange={setOpen}>
//       <PopoverTrigger
//         className="flex items-center gap-1 sm:gap-2 min-w-0 text-left w-auto p-0 cursor-pointer rounded-lg hover:bg-muted/50 transition-colors"
//         aria-label="Switch active account"
//       >
//         <AccountAvatar
//           key={account.id}
//           account={account}
//           className="size-[26px] hidden sm:inline-flex text-[10px] shrink-0"
//         />
//         <div className="min-w-0 flex-1">
//           <strong className="block truncate text-[11px] sm:text-xs font-semibold max-w-[100px] sm:max-w-[190px]">
//             {account.display_name}
//           </strong>
//         </div>
//         <ChevronDown size={14} className="text-muted-foreground shrink-0" />
//       </PopoverTrigger>
//       <PopoverContent align="start" className="w-80 p-2">
//         <p className="px-2 py-2 text-xs font-medium text-muted-foreground">
//           Switch writing account
//         </p>
//         <div className="max-h-72 overflow-y-auto space-y-0.5">
//           {accounts.map((item) => (
//             <button
//               className="flex items-center gap-2.5 p-2.5 w-full text-left rounded-lg hover:bg-muted transition-colors cursor-pointer"
//               aria-pressed={item.id === account.id}
//               key={item.id}
//               onClick={() => {
//                 onSelect(item.id);
//                 setOpen(false);
//               }}
//             >
//               <AccountAvatar
//                 account={item}
//                 className="size-9 text-xs shrink-0"
//               />
//               <div className="min-w-0 flex-1">
//                 <strong className="text-xs block truncate font-semibold">
//                   {item.display_name}
//                 </strong>
//                 <span className="block text-[11px] text-muted-foreground mt-0.5">
//                   {profileFor(item.platform).name} ·{" "}
//                   {item.status === "active"
//                     ? "Connected"
//                     : item.status === "disabled"
//                       ? "Disabled"
//                       : "Reconnect needed"}
//                 </span>
//               </div>
//               {item.id === account.id && (
//                 <Check size={15} className="shrink-0 text-primary" />
//               )}
//             </button>
//           ))}
//         </div>
//         <Link
//           className="flex items-center gap-1.5 border-t border-border pt-3.5 px-2.5 pb-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
//           href="/dashboard/channels"
//         >
//           <Plus size={14} />
//           Connect or manage accounts
//         </Link>
//       </PopoverContent>
//     </Popover>
//   );
// }
"use client";
import Link from "next/link";
import { useState } from "react";
import { Check, ChevronDown, Settings2 } from "lucide-react";
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

const STATUS_META: Record<
  string,
  { label: string; dot: string; text: string }
> = {
  active: {
    label: "Connected",
    dot: "bg-emerald-500",
    text: "text-muted-foreground",
  },
  disabled: {
    label: "Disabled",
    dot: "bg-muted-foreground/40",
    text: "text-muted-foreground",
  },
  reconnect: {
    label: "Reconnect needed",
    dot: "bg-amber-500",
    text: "text-amber-600 dark:text-amber-400",
  },
};

function statusFor(status: string) {
  return STATUS_META[status] ?? STATUS_META.reconnect;
}

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

/** Avatar with a small platform badge pinned to its corner. */
function AvatarWithPlatform({
  account,
  className,
  badgeClassName,
}: {
  account: Account;
  className?: string;
  badgeClassName?: string;
}) {
  return (
    <span className="relative inline-flex shrink-0">
      <AccountAvatar
        key={account.id}
        account={account}
        className={className}
      />
      <span
        className={cn(
          "absolute -bottom-1 -right-1 grid place-items-center rounded-full bg-popovezr ring-0 ring-popoverz",
          badgeClassName,
        )}
      >
        <PlatformMark
          platform={account.platform}
          className="scale-[0.72] origin-center"
        />
      </span>
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
  const activeStatus = statusFor(account.status);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        aria-label="Switch active account"
        className={cn(
          "group flex items-center gap-2 min-w-0 h-9 pl-1.5 pr-2.5 text-left cursor-pointer",
          "rounded-full border border-border bg-card shadow-xs",
          "hover:bg-muted/60 hover:border-foreground/15 transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          "data-[state=open]:bg-muted/60 data-[state=open]:border-foreground/20",
        )}
      >
        <AvatarWithPlatform
          account={account}
          className="size-6 text-[10px]"
          badgeClassName="size-3.5"
        />
        <strong className="block truncate text-xs font-semibold max-w-[90px] sm:max-w-[170px]">
          {account.display_name}
        </strong>
        {account.status !== "active" && (
          <span
            className={cn("size-1.5 rounded-full shrink-0", activeStatus.dot)}
            title={activeStatus.label}
          />
        )}
        <ChevronDown
          size={14}
          className="text-muted-foreground shrink-0 transition-transform duration-200 group-data-[state=open]:rotate-180"
        />
      </PopoverTrigger>

      <PopoverContent
        align="start"
        sideOffset={8}
        className="w-[min(20rem,calc(100vw-2rem))] p-0 overflow-hidden rounded-xl shadow-lg"
      >
        <div className="flex items-baseline justify-between px-4 pt-3.5 pb-2">
          <p className="text-sm font-semibold">Writing as</p>
          <span className="text-xs text-muted-foreground tabular-nums">
            {accounts.length} {accounts.length === 1 ? "account" : "accounts"}
          </span>
        </div>

        <div
          role="listbox"
          aria-label="Accounts"
          className="max-h-72 overflow-y-auto px-2 pb-2 space-y-0.5"
        >
          {accounts.map((item) => {
            const selected = item.id === account.id;
            const status = statusFor(item.status);
            return (
              <button
                key={item.id}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => {
                  onSelect(item.id);
                  setOpen(false);
                }}
                className={cn(
                  "flex items-center gap-3 w-full p-2 text-left rounded-lg cursor-pointer transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
                  selected
                    ? "bg-primary/[0.07]"
                    : "hover:bg-muted active:bg-muted/80",
                  item.status === "disabled" && !selected && "opacity-70",
                )}
              >
                <AvatarWithPlatform
                  account={item}
                  className="size-9 text-xs"
                  badgeClassName="size-4"
                />
                <div className="min-w-0 flex-1">
                  <strong className="block truncate text-[13px] font-semibold leading-tight">
                    {item.display_name}
                  </strong>
                  <span className="mt-1 flex items-center gap-1.5 text-[11px] leading-none">
                    <span
                      className={cn(
                        "size-1.5 rounded-full shrink-0",
                        status.dot,
                      )}
                    />
                    <span className="text-muted-foreground">
                      {profileFor(item.platform).name}
                    </span>
                    <span className="text-border" aria-hidden>
                      |
                    </span>
                    <span className={cn("truncate", status.text)}>
                      {status.label}
                    </span>
                  </span>
                </div>
                <span
                  className={cn(
                    "grid place-items-center size-5 rounded-full shrink-0 transition-all",
                    selected
                      ? "bg-primary text-primary-foreground scale-100"
                      : "scale-90 opacity-0",
                  )}
                  aria-hidden
                >
                  <Check size={12} strokeWidth={3} />
                </span>
              </button>
            );
          })}
        </div>

        <Link
          href="/dashboard/channels"
          onClick={() => setOpen(false)}
          className={cn(
            "flex items-center gap-2.5 px-4 py-3 text-xs font-medium",
            "border-t border-border bg-muted/40 text-muted-foreground",
            "hover:bg-muted hover:text-foreground transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/60",
          )}
        >
          <Settings2 size={14} />
          Connect or manage accounts
        </Link>
      </PopoverContent>
    </Popover>
  );
}