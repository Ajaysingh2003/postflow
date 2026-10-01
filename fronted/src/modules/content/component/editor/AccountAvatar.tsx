/* eslint-disable @next/next/no-img-element */
"use client";
import { useState } from "react";
import type { LinkedInConnectionData } from "@/modules/workspace/server/procedures";
export function accountName(account?: LinkedInConnectionData | null) {
  return (
    [account?.first_name, account?.last_name].filter(Boolean).join(" ") ||
    account?.public_identifier ||
    "Connect LinkedIn"
  );
}
export default function AccountAvatar({
  account,
  large = false,
}: { 
  account?: LinkedInConnectionData | null;
  large?: boolean;
}) {

  console.log(account,"leah jaye")
  const [failed, setFailed] = useState<string | null>(null);
  return (
    <span
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-100 text-sm font-medium text-slate-500 ${large ? "size-12" : "size-8"}`}
    >
      {account?.picture_url && failed !== account.picture_url ? (
        <img
          src={account.picture_url}
          alt=""
          referrerPolicy="no-referrer"
          onError={() => setFailed(account.picture_url!)}
          className="size-full object-cover"
        />
      ) : account ? (
        accountName(account).slice(0, 2).toUpperCase()
      ) : (
        "in"
      )}
    </span>
  );
}
