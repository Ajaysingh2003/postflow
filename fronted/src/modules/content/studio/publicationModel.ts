import type { Account, Payload, Variant } from "@/modules/studio/types";
import { canEditDraft, draftText, profileFor, threadItems } from "./model";

export type DestinationDraft = { payload: Payload; mediaIds: string[]; variant: Variant | null };
export type DestinationResult = { accountId: string; status: string; message: string; variant?: Variant };

export function destinationDraft(source: Variant, sourceAccount: Account, target: Account, existing?: Variant): DestinationDraft {
  if (existing) return { payload: structuredClone(existing.payload), mediaIds: [...existing.media_asset_ids], variant: existing };
  const text = draftText(source.payload, sourceAccount.platform);
  let payload: Payload;
  if (sourceAccount.platform === target.platform) {
    payload = structuredClone(source.payload);
    // A destination must choose its own Page, professional account or community.
    for (const key of ["page_id", "target_id", "target_urn", "author_urn", "subreddit", "flair_id", "in_reply_to_tweet_id", "quote_tweet_id"]) delete payload[key];
  } else {
    payload = { [profileFor(target.platform).textKey]: text };
    if (target.platform === "reddit") payload = { body: text, title: "", subreddit: "", post_type: "text" };
    if (target.platform === "facebook" && typeof source.payload.link === "string") payload.link = source.payload.link;
  }
  return { payload, mediaIds: [...source.media_asset_ids], variant: null };
}

export function destinationText(payload: Payload, platform: string, index: number, text: string) {
  if (!Array.isArray(payload.thread)) return { ...payload, [profileFor(platform).textKey]: text };
  const thread = threadItems(payload);
  thread[index] = { ...thread[index], text };
  return { ...payload, thread };
}

export function canSubmitDestination(variant: Variant | null) {
  return canEditDraft(variant) && variant?.status !== "rejected";
}

export function destinationRequestKey(postId: string, accountId: string) {
  return `crosspost:${postId}:${accountId}`;
}

/** Each destination is independent; a rejected request never prevents the others. */
export async function submitDestinations(ids: string[], submit: (id: string) => Promise<DestinationResult>) {
  const results: DestinationResult[] = [];
  for (const id of ids) {
    try { results.push(await submit(id)); }
    catch (error) { results.push({ accountId: id, status: "error", message: error instanceof Error ? error.message : "Could not submit this account." }); }
  }
  return results;
}
