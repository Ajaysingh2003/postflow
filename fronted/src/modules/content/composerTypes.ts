import { z } from "zod";

export const attachmentSchema = z.object({
  asset_id: z.string(),
  name: z.string().max(255),
  content_type: z.enum([
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "application/pdf",
  ]),
});
export const composerSettingsSchema = z.object({
  connection_id: z.string().nullable().default(null),
  visibility: z.enum(["PUBLIC", "CONNECTIONS"]).default("PUBLIC"),
  comment: z.string().max(1250).default(""),
  attachments: z.array(attachmentSchema).max(9).default([]),
  mentions: z
    .array(
      z.object({
        name: z.string().min(1).max(150),
        profile_url: z
          .string()
          .regex(/^https:\/\/(www\.)?linkedin\.com\/(in|company)\/[^\s]+$/)
          .max(500),
        avatar_url: z.string().max(1000).optional(),
        entity_type: z.enum(["company", "person"]).optional(),
      }),

    )
    .max(20)
    .default([]),
});
export type ComposerSettings = z.infer<typeof composerSettingsSchema>;
export type DraftAttachment = z.infer<typeof attachmentSchema>;
export type SavedDraft = {
  id: string;
  title: string;
  content: string;
  status: string;
  current_revision: number;
  composer: ComposerSettings;
  updated_at: string;
  created_at: string;
};
export type Schedule = {
  composer?: ComposerSettings;
  id: string;
  post_id: string | null;
  content: string;
  status: string;
  scheduled_for: string;
  final_post_url: string | null;
};
export const emptySettings = (): ComposerSettings => ({
  connection_id: null,
  visibility: "PUBLIC",
  comment: "",
  attachments: [],
  mentions: [],
});
