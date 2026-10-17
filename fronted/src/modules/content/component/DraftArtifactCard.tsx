"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronsRight, Copy, Diff, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import type { DraftArtifact } from "../agentStream";
import { PlatformBadge } from "@/modules/home/component/PlatformBadge";

/** Compact line diff: preserve common edges and highlight the changed region. */
export function draftDiff(before: string, after: string) {
  const a = before.split("\n"),
    b = after.split("\n");
  let start = 0,
    end = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start++;
  while (
    end < a.length - start &&
    end < b.length - start &&
    a[a.length - 1 - end] === b[b.length - 1 - end]
  )
    end++;
  return {
    prefix: a.slice(0, start),
    removed: a.slice(start, a.length - end),
    added: b.slice(start, b.length - end),
    suffix: end ? a.slice(a.length - end) : [],
  };
}


const SMALL_BTN = "!min-h-8 !rounded-lg !px-3 !text-[14px]";

export function DraftArtifactCard({
  artifact,
  content,
  ready,
  replace,
  platform,
  limit = 3000,
  readOnlyReason,
}: {
  artifact: DraftArtifact;
  content: string;
  ready: boolean;
  replace: (expected: string, replacement: string) => void;
  /** Shows the network badge in the header of the card. */
  platform?: "linkedin" | "x";
  /** Character limit; the count only appears once the draft nears it. */
  limit?: number;
  readOnlyReason?: string;
}) {
  const [compare, setCompare] = useState(false);
  const [applied, setApplied] = useState(false);
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (copyTimer.current) clearTimeout(copyTimer.current);
    },
    [],
  );

  const conflict = content !== (applied ? artifact.content : artifact.original);
  const diff = compare ? draftDiff(artifact.original, artifact.content) : null;
  const length = artifact.content.length;
  const nearLimit = length >= limit * 0.9;

  function toggleApplied() {
    replace(
      applied ? artifact.content : artifact.original,
      applied ? artifact.original : artifact.content,
    );
    setApplied(!applied);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(artifact.content);
      setCopied(true);
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error("Could not copy suggestion");
    }
  }

  return (
    <section
      aria-label={artifact.title || "Draft suggestion"}
      className="overflow-hidden rounded-2xl bg-white shadow-[0_1px_2px_rgba(16,24,40,0.05),0_4px_12px_rgba(16,24,40,0.04),0_0_0_0.5px_rgba(16,24,40,0.12)]"
    >
      {/* Header */}
      <div className="flex h-10 items-center justify-between border-b-[0.5px] border-black/10 bg-[#f7f8f9] px-4">
        <span className="font-subheading truncate text-[13px] font-medium text-[#6b737d]">
          {artifact.title || "Suggested draft"}
        </span>
        <div className="flex shrink-0 items-center gap-2.5">
          {nearLimit && (
            <span
              className={` text-[12px] tabular-nums ${length > limit ? "font-medium text-rose-600" : "text-[#8a929c]"}`}
            >
              {length}/{limit}
            </span>
          )}
          {platform && <PlatformBadge platform={platform} size="xs" />}
        </div>
      </div>

      {/* Body */}
      <div className="px-4 py-4">
        {diff ? (
          <div className="space-y-1.5 text-[15px] leading-[1.6] text-[#111418]">
            {diff.prefix.length > 0 && (
              <div className="whitespace-pre-wrap break-words px-2.5 text-[#6b737d]">
                {diff.prefix.join("\n")}
              </div>
            )}
            {diff.removed.length > 0 && (
              <del className="flex gap-2.5 whitespace-pre-wrap break-words rounded-lg bg-rose-50 px-2.5 py-1.5 text-rose-900 no-underline">
                <span aria-hidden className="select-none  text-rose-400">
                  −
                </span>
                <span>{diff.removed.join("\n") || "(empty line)"}</span>
              </del>
            )}
            {diff.added.length > 0 && (
              <ins className="flex gap-2.5 whitespace-pre-wrap break-words rounded-lg bg-emerald-50 px-2.5 py-1.5 text-emerald-900 no-underline">
                <span aria-hidden className="select-none  text-emerald-500">
                  +
                </span>
                <span>{diff.added.join("\n") || "(empty line)"}</span>
              </ins>
            )}
            {diff.suffix.length > 0 && (
              <div className="whitespace-pre-wrap break-words px-2.5 text-[#6b737d]">
                {diff.suffix.join("\n")}
              </div>
            )}
          </div>
        ) : (
          <div className="whitespace-pre-wrap break-words text-[15px] leading-[1.65] text-[#111418]">
            {artifact.content}
          </div>
        )}

        {artifact.summary && (
          <p className="mt-3.5 text-[13.5px] leading-[1.55] text-[#7d858f]">
            {artifact.summary}
          </p>
        )}
      </div>

      {/* Status */}
      {readOnlyReason ? (
        <p
          role="status"
          className="border-t border-black/10 px-4 py-2.5 text-xs leading-5 text-muted-foreground"
        >
          {readOnlyReason}
        </p>
      ) : conflict ? (
        <p
          role="status"
          className="border-t-[0.5px] border-amber-200 bg-amber-50/70 px-4 py-2.5 text-[13.5px] leading-[1.5] text-amber-900"
        >
          Your draft has changed. Copy this suggestion or ask for a fresh
          revision.
        </p>
      ) : applied ? (
        <p className="flex items-center gap-1.5 border-t-[0.5px] border-black/10 px-4 py-2.5 text-[13.5px] text-[#6b737d]">
          <Check className="size-3.5 stroke-[2] text-emerald-600" />
          Applied to your draft. Save when ready.
        </p>
      ) : null}

      {/* Actions */}
      <div className="flex items-center justify-between gap-2 border-t-[0.5px] border-black/10 bg-[#fbfbfc] px-3 py-2.5">
        <button
          type="button"
          onClick={copy}
          aria-label="Copy suggestion"
          className={`secondary-btn ${SMALL_BTN}`}
        >
          {copied ? (
            <Check className="size-3.5 stroke-[2]" />
          ) : (
            <Copy className="size-3.5 stroke-[1.8]" />
          )}
          {copied ? "Copied" : "Copy"}
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-pressed={compare}
            onClick={() => setCompare((value) => !value)}
            className={`secondary-btn ${SMALL_BTN} aria-pressed:!bg-[#f0f0ec]`}
          >
            <Diff className="size-3.5 stroke-[1.8]" />
            Compare
          </button>
          <button
            type="button"
            disabled={!ready || conflict}
            onClick={toggleApplied}
            className={`${applied ? "secondary-btn" : "primary-btn"} ${SMALL_BTN} disabled:pointer-events-none disabled:opacity-40`}
          >
            {applied ? (
              <RotateCcw className="size-3.5 stroke-[1.8]" />
            ) : (
              <ChevronsRight className="size-3.5 stroke-[2]" />
            )}
            {applied ? "Undo" : "Apply"}
          </button>
        </div>
      </div>
    </section>
  );
}
