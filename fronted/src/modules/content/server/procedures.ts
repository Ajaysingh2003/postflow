import { TRPCError } from "@trpc/server";
import {
  attachmentSchema,
  composerSettingsSchema,
  type SavedDraft,
  type Schedule,
} from "../composerTypes";
import axios from "axios";
import { z } from "zod";

import {
  authedProcedure,
  createTRPCRouter,
  getUserProcedure,
} from "@/trpc/init";
import {
  getApiBase,
  getAuthHeaders,
  handleBackendError,
} from "@/lib/http-error";
import { DEFAULT_COMMANDS, type CommandItem } from "../types";
import type { PublicationResponse } from "../publishing";

interface BackendPromptTemplate {
  id: string;
  name: string;
  prompt: string;
  tone?: string | null;
  created_at?: string;
}

export const contentRouter = createTRPCRouter({
  publishLinkedIn: authedProcedure
    .input(
      z.object({
        idempotency_key: z.string().uuid(),
        workspace_id: z.string().uuid(),
        linkedin_connection_ids: z.array(z.string().uuid()).min(1).max(20),
        content: z
          .string()
          .min(1)
          .max(3000)
          .refine((value) => Boolean(value.trim()), "Write a post first"),
        images: z.array(z.object({ asset_id: z.string().uuid() })).max(9),
      }),
    )
    .mutation(async ({ input }): Promise<PublicationResponse> => {
      const { idempotency_key, workspace_id, ...body } = input;
      try {
        return (
          await axios.post<PublicationResponse>(
            `${getApiBase()}/v1/publishing/linkedin/posts`,
            body,
            {
              headers: {
                ...(await getAuthHeaders(undefined, workspace_id)),
                "Idempotency-Key": idempotency_key,
              },
              timeout: 240000,
            },
          )
        ).data;
      } catch (error) {
        if (
          axios.isAxiosError(error) &&
          (!error.response || error.response.status >= 500)
        )
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message:
              "Publishing status could not be confirmed. Check status before trying again.",
          });
        return handleBackendError(error, "Could not publish this post");
      }
    }),
  publicationStatus: authedProcedure
    .input(
      z.object({
        idempotency_key: z.string().uuid(),
        workspace_id: z.string().uuid(),
      }),
    )
    .query(async ({ input }): Promise<PublicationResponse> => {
      try {
        return (
          await axios.get<PublicationResponse>(
            `${getApiBase()}/v1/publishing/linkedin/attempts/${input.idempotency_key}`,
            {
              headers: await getAuthHeaders(undefined, input.workspace_id),
              timeout: 15000,
            },
          )
        ).data;
      } catch (error) {
        return handleBackendError(error, "Could not check publishing status");
      }
    }),
  generate: authedProcedure
    .input(
      z.object({
        prompt: z.string().min(3).max(10000),
        source_text: z.string().max(30000),
        tone: z.string().max(100).nullable().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      try {
        return (
          await axios.post<{ content: string; credits_used: number }>(
            `${getApiBase()}/v1/ai/generate`,
            { ...input, action: "rewrite" },
            { headers: await getAuthHeaders(), timeout: 60000 },
          )
        ).data;
      } catch (error) {
        return handleBackendError(error, "Could not refine this draft");
      }
    }),

  /**
   * Retrieves commands list, combining curated default commands
   * with user/workspace saved prompt templates from the database.
   */
  getCommands: getUserProcedure.query(async (): Promise<CommandItem[]> => {
    try {
      const headers = await getAuthHeaders();
      const response = await axios.get<BackendPromptTemplate[]>(
        `${getApiBase()}/v1/prompt-templates`,
        { headers },
      );

      if (
        response.data &&
        Array.isArray(response.data) &&
        response.data.length > 0
      ) {
        const customCommands: CommandItem[] = response.data.map((tmpl) => ({
          id: tmpl.id,
          label: tmpl.name,
          icon: tmpl.tone || "sparkles",
          prompt: tmpl.prompt,
          isCustom: true,
        }));

        // Merge: custom commands appear first or alongside defaults
        const customLabels = new Set(
          customCommands.map((c) => c.label.toLowerCase()),
        );
        const remainingDefaults = DEFAULT_COMMANDS.filter(
          (d) => !customLabels.has(d.label.toLowerCase()),
        );

        return [...customCommands, ...remainingDefaults];
      }
    } catch {
      // Fallback to defaults if unauthenticated or network error
    }

    return DEFAULT_COMMANDS;
  }),

  /**
   * Creates or updates a command in the database.
   */
  saveCommand: authedProcedure
    .input(
      z.object({
        id: z.string().optional(),
        name: z.string().min(1).max(160),
        icon: z.string().default("sparkles"),
        prompt: z.string().min(3).max(10_000),
      }),
    )
    .mutation(async ({ input }): Promise<CommandItem> => {
      try {
        const headers = await getAuthHeaders();
        const isExistingDbId =
          input.id && input.id.includes("-") && input.id.length >= 32;

        if (isExistingDbId) {
          const response = await axios.patch<BackendPromptTemplate>(
            `${getApiBase()}/v1/prompt-templates/${input.id}`,
            {
              name: input.name,
              prompt: input.prompt,
              tone: input.icon,
            },
            { headers },
          );

          return {
            id: response.data.id,
            label: response.data.name,
            icon: response.data.tone || input.icon,
            prompt: response.data.prompt,
            isCustom: true,
          };
        } else {
          const response = await axios.post<BackendPromptTemplate>(
            `${getApiBase()}/v1/prompt-templates`,
            {
              name: input.name,
              prompt: input.prompt,
              tone: input.icon,
            },
            { headers },
          );

          return {
            id: response.data.id,
            label: response.data.name,
            icon: response.data.tone || input.icon,
            prompt: response.data.prompt,
            isCustom: true,
          };
        }
      } catch (error) {
        return handleBackendError(error, "Failed to save command");
      }
    }),

  /**
   * Deletes a custom command from the database.
   */
  deleteCommand: authedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }): Promise<{ success: boolean }> => {
      try {
        const headers = await getAuthHeaders();
        if (input.id.includes("-") && input.id.length >= 32) {
          await axios.delete(
            `${getApiBase()}/v1/prompt-templates/${input.id}`,
            {
              headers,
            },
          );
        }
        return { success: true };
      } catch (error) {
        return handleBackendError(error, "Failed to delete command");
      }
    }),

  /**
   * Retrieves all drafts for the active workspace from PostgreSQL.
   */
  getDrafts: authedProcedure.query(async (): Promise<SavedDraft[]> => {
    try {
      const response = await axios.get<SavedDraft[]>(
        `${getApiBase()}/v1/posts`,
        { headers: await getAuthHeaders() },
      );
      return response.data.filter(
        (post) => post.status === "draft" || post.status === "ready",
      );
    } catch (error) {
      return handleBackendError(error, "Could not load drafts");
    }
  }),
  saveDraft: authedProcedure
    .input(
      z.object({
        id: z.string().nullable().optional(),
        title: z.string().min(1).max(240),
        content: z.string().max(3000),
        expected_revision: z.number().int().positive().optional(),
        composer: composerSettingsSchema.optional(),
      }),
    )
    .mutation(async ({ input }): Promise<SavedDraft> => {
      try {
        const { id, ...body } = input;
        const options = { headers: await getAuthHeaders() };
        const response = id
          ? await axios.patch<SavedDraft>(
              `${getApiBase()}/v1/posts/${encodeURIComponent(id)}`,
              body,
              options,
            )
          : await axios.post<SavedDraft>(
              `${getApiBase()}/v1/posts`,
              body,
              options,
            );
        return response.data;
      } catch (error) {
        return handleBackendError(error, "Could not save draft");
      }
    }),
  archiveDraft: authedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      try {
        await axios.delete(
          `${getApiBase()}/v1/posts/${encodeURIComponent(input.id)}`,
          { headers: await getAuthHeaders() },
        );
        return { success: true };
      } catch (error) {
        return handleBackendError(error, "Could not archive draft");
      }
    }),
  createUpload: authedProcedure
    .input(
      z.object({
        filename: z.string().min(1).max(255),
        content_type: attachmentSchema.shape.content_type,
        size: z.number().int().positive(),
      }),
    )
    .mutation(async ({ input }) => {
      try {
        return (
          await axios.post<{
            asset_id: string;
            upload_url: string;
            headers: Record<string, string>;
          }>(`${getApiBase()}/v1/media/uploads`, input, {
            headers: await getAuthHeaders(),
          })
        ).data;
      } catch (error) {
        return handleBackendError(error, "Could not start upload");
      }
    }),
  completeUpload: authedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      try {
        await axios.post(
          `${getApiBase()}/v1/media/uploads/${encodeURIComponent(input.id)}/complete`,
          {},
          { headers: await getAuthHeaders() },
        );
        return { success: true };
      } catch (error) {
        return handleBackendError(error, "Upload could not be verified");
      }
    }),
  mediaUrl: authedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      try {
        return (
          await axios.post<{ download_url: string; expires_in: number }>(
            `${getApiBase()}/v1/media/${encodeURIComponent(input.id)}/download`,
            {},
            { headers: await getAuthHeaders() },
          )
        ).data;
      } catch (error) {
        return handleBackendError(error, "Could not load attachment");
      }
    }),
  schedules: authedProcedure.query(async (): Promise<Schedule[]> => {
    try {
      return (
        await axios.get<Schedule[]>(`${getApiBase()}/v1/schedules`, {
          headers: await getAuthHeaders(),
        })
      ).data;
    } catch (error) {
      return handleBackendError(error, "Could not load publishing queue");
    }
  }),
  schedule: authedProcedure
    .input(
      z.object({
        post_id: z.string(),
        scheduled_for: z.string().datetime(),
        timezone: z.string(),
        media: z.array(z.object({ asset_id: z.string() })),
      }),
    )
    .mutation(async ({ input }) => {
      if (new Date(input.scheduled_for).getTime() <= Date.now())
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Choose a future date and time",
        });
      try {
        return (
          await axios.post<Schedule>(`${getApiBase()}/v1/schedules`, input, {
            headers: await getAuthHeaders(),
          })
        ).data;
      } catch (error) {
        return handleBackendError(error, "Could not schedule post");
      }
    }),
  searchMentions: getUserProcedure
    .input(
      z.object({
        query: z.string().max(100).default(""),
        limit: z.number().min(1).max(20).default(8),
      }),
    )
    .query(async ({ input }): Promise<MentionSearchResult[]> => {
      try {
        const headers = await getAuthHeaders();
        const response = await axios.get<MentionSearchResult[]>(
          `${getApiBase()}/v1/mentions/search`,
          {
            headers,
            params: {
              q: input.query,
              limit: input.limit,
            },
            timeout: 5000,
          },
        );
        return response.data;
      } catch (error) {
        return [];
      }
    }),
});

export interface MentionSearchResult {
  id: string;
  name: string;
  universal_name?: string | null;
  profile_url: string;
  avatar_url?: string | null;
  entity_type: "company" | "person";
  headline?: string | null;
}
