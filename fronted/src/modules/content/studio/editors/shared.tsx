"use client";
import {
  useLayoutEffect,
  useRef,
  type TextareaHTMLAttributes,
  type ReactNode,
} from "react";
import { Textarea } from "@/components/ui/textarea";
import AccountAvatar from "@/modules/channels/component/AccountAvatar";
import type { Account } from "@/modules/studio/types";
import { textLength } from "../model";
import type { EditorProps } from "./types";

import { cn } from "@/lib/utils";

export function refineCurrentPost(
  anchor: HTMLElement,
  onRefine: EditorProps["onRefine"],
  index = 0,
) {
  const textarea = anchor
    .closest("article, [data-reddit-editor]")
    ?.querySelector("textarea");
  const start = textarea?.selectionStart;
  const end = textarea?.selectionEnd;
  onRefine(
    start != null && end != null && end > start
      ? textarea!.value.slice(start, end)
      : undefined,
    index,
    start,
    end,
    anchor,
  );
}

export function GrowingText({
  value,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const element = ref.current;
    if (element) {
      element.style.height = "auto";
      element.style.height = `${element.scrollHeight}px`;
    }
  }, [value]);
  return (
    <Textarea
      ref={ref}
      value={value}
      rows={3}
      {...props}
      className={`rounded-none border-0 shadow-none focus-visible:ring-0 ${props.className ?? ""}`}
    />
  );
}

export function Author({
  account,
  secondary,
  avatar,
}: {
  account: Account;
  secondary?: string;
  avatar?: ReactNode;
}) {
  const handle =
    account.account_metadata.username ?? account.account_metadata.handle;
  const name = account.display_name.replace(/\s*\(@[^)]+\)$/, "");
  return (
    <div className="flex items-center gap-[11px]">
      {avatar ?? (
        <AccountAvatar
          key={account.id}
          account={account}
          className="size-11 text-sm"
        />
      )}
      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline gap-1.5">
          <strong className="text-[15px] font-semibold tracking-[-0.3px] text-foreground">
            {name}
          </strong>
          {!!handle && (
            <span className="text-xs text-muted-foreground">
              @{String(handle).replace(/^@/, "")}
            </span>
          )}
        </div>
        {secondary && (
          <p className="mt-[3px] text-[11px] text-muted-foreground">{secondary}</p>
        )}
      </div>
    </div>
  );
}

export function Counter({
  text,
  platform,
  limit,
  counting,
}: {
  text: string;
  platform: string;
  limit: number;
  counting?: unknown;
}) {
  const count = textLength(text, platform, counting);
  return (
    <span
      title={`${count} of ${limit} characters`}
      className={cn(
        "flex items-center gap-[7px] text-[10px] tabular-nums",
        count > limit ? "text-destructive font-medium" : "text-muted-foreground",
      )}
    >
      <span>
        {count.toLocaleString()}{" "}
        <span className="opacity-50">/ {limit.toLocaleString()}</span>
      </span>
      <svg width="19" height="19" viewBox="0 0 20 20" aria-hidden="true" className="opacity-75">
        <circle
          cx="10"
          cy="10"
          r="7"
          fill="none"
          stroke="currentColor"
          strokeOpacity=".15"
          strokeWidth="2"
        />
        <circle
          cx="10"
          cy="10"
          r="7"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeDasharray={`${Math.min(count / limit, 1) * 44} 44`}
          transform="rotate(-90 10 10)"
        />
      </svg>
    </span>
  );
}
