import type { Payload } from "@/modules/studio/types";
import type { RefineContext } from "./WritingAssistant";
import { profileFor, threadItems, updateThread } from "./model";

export const REFINE_COMMANDS = [
  {
    id: "grammar",
    label: "Fix grammar",
    instruction:
      "Correct grammar, spelling and punctuation only. Preserve the meaning and voice.",
  },
  {
    id: "improve",
    label: "Improve writing",
    instruction:
      "Improve clarity, flow and word choice while preserving the author's meaning and voice.",
  },
  {
    id: "punchier",
    label: "Make it punchier",
    instruction:
      "Use sharper, more direct language and a stronger opening. Avoid hype and invented claims.",
  },
  {
    id: "condense",
    label: "Condense",
    instruction:
      "Shorten the text by removing repetition and filler without losing its essential meaning.",
  },
  {
    id: "rephrase",
    label: "Rephrase / Mix it up",
    instruction:
      "Rephrase with fresh wording and sentence structure while preserving the facts and meaning.",
  },
  {
    id: "expand",
    label: "Expand & Elaborate",
    instruction:
      "Develop the existing ideas with useful explanation. Do not invent facts, experiences or statistics.",
  },
  {
    id: "structure",
    label: "Improve structure & spacing",
    instruction:
      "Improve organization, paragraphs and line breaks for readability. Preserve the author's wording where possible.",
  },
  {
    id: "positive",
    label: "Rewrite in a positive tone",
    instruction:
      "Use a constructive, positive tone without losing nuance or making exaggerated promises.",
  },
  {
    id: "thread",
    label: "Rewrite as thread start",
    instruction:
      "Rewrite as the first post of a thread: a clear, compelling opening that naturally leads to further posts. Return only the opening post, not a full thread.",
  },
  {
    id: "emoji",
    label: "Add emoji",
    instruction:
      "Add a small number of relevant emoji naturally. Preserve the original text and avoid emoji clutter.",
  },
  {
    id: "announcement",
    label: "Rewrite as announcement",
    instruction:
      "Frame this as a clear announcement with the news up front and a relevant next step. Do not invent dates, launches or features.",
  },
] as const;

export type RefinePreferences = {
  language: string;
  commands: Record<string, string>;
};
export function refinePreferencesKey(workspace: string, account: string) {
  return `postflow:refine:${workspace}:${account}`;
}
export function readRefinePreferences(raw: string | null): RefinePreferences {
  try {
    const value = JSON.parse(raw ?? "null");
    return {
      language:
        typeof value?.language === "string" ? value.language.slice(0, 80) : "",
      commands: Object.fromEntries(
        Object.entries(value?.commands ?? {})
          .filter(([, v]) => typeof v === "string")
          .map(([k, v]) => [k, String(v).slice(0, 1000)]),
      ),
    };
  } catch {
    return { language: "", commands: {} };
  }
}

export function refineInstructions(
  command: string,
  custom: string,
  preferences: RefinePreferences,
  followup = "",
) {
  const preset = REFINE_COMMANDS.find((item) => item.id === command);
  return [
    preset?.instruction ?? custom,
    preferences.commands[command],
    followup ? `Further refine the proposed response: ${followup}` : "",
    "Return only the revised, publishable text. Preserve URLs and facts unless the requested edit explicitly changes them.",
  ]
    .filter(Boolean)
    .join("\n")
    .slice(0, 2000);
}

/** Apply only to the requested post/range, keeping media and platform settings. */
export function applyRefinement(
  payload: Payload,
  platform: string,
  selection: RefineContext,
  expected: string,
  next: string,
  mode: "replace" | "insert",
) {
  const item = Array.isArray(payload.thread)
    ? threadItems(payload)[selection.index]
    : payload;
  if (!item || selection.index < 0) return null;
  const key = profileFor(platform).textKey;
  const text = String(item[key] ?? "");
  const ranged = selection.start != null && selection.end != null;
  const start = ranged ? selection.start! : 0;
  const end = ranged ? selection.end! : text.length;
  if (
    start < 0 ||
    end > text.length ||
    end < start ||
    text.slice(start, end) !== expected
  )
    return null;
  const replacement =
    mode === "insert"
      ? text.slice(0, end) +
        (text.slice(0, end).endsWith("\n\n") ? "" : "\n\n") +
        next +
        text.slice(end)
      : text.slice(0, start) + next + text.slice(end);
  return Array.isArray(payload.thread)
    ? updateThread(payload, selection.index, { [key]: replacement })
    : { ...payload, [key]: replacement };
}

export function refinementDiff(before: string, after: string) {
  const a = Array.from(before),
    b = Array.from(after);
  let start = 0,
    tail = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start++;
  while (
    tail < a.length - start &&
    tail < b.length - start &&
    a[a.length - 1 - tail] === b[b.length - 1 - tail]
  )
    tail++;
  return {
    prefix: b.slice(0, start).join(""),
    removed: a.slice(start, a.length - tail).join(""),
    added: b.slice(start, b.length - tail).join(""),
    suffix: tail ? b.slice(-tail).join("") : "",
  };
}

/** Word-level insertions keep unchanged passages readable in the response. */
export function refinementChanges(before: string, after: string) {
  const tokenize = (text: string) =>
    text.match(/\s+|[\p{L}\p{N}_]+|[^\s]/gu) ?? [];
  const a = tokenize(before),
    b = tokenize(after);
  if (a.length * b.length > 1_000_000) {
    const diff = refinementDiff(before, after);
    return [
      { text: diff.prefix, added: false },
      { text: diff.added, added: true },
      { text: diff.suffix, added: false },
    ];
  }
  const table = Array.from(
    { length: a.length + 1 },
    () => new Uint16Array(b.length + 1),
  );
  for (let i = a.length - 1; i >= 0; i--)
    for (let j = b.length - 1; j >= 0; j--)
      table[i][j] =
        a[i] === b[j]
          ? table[i + 1][j + 1] + 1
          : Math.max(table[i + 1][j], table[i][j + 1]);
  const parts: { text: string; added: boolean }[] = [];
  let i = 0,
    j = 0;
  function push(text: string, added: boolean) {
    const last = parts.at(-1);
    if (last?.added === added) last.text += text;
    else parts.push({ text, added });
  }
  while (j < b.length) {
    if (i < a.length && a[i] === b[j]) {
      push(b[j++], false);
      i++;
    } else if (i < a.length && table[i + 1][j] > table[i][j + 1]) i++;
    else push(b[j++], true);
  }
  return parts;
}
