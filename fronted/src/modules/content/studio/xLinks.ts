import type { Payload } from "@/modules/studio/types";

export const X_LINK_MESSAGE =
  "Draftva doesn't publish links to X. Remove links from this version before publishing or scheduling.";

// Mirrors the publisher's link check; attachment URLs and email addresses are excluded.
const POST_LINK =
  /(?<![\p{L}\p{N}_@.])(?:https?:\/\/[^\s<>]+|www\.[^\s<>]+|(?:[\p{L}\p{N}](?:[\p{L}\p{N}-]{0,61}[\p{L}\p{N}])?\.)+(?:[\p{L}]{2,63}|xn--[a-z0-9-]{2,59})(?![\p{L}\p{N}_@-]))/iu;

export function containsPostLink(text: string) {
  return POST_LINK.test(text.normalize("NFC"));
}

export function xLinkIssues(payload: Payload): string[] {
  const thread = Array.isArray(payload.thread) ? payload.thread : [payload];
  return thread.flatMap((item, index) => {
    const text = typeof item === "string" ? item : item?.text;
    return typeof text === "string" && containsPostLink(text)
      ? [
          Array.isArray(payload.thread)
            ? `Post ${index + 1}: ${X_LINK_MESSAGE}`
            : X_LINK_MESSAGE,
        ]
      : [];
  });
}
