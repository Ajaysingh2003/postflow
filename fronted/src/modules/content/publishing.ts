import type { ComposerSettings } from "./composerTypes";
import { z } from "zod";

export type PublicationResult = {
  linkedin_connection_id: string;
  status:
    | "published"
    | "failed"
    | "reconnect_required"
    | "unknown"
    | "sending"
    | "queued";
  post_url?: string | null;
  error_code?: string | null;
};
export type PublicationResponse = {
  batch_id: string;
  results: PublicationResult[];
};
export type PublishPayload = {
  idempotency_key: string;
  workspace_id: string;
  linkedin_connection_ids: string[];
  content: string;
  images: { asset_id: string }[];
};
export type PublicationAttempt = {
  payload: PublishPayload;
  response?: PublicationResponse;
};

export function publishIssue(
  content: string,
  composer: ComposerSettings,
): string | null {
  if (!content.trim()) return "Write some post text before publishing.";
  if (content.length > 3000)
    return "Shorten your post to 3,000 characters before publishing.";
  if (composer.visibility !== "PUBLIC")
    return "Direct publishing uses Anyone visibility. Change your audience to Anyone before publishing.";
  if (
    composer.attachments.some(
      (asset) =>
        !["image/jpeg", "image/png", "image/gif"].includes(asset.content_type),
    )
  )
    return "Direct publishing supports JPEG, PNG, and GIF images. Publish PDF carousels or WebP images through LinkedIn instead.";
  if (composer.comment.trim())
    return "Direct publishing does not add first comments yet. Publish through LinkedIn to include your first comment, or remove it from this draft.";
  if (composer.mentions.length)
    return "Tagged mentions need to be added through LinkedIn. Remove the mentions or publish through LinkedIn instead.";
  return null;
}

const RESULT_MESSAGES: Record<string, string> = {
  published: "Published",
  failed: "Not published",
  reconnect_required: "Reconnect to publish",
  sending: "Publishing…",
  queued: "Waiting to publish",
  unknown: "Check LinkedIn to confirm",
};
const ERROR_MESSAGES: Record<string, string> = {
  publishing_connection_required:
    "Enable publishing for this account in the Outlify extension.",
  member_identity_required:
    "Reconnect this account so LinkedIn can confirm your profile.",
  token_unavailable: "Reconnect this account to restore publishing access.",
  token_rejected:
    "Your LinkedIn authorization expired. Reconnect this account.",
  permission_denied:
    "LinkedIn has not granted permission to publish for this account.",
  rate_limited:
    "LinkedIn is limiting requests. Wait before retrying this account.",
  linkedin_rejected:
    "LinkedIn rejected this post. Check its content and media before trying again.",
  media_processing_failed:
    "LinkedIn could not process this media. Export it again and retry.",
  media_processing_timeout:
    "LinkedIn did not finish processing your media in time.",
};
export function publicationLabel(result: PublicationResult) {
  return RESULT_MESSAGES[result.status] || "Check publishing status";
}
export function publicationDetail(result: PublicationResult) {
  if (result.status === "published") return "Your post is live on LinkedIn.";
  if (result.status === "unknown")
    return "LinkedIn may have received this post. Check your profile before posting it again.";
  if (result.status === "sending" || result.status === "queued")
    return "Check status for the latest result. This account will not be submitted again.";
  return (
    ERROR_MESSAGES[result.error_code || ""] ||
    "Publishing did not complete for this account. Review the post and your connection before retrying."
  );
}

// Retain the same request key across dialog reopens and page reloads. Replaying
// that exact request checks the original attempt rather than creating a new post.
export function readPublicationAttempt(key: string): PublicationAttempt | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return z
      .object({
        payload: z.object({
          idempotency_key: z.string().uuid(),
          workspace_id: z.string().uuid(),
          linkedin_connection_ids: z.array(z.string().uuid()).min(1).max(20),
          content: z.string().min(1).max(3000),
          images: z.array(z.object({ asset_id: z.string().uuid() })).max(9),
        }),
        response: z
          .object({
            batch_id: z.string().uuid(),
            results: z
              .array(
                z.object({
                  linkedin_connection_id: z.string().uuid(),
                  status: z.enum([
                    "published",
                    "failed",
                    "reconnect_required",
                    "unknown",
                    "sending",
                    "queued",
                  ]),
                  post_url: z.string().nullable().optional(),
                  error_code: z.string().nullable().optional(),
                }),
              )
              .max(20),
          })
          .optional(),
      })
      .parse(JSON.parse(raw));
  } catch {
    throw new Error(
      "Could not restore the previous publishing attempt. Check your LinkedIn profile before publishing again.",
    );
  }
}
export function writePublicationAttempt(
  key: string,
  value: PublicationAttempt,
) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    throw new Error(
      "Could not save this publishing attempt on your device. Allow browser storage or free some space, then try again.",
    );
  }
}
