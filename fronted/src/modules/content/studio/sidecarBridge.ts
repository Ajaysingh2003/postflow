import type { SourceAsset } from "../assets";
import type { DraftArtifact } from "../agentStream";
import type { Payload } from "@/modules/studio/types";
import type { RefineContext } from "./WritingAssistant";
import {
  canEditDraft,
  draftText,
  fingerprint,
  profileFor,
  threadItems,
  updateThread,
  type WritingDraft,
} from "./model";

export type SidecarReply = {
  text: string;
  artifact?: DraftArtifact;
  replace?: (expected: string, next: string) => void;
};

/** Connect the existing assistant UI to the active account's editor. */
export type SidecarBridge = {
  scope: string;
  content: string;
  styleOwner: string;
  ready: boolean;
  send: (
    prompt: string,
    attachments: SourceAsset[],
    signal: AbortSignal,
  ) => Promise<SidecarReply>;
};

/** Selections are only valid while their original passage still exists. */
export function assistantDraftSource(
  payload: Payload,
  platform: string,
  refine: RefineContext,
) {
  const whole = draftText(payload, platform);
  if (refine.index < 0) return { text: whole, selection: { index: -1 } };
  if (Array.isArray(payload.thread) && !threadItems(payload)[refine.index])
    return { text: whole, selection: { index: -1 } };
  const text = Array.isArray(payload.thread)
    ? String(threadItems(payload)[refine.index]?.text ?? "")
    : whole;
  const selected = refine.start != null && refine.end != null;
  if (selected && refine.text === text.slice(refine.start, refine.end)) {
    return { text: refine.text, selection: { ...refine } };
  }
  if (selected) return { text: whole, selection: { index: -1 } };
  return { text, selection: { index: refine.index } };
}

export function createSidecarReplacement(
  snapshot: WritingDraft,
  platform: string,
  selection: { index: number; start?: number; end?: number },
  read: () => WritingDraft,
  commit: (draft: WritingDraft) => void,
  locked: () => boolean,
  conflict: () => void,
  replacementThread?: string[],
) {
  let expectedFingerprint = fingerprint(snapshot.payload, snapshot.mediaIds);
  const range = { ...selection };
  let applied = false;
  return (expected: string, next: string) => {
    const active = read();
    if (
      active.localId !== snapshot.localId ||
      fingerprint(active.payload, active.mediaIds) !== expectedFingerprint ||
      !canEditDraft(active.variant) ||
      locked()
    ) {
      conflict();
      return;
    }
    const wholeThread = Array.isArray(active.payload.thread) && range.index < 0;
    const original =
      Array.isArray(active.payload.thread) && !wholeThread
        ? String(threadItems(active.payload)[range.index]?.text ?? "")
        : draftText(active.payload, platform);
    const selected = range.start != null && range.end != null;
    if (
      (selected ? original.slice(range.start, range.end) : original) !==
      expected
    ) {
      conflict();
      return;
    }
    const replacement = selected
      ? original.slice(0, range.start) + next + original.slice(range.end)
      : next;
    const payload = wholeThread
      ? applied
        ? structuredClone(snapshot.payload)
        : {
            ...active.payload,
            thread: (replacementThread ?? [replacement]).map((text, index) => ({
              ...threadItems(snapshot.payload)[index],
              text,
            })),
          }
      : Array.isArray(active.payload.thread)
        ? updateThread(active.payload, range.index, { text: replacement })
        : { ...active.payload, [profileFor(platform).textKey]: replacement };
    if (selected) range.end = range.start! + next.length;
    expectedFingerprint = fingerprint(payload, active.mediaIds);
    commit({ ...active, payload });
    applied = !applied;
  };
}
