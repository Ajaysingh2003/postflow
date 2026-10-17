import React from "react";
import Image from "next/image";
import { Mail } from "lucide-react";
import { cn } from "@/lib/utils";

export type PlatformId =
  | "x"
  | "X"
  | "twitter"
  | "Twitter"
  | "linkedin"
  | "LinkedIn"
  | "threads"
  | "Threads"
  | "facebook"
  | "Facebook"
  | "instagram"
  | "Instagram"
  | "reddit"
  | "Reddit"
  | "tiktok"
  | "TikTok"
  | "newsletter"
  | (string & {});

const PLATFORM_IMAGE_MAP: Record<string, { src: string; alt: string }> = {
  x: { src: "/channels/x.jpeg", alt: "X" },
  twitter: { src: "/channels/x.jpeg", alt: "X" },
  linkedin: { src: "/channels/linkedin.svg", alt: "LinkedIn" },
  threads: { src: "/channels/threads.svg", alt: "Threads" },
  instagram: { src: "/channels/instagram.svg", alt: "Instagram" },
  facebook: { src: "/channels/facebook.png", alt: "Facebook" },
  reddit: { src: "/channels/reddit.svg", alt: "Reddit" },
  tiktok: { src: "/channels/tiktok.svg", alt: "TikTok" },
};

export interface PlatformBadgeProps {
  platform?: PlatformId;
  id?: PlatformId;
  className?: string;
  size?: "xs" | "sm" | "md" | "lg";
  title?: string;
}

const SIZE_MAP = {
  xs: "size-3.5 rounded-[4px]",
  sm: "size-4 rounded-[5px]",
  md: "size-6 rounded-lg",
  lg: "size-8 rounded-lg",
};

export function PlatformBadge({
  platform,
  id,
  className,
  size,
  title,
}: PlatformBadgeProps) {
  const rawKey = (platform ?? id ?? "").toString().toLowerCase().trim();

  if (rawKey === "newsletter") {
    return (
      <span
        className={cn(
          "inline-flex shrink-0 items-center justify-center rounded-md bg-emerald-50 text-emerald-600 ring-1 ring-emerald-500/20",
          size ? SIZE_MAP[size] : "size-4.5",
          className,
        )}
        title={title ?? "Newsletter"}
      >
        <Mail className="size-2.5" />
      </span>
    );
  }

  const asset = PLATFORM_IMAGE_MAP[rawKey] ?? PLATFORM_IMAGE_MAP.x;
  const displayTitle = title ?? asset.alt;

  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden border border-black/5 shadow-2xs",
        size ? SIZE_MAP[size] : "size-4 rounded-[5px]",
        rawKey === "x" ? "bg-black" : "",
        className,
      )}
      title={displayTitle}
    >
      <Image
        src={asset.src}
        alt={asset.alt}
        width={32}
        height={32}
        className="size-full object-cover rounded-[inherit]"
      />
    </span>
  );
}

export default PlatformBadge;
