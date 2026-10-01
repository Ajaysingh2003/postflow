// "use client";

// import { useEffect, useRef, useState } from "react";
// import { Check, ChevronsRight, Copy, Diff, RotateCcw } from "lucide-react";
// import { toast } from "sonner";
// import type { DraftArtifact } from "../agentStream";

// /** Compact line diff: preserve common edges and highlight the changed region. */
// export function draftDiff(before: string, after: string) {
//   const a = before.split("\n"),
//     b = after.split("\n");
//   let start = 0,
//     end = 0;
//   while (start < a.length && start < b.length && a[start] === b[start]) start++;
//   while (
//     end < a.length - start &&
//     end < b.length - start &&
//     a[a.length - 1 - end] === b[b.length - 1 - end]
//   )
//     end++;
//   return {
//     prefix: a.slice(0, start),
//     removed: a.slice(start, a.length - end),
//     added: b.slice(start, b.length - end),
//     suffix: end ? a.slice(a.length - end) : [],
//   };
// }

// const LINKEDIN_PATH =
//   "M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z";
// const X_PATH =
//   "M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z";

// function PlatformIcon({ platform }: { platform: "linkedin" | "x" }) {
//   return (
//     <svg
//       viewBox="0 0 24 24"
//       role="img"
//       aria-label={platform === "x" ? "X" : "LinkedIn"}
//       className="size-3.5 shrink-0 fill-current text-[#8a929c]"
//     >
//       <path d={platform === "x" ? X_PATH : LINKEDIN_PATH} />
//     </svg>
//   );
// }

// const ACTION_BASE =
//   "flex h-7 items-center gap-1.5 rounded-md px-2 text-[14px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/10 disabled:pointer-events-none disabled:opacity-40";
// const ACTION_NEUTRAL = `${ACTION_BASE} text-[#9aa1aa] hover:bg-black/[0.04] hover:text-neutral-900 aria-pressed:bg-black/[0.05] aria-pressed:text-neutral-900`;
// const ACTION_ACCENT = `${ACTION_BASE} text-[#a196f3] hover:bg-[#6b5ce7]/[0.08] hover:text-[#6b5ce7]`;

// export function DraftArtifactCard({
//   artifact,
//   content,
//   ready,
//   replace,
//   platform,
//   limit = 3000,
// }: {
//   artifact: DraftArtifact;
//   content: string;
//   ready: boolean;
//   replace: (expected: string, replacement: string) => void;
//   /** Shows the network badge in the corner of the card. */
//   platform?: "linkedin" | "x";
//   /** Character limit; the count only appears once the draft nears it. */
//   limit?: number;
// }) {
//   const [compare, setCompare] = useState(false);
//   const [applied, setApplied] = useState(false);
//   const [copied, setCopied] = useState(false);
//   const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

//   useEffect(
//     () => () => {
//       if (copyTimer.current) clearTimeout(copyTimer.current);
//     },
//     [],
//   );

//   const conflict = content !== (applied ? artifact.content : artifact.original);
//   const diff = compare ? draftDiff(artifact.original, artifact.content) : null;
//   const length = artifact.content.length;
//   const nearLimit = length >= limit * 0.9;
//   const showMeta = Boolean(artifact.summary) || nearLimit || Boolean(platform);

//   function toggleApplied() {
//     replace(
//       applied ? artifact.content : artifact.original,
//       applied ? artifact.original : artifact.content,
//     );
//     setApplied(!applied);
//   }

//   async function copy() {
//     try {
//       await navigator.clipboard.writeText(artifact.content);
//       setCopied(true);
//       if (copyTimer.current) clearTimeout(copyTimer.current);
//       copyTimer.current = setTimeout(() => setCopied(false), 1600);
//     } catch {
//       toast.error("Could not copy suggestion");
//     }
//   }

//   return (
//     <section
//       aria-label={artifact.title || "Draft suggestion"}
//       className="overflow-hidden rounded-xl border border-black/[0.08] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_6px_rgba(16,24,40,0.03)]"
//     >
//       <div className={`px-4 pt-3 ${showMeta ? "pb-3" : "pb-4"}`}>
//         <div className="whitespace-pre-wrap break-words text-[14px] leading-[1.4] text-[#111418]">
//           {diff ? (
//             <div className="space-y-1">
//               {diff.prefix.length > 0 && <div>{diff.prefix.join("\n")}</div>}
//               {diff.removed.length > 0 && (
//                 <del className="-mx-1.5 block rounded-md bg-rose-50 px-1.5 py-0.5 text-rose-900 decoration-rose-300">
//                   {diff.removed.join("\n") || "(empty line)"}
//                 </del>
//               )}
//               {diff.added.length > 0 && (
//                 <ins className="-mx-1.5 block rounded-md bg-emerald-50 px-1.5 py-0.5 text-emerald-900 no-underline">
//                   {diff.added.join("\n") || "(empty line)"}
//                 </ins>
//               )}
//               {diff.suffix.length > 0 && <div>{diff.suffix.join("\n")}</div>}
//             </div>
//           ) : (
//             artifact.content
//           )}
//         </div>

//         {showMeta && (
//           <div className="mt-3 flex items-end justify-between gap-3">
//             {artifact.summary ? (
//               <p className="min-w-0 text-[12.5px] leading-[1.5] text-[#8a919a]">
//                 {artifact.summary}
//               </p>
//             ) : (
//               <span />
//             )}
//             <div className="flex shrink-0 items-center gap-2">
//               {nearLimit && (
//                 <span
//                   className={`text-[12px] tabular-nums ${length > limit ? "font-medium text-rose-600" : "text-[#8a919a]"}`}
//                 >
//                   {length}/{limit}
//                 </span>
//               )}
//               {platform && <PlatformIcon platform={platform} />}
//             </div>
//           </div>
//         )}
//       </div>

//       {conflict ? (
//         <p
//           role="status"
//           className="border-t border-amber-200/70 bg-amber-50/70 px-4 py-2 text-[12.5px] leading-[1.5] text-amber-900"
//         >
//           Your draft has changed. Copy this suggestion or ask for a fresh
//           revision.
//         </p>
//       ) : applied ? (
//         <p className="border-t border-black/[0.06] px-4 py-2 text-[12.5px] text-[#8a919a]">
//           Applied · save when ready
//         </p>
//       ) : null}

//       <div className="flex h-9 items-center justify-between border-t border-black/[0.06] px-2">
//         <button
//           type="button"
//           onClick={copy}
//           aria-label="Copy suggestion"
//           className={ACTION_NEUTRAL}
//         >
//           {copied ? (
//             <Check className="size-3.5 stroke-[1.8]" />
//           ) : (
//             <Copy className="size-3.5 stroke-[1.7]" />
//           )}
//           {copied ? "Copied" : "Copy"}
//         </button>

//         <div className="flex items-center gap-0.5">
//           <button
//             type="button"
//             aria-pressed={compare}
//             onClick={() => setCompare((value) => !value)}
//             className={ACTION_NEUTRAL}
//           >
//             <Diff className="size-3.5 stroke-[1.7]" />
//             Compare
//           </button>
//           <button
//             type="button"
//             disabled={!ready || conflict}
//             onClick={toggleApplied}
//             className={applied ? ACTION_NEUTRAL : ACTION_ACCENT}
//           >
//             {applied ? (
//               <RotateCcw className="size-3.5 stroke-[1.7]" />
//             ) : (
//               <ChevronsRight className="size-3.5 stroke-[1.8]" />
//             )}
//             {applied ? "Undo" : "Apply"}
//           </button>
//         </div>
//       </div>
//     </section>
//   );
// }





"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronsRight, Copy, Diff, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import type { DraftArtifact } from "../agentStream";

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

const LINKEDIN_PATH =
  "M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z";
const X_PATH =
  "M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z";

function PlatformIcon({ platform }: { platform: "linkedin" | "x" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      role="img"
      aria-label={platform === "x" ? "X" : "LinkedIn"}
      className="size-4 shrink-0 fill-current text-[#8a929c]"
    >
      <path d={platform === "x" ? X_PATH : LINKEDIN_PATH} />
    </svg>
  );
}

const SMALL_BTN = "!min-h-8 !rounded-lg !px-3 !text-[14px]";

export function DraftArtifactCard({
  artifact,
  content,
  ready,
  replace,
  platform,
  limit = 3000,
}: {
  artifact: DraftArtifact;
  content: string;
  ready: boolean;
  replace: (expected: string, replacement: string) => void;
  /** Shows the network badge in the header of the card. */
  platform?: "linkedin" | "x";
  /** Character limit; the count only appears once the draft nears it. */
  limit?: number;
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
              className={`font-mono text-[12px] tabular-nums ${length > limit ? "font-medium text-rose-600" : "text-[#8a929c]"}`}
            >
              {length}/{limit}
            </span>
          )}
          {platform && <PlatformIcon platform={platform} />}
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
                <span aria-hidden className="select-none font-mono text-rose-400">
                  −
                </span>
                <span>{diff.removed.join("\n") || "(empty line)"}</span>
              </del>
            )}
            {diff.added.length > 0 && (
              <ins className="flex gap-2.5 whitespace-pre-wrap break-words rounded-lg bg-emerald-50 px-2.5 py-1.5 text-emerald-900 no-underline">
                <span
                  aria-hidden
                  className="select-none font-mono text-emerald-500"
                >
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
      {conflict ? (
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