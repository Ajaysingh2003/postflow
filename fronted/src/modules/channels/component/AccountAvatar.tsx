"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { Account } from "@/modules/studio/types";

/**
 * Extracts a profile picture/avatar URL from an account across any supported social platform.
 */
export function getAccountAvatarUrl(account?: Account | null): string | null {
  if (!account) return null;

  // Direct avatar_url from backend response
  if (typeof account.avatar_url === "string" && account.avatar_url.trim()) {
    return account.avatar_url.trim().replace(/&amp;/g, "&");
  }

  const meta = account.account_metadata;
  if (!meta || typeof meta !== "object") return null;

  // Common direct string properties across platforms
  const stringCandidates = [
    meta.avatar_url,
    meta.profile_image_url,
    meta.picture_url,
    meta.avatar,
    meta.icon_img,
    meta.threads_profile_picture_url,
    meta.primary_profile_picture_url,
  ];

  for (const candidate of stringCandidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim().replace(/&amp;/g, "&");
    }
  }

  // Meta/Facebook picture (string or { data: { url: string } })
  if (typeof meta.picture === "string" && meta.picture.trim()) {
    return meta.picture.trim().replace(/&amp;/g, "&");
  }
  if (
    typeof meta.picture === "object" &&
    meta.picture !== null &&
    "data" in meta.picture
  ) {
    const dataObj = (meta.picture as { data?: unknown }).data;
    if (
      typeof dataObj === "object" &&
      dataObj !== null &&
      "url" in dataObj &&
      typeof (dataObj as { url?: unknown }).url === "string"
    ) {
      const url = (dataObj as { url: string }).url.trim();
      if (url) return url.replace(/&amp;/g, "&");
    }
  }

  // Instagram business accounts list
  if (Array.isArray(meta.instagram_accounts) && meta.instagram_accounts.length > 0) {
    const firstIg = meta.instagram_accounts[0];
    if (
      typeof firstIg === "object" &&
      firstIg !== null &&
      typeof firstIg.profile_picture_url === "string" &&
      firstIg.profile_picture_url.trim()
    ) {
      return firstIg.profile_picture_url.trim().replace(/&amp;/g, "&");
    }
  }

  return null;
}

export default function AccountAvatar({
  account,
  name: explicitName,
  avatarUrl: explicitAvatarUrl,
  className,
  fallbackClassName,
}: {
  account?: Account | null;
  name?: string;
  avatarUrl?: string | null;
  className?: string;
  fallbackClassName?: string;
}) {
  const [error, setError] = useState(false);

  const name = explicitName || account?.display_name || "Account";
  const avatarUrl = explicitAvatarUrl ?? getAccountAvatarUrl(account);
  const initials = name.replace(/^@/, "").slice(0, 2).toUpperCase();

  const showImage = Boolean(avatarUrl && !error);

  return (
    <div
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-neutral-200 text-neutral-700 dark:bg-white/15 dark:text-neutral-200",
        className,
      )}
    >
      {showImage ? (
        <img
          src={avatarUrl!}
          alt={name}
          referrerPolicy="no-referrer"
          onError={() => setError(true)}
          className="size-full rounded-full object-cover"
        />
      ) : (
        <span
          className={cn(
            "font-semibold uppercase select-none",
            fallbackClassName,
          )}
        >
          {initials}
        </span>
      )}
    </div>
  );
}
