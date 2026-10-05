import type { Payload } from "@/modules/studio/types";

export type EditorMedia = { count: number; types: string[] };

export function editorMedia(payload: Payload, ids?: string[], assets: Payload[] = []): EditorMedia {
  if (ids !== undefined) return {
    count: ids.length,
    types: ids.map((id) => String(assets.find((asset) => asset.id === id)?.content_type ?? "")),
  };
  const urls = Array.isArray(payload.media_urls) ? payload.media_urls : [];
  if (urls.length) return {
    count: urls.length,
    types: Array.isArray(payload.media_types) ? payload.media_types.map(String) : urls.map(() => ""),
  };
  return payload.video_url ? { count: 1, types: ["video/mp4"] }
    : payload.image_url ? { count: 1, types: ["image/jpeg"] }
    : { count: 0, types: [] };
}

export function instagramFormat(payload: Payload, media: EditorMedia) {
  const selected = String(payload.media_type ?? "").toUpperCase();
  if (["IMAGE", "CAROUSEL", "REELS"].includes(selected)) return selected;
  return media.count > 1 ? "CAROUSEL"
    : media.types.some((type) => type.startsWith("video/")) ? "REELS" : "IMAGE";
}

export function reorderEditorMedia(ids: string[], index: number, delta: number) {
  const next = [...ids];
  const target = index + delta;
  if (index < 0 || index >= ids.length || target < 0 || target >= ids.length) return next;
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

export function safePostLink(value: unknown): URL | null {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password ? url : null;
  } catch { return null; }
}

export function captionHashtags(caption: string): string[] {
  return [...caption.matchAll(/(?:^|\s)(#[\p{L}\p{M}\p{N}_]+)/gu)].map((match) => match[1]);
}

export function replaceCaptionHashtags(caption: string, tags: string) {
  const body = caption.replace(/(^|\s)#[\p{L}\p{M}\p{N}_]+/gu, "$1").trimEnd();
  const values = tags.split(/[\s,]+/).filter(Boolean).map((tag) => tag.replace(/^#/, "").normalize("NFC"));
  if (values.some((tag) => !/^[\p{L}\p{M}\p{N}_]+$/u.test(tag))) return null;
  const unique = [...new Map(values.map((tag) => [tag.toLocaleLowerCase(), `#${tag}`])).values()];
  return [body, unique.join(" ")].filter(Boolean).join("\n\n");
}

/** Mirror the formats handled by the current publisher before submitting a draft. */
export function socialEditorIssues(platform: string, payload: Payload, media: EditorMedia, capabilities: Payload): string[] {
  const issues: string[] = [];
  if (platform === "facebook" && payload.link) {
    if (!safePostLink(payload.link)) issues.push("Enter a complete http or https link.");
    if (media.count) issues.push("Use a link or media for this Facebook post. Remove one before publishing.");
  }
  if (platform === "instagram") {
    const format = instagramFormat(payload, media);
    if (!media.count) issues.push("Add a photo or video before publishing.");
    if (media.count && media.types.some((type) => !type)) issues.push("Wait for attachment details to load before publishing.");
    if (format === "CAROUSEL" && media.count < 2) issues.push("A carousel needs at least two attachments.");
    if (format === "REELS" && (media.count !== 1 || (media.types[0] && !media.types[0].startsWith("video/")))) issues.push("A Reel needs one video attachment.");
    if (format === "IMAGE" && (media.count > 1 || media.types.some((type) => type.startsWith("video/")))) issues.push("A photo post needs one image. Choose Carousel or Reel for these attachments.");
    if (captionHashtags(String(payload.caption ?? "")).length > 30) issues.push("This publisher accepts up to 30 hashtags. Remove a few before publishing.");
  }
  if (platform === "threads" && Array.isArray(payload.thread) && payload.thread.length > 1 && capabilities.supports_threads !== true)
    issues.push("The Threads publisher currently supports one post at a time.");
  return issues;
}
