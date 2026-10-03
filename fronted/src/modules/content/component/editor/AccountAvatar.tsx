/* eslint-disable @next/next/no-img-element */
"use client";
import { useState } from "react";
import type { LinkedInConnectionData } from "@/modules/workspace/server/procedures";
export function accountName(account?: (LinkedInConnectionData & { display_name?: string }) | null) {
  if (!account) return "Connect Account";
  if (account.display_name) return account.display_name;
  return (
    [account.first_name, account.last_name].filter(Boolean).join(" ") ||
    account.public_identifier ||
    "Connected Account"
  );
}

export default function AccountAvatar({
  account,
  large = false,
}: { 
  account?: (LinkedInConnectionData & { avatar_url?: string | null; account_metadata?: Record<string, any> }) | null;
  large?: boolean;
}) {
  const [failed, setFailed] = useState<string | null>(null);
  const picUrl =
    account?.avatar_url ||
    account?.picture_url ||
    account?.account_metadata?.avatar_url ||
    account?.account_metadata?.profile_image_url ||
    (typeof account?.account_metadata?.picture === "string" ? account?.account_metadata?.picture : undefined);

  return (
    <span
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-100 text-sm font-medium text-slate-500 ${large ? "size-12" : "size-8"}`}
    >
      {picUrl && failed !== picUrl ? (
        <img
          src={picUrl}
          alt=""
          referrerPolicy="no-referrer"
          onError={() => setFailed(picUrl)}
          className="size-full object-cover"
        />
      ) : account ? (
        accountName(account).replace(/^@/, "").slice(0, 2).toUpperCase()
      ) : (
        "PF"
      )}
    </span>
  );
}
