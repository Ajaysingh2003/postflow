import axios from "axios";
import { z } from "zod";
import { authedProcedure, createTRPCRouter } from "@/trpc/init";
import {
  getApiBase,
  getAuthHeaders,
  handleBackendError,
} from "@/lib/http-error";
import type {
  Account,
  Feature,
  Payload,
  Post,
  PostLibraryPage,
  PostActions,
  RepliesPage,
  Variant,
  SubredditProfile,
  VariantMetrics,
  ValidationResult,
  AccountAnalytics,
  AnalyticsDashboard,
  WorkspaceOverview,
  PostFeedItemAnalytics,
} from "./types";
import type { CalendarPage } from "@/modules/schedule/calendarModel";
import type { PlanUsage, BillingUsage } from "@/modules/billing/usageModel";
import type { HomeSummary } from "@/modules/dashboard/homeModel";

async function backend<T>(
  method: "GET" | "POST" | "PATCH" | "DELETE",
  path: string,
  data?: unknown,
  params?: Record<string, unknown>,
  workspaceId?: string,
): Promise<T> {
  try {
    const response = await axios.request<T>({
      method,
      url: `${getApiBase()}/v1${path}`,
      data,
      params,
      headers: await getAuthHeaders(undefined, workspaceId),
      timeout: 60000,
    });
    return response.data;
  } catch (error) {
    return handleBackendError(error, "This action could not be completed.");
  }
}

const id = z.string().uuid();
const fields = z.record(z.string(), z.unknown());
const resources = {
  templates: "/templates",
  media: "/media",
  voices: "/assistant/voice-profiles",
  runs: "/assistant/runs",
  analytics: "/analytics/overview",
  usage: "/analytics/plan-limits",
  members: "/workspaces/current/members",
} as const;

export const studioRouter = createTRPCRouter({
  usage: authedProcedure
    .input(z.object({ workspace_id: id.optional() }))
    .query(({ input }) =>
      backend<PlanUsage>(
        "GET",
        "/analytics/plan-limits",
        undefined,
        undefined,
        input.workspace_id,
      ),
    ),
  billingUsage: authedProcedure
    .input(z.object({ workspace_id: id.optional() }))
    .query(({ input }) =>
      backend<BillingUsage>(
        "GET",
        "/billing/usage",
        undefined,
        undefined,
        input.workspace_id,
      ),
    ),
  home: authedProcedure
    .input(z.object({ workspace_id: id.optional() }))
    .query(({ input }) =>
      backend<HomeSummary>(
        "GET",
        "/posts/home",
        undefined,
        undefined,
        input.workspace_id,
      ),
    ),
  postLibrary: authedProcedure
    .input(
      z.object({
        connected_account_id: id,
        category: z.enum(["posts", "scheduled", "drafts"]).default("posts"),
        offset: z.number().int().min(0).default(0),
        limit: z.number().int().min(1).max(100).default(50),
      }),
    )
    .query(({ input }) =>
      backend<PostLibraryPage>("GET", "/posts/library", undefined, input),
    ),
  calendar: authedProcedure
    .input(
      z.object({
        start: z.string().datetime(),
        end: z.string().datetime(),
        cursor: z.number().int().min(0).optional(),
      }),
    )
    .query(({ input }) =>
      backend<CalendarPage>("GET", "/publishing/calendar", undefined, input),
    ),
  posts: authedProcedure
    .input(
      z.object({
        offset: z.number().int().min(0).default(0),
        status: z.string().optional(),
        connected_account_id: id.optional(),
      }),
    )
    .query(({ input }) =>
      backend<Post[]>("GET", "/posts", undefined, {
        offset: input.offset,
        limit: 100,
        variant_status: input.status,
        connected_account_id: input.connected_account_id,
      }),
    ),
  postSummary: authedProcedure
    .input(z.object({ connected_account_id: id.optional() }))
    .query(({ input }) =>
      backend<Record<string, number>>(
        "GET",
        "/posts/summary",
        undefined,
        input,
      ),
    ),
  post: authedProcedure
    .input(z.object({ id }))
    .query(({ input }) => backend<Post>("GET", `/posts/${input.id}`)),
  accounts: authedProcedure.query(() =>
    backend<Account[]>("GET", "/channels/accounts"),
  ),
  targets: authedProcedure
    .input(z.object({ id }))
    .query(({ input }) =>
      backend<{ targets: { id: string; name: string }[] }>(
        "GET",
        `/channels/accounts/${input.id}/targets`,
      ),
    ),
  capabilities: authedProcedure.query(() =>
    backend<{ platforms: Record<string, Payload> }>(
      "GET",
      "/channels/capabilities",
    ),
  ),
  accountCapabilities: authedProcedure
    .input(z.object({ id }))
    .query(({ input }) =>
      backend<Payload>("GET", `/channels/accounts/${input.id}/capabilities`),
    ),
  subreddit: authedProcedure
    .input(z.object({ id, name: z.string().regex(/^[a-zA-Z0-9_]{2,21}$/) }))
    .query(({ input }) =>
      backend<SubredditProfile>(
        "GET",
        `/channels/reddit/${input.id}/subreddits/${input.name}`,
      ),
    ),
  metrics: authedProcedure
    .input(z.object({ id }))
    .query(({ input }) =>
      backend<VariantMetrics>("GET", `/analytics/variants/${input.id}`),
    ),
  analyticsDashboard: authedProcedure
    .input(
      z.object({
        account_id: id.optional(),
        start_date: z.string().optional(),
        end_date: z.string().optional(),
        limit: z.number().int().min(1).max(100).default(50),
        offset: z.number().int().min(0).default(0),
        content_type: z.enum(["posts", "replies", "all"]).default("posts"),
      }),
    )
    .query(({ input }) =>
      backend<AnalyticsDashboard>(
        "GET",
        "/analytics/dashboard",
        undefined,
        input,
      ),
    ),
  analyticsRefresh: authedProcedure
    .input(
      z.object({
        account_id: id.optional(),
        start_date: z.string().optional(),
        end_date: z.string().optional(),
        limit: z.number().int().min(1).max(100).default(50),
        offset: z.number().int().min(0).default(0),
        content_type: z.enum(["posts", "replies", "all"]).default("posts"),
      }),
    )
    .mutation(({ input }) =>
      backend<AnalyticsDashboard>(
        "POST",
        "/analytics/dashboard/refresh",
        undefined,
        input,
      ),
    ),
  analyticsOverview: authedProcedure
    .input(
      z
        .object({
          days: z.number().int().min(1).max(365).optional(),
          account_id: id.optional(),
          start_date: z.string().optional(),
          end_date: z.string().optional(),
        })
        .optional(),
    )
    .query(({ input }) =>
      backend<WorkspaceOverview>("GET", "/analytics/overview", undefined, {
        days: input?.days ?? 30,
        account_id: input?.account_id,
        start_date: input?.start_date,
        end_date: input?.end_date,
      }),
    ),
  accountAnalytics: authedProcedure
    .input(
      z.object({
        id,
      }),
    )
    .query(({ input }) =>
      backend<AccountAnalytics>(
        "GET",
        `/analytics/accounts/${input.id}`,
        undefined,
        { live: "true" },
      ),
    ),
  allAccountsAnalytics: authedProcedure.query(() =>
    backend<AccountAnalytics[]>("GET", "/analytics/accounts", undefined, {
      live: "true",
    }),
  ),
  analyticsFeed: authedProcedure
    .input(
      z
        .object({
          account_id: id.optional(),
          start_date: z.string().optional(),
          end_date: z.string().optional(),
          limit: z.number().int().min(1).max(100).default(50),
          offset: z.number().int().min(0).default(0),
        })
        .optional(),
    )
    .query(({ input }) =>
      backend<PostFeedItemAnalytics[]>("GET", "/analytics/feed", undefined, {
        account_id: input?.account_id,
        start_date: input?.start_date,
        end_date: input?.end_date,
        limit: input?.limit ?? 50,
        offset: input?.offset ?? 0,
        live: "true",
      }),
    ),
  syncMetrics: authedProcedure.mutation(() =>
    backend<Payload>("POST", "/analytics/sync-now", {}),
  ),
  updateMedia: authedProcedure
    .input(z.object({ id, alt_text: z.string().max(1000) }))
    .mutation(({ input }) =>
      backend<Payload>("PATCH", `/media/${input.id}`, {
        alt_text: input.alt_text,
      }),
    ),
  validate: authedProcedure
    .input(z.object({ id }))
    .mutation(({ input }) =>
      backend<ValidationResult>(
        "POST",
        `/publishing/variants/${input.id}/validate`,
        {},
      ),
    ),
  actions: authedProcedure
    .input(z.object({ id }))
    .query(({ input }) =>
      backend<PostActions>(
        "GET",
        `/post-management/variants/${input.id}/actions`,
      ),
    ),
  replies: authedProcedure
    .input(z.object({ id, cursor: z.string().optional() }))
    .query(({ input }) =>
      backend<RepliesPage>(
        "GET",
        `/post-management/variants/${input.id}/replies`,
        undefined,
        { cursor: input.cursor },
      ),
    ),
  manage: authedProcedure
    .input(
      z.object({
        id,
        action: z.enum(["reply", "edit", "delete"]),
        request_id: id,
        text: z.string().optional(),
        target_token: z.string().optional(),
      }),
    )
    .mutation(({ input }) => {
      const suffix = {
        reply: "reply",
        edit: "published",
        delete: "delete-published",
      }[input.action];
      return backend<{
        message: string;
        external_id?: string;
        external_url?: string;
      }>(
        input.action === "edit" ? "PATCH" : "POST",
        `/post-management/variants/${input.id}/${suffix}`,
        {
          request_id: input.request_id,
          text: input.text,
          target_token: input.target_token,
        },
      );
    }),
  create: authedProcedure
    .input(
      z.object({
        title: z.string().min(1),
        base_text: z.string(),
        variants: z
          .array(
            z.object({
              platform: z.string(),
              connected_account_id: id,
              payload: fields,
              media_asset_ids: z.array(id).optional(),
            }),
          )
          .min(1),
      }),
    )
    .mutation(({ input }) => backend<Post>("POST", "/posts", input)),
  editDraft: authedProcedure
    .input(
      z.object({
        id,
        payload: fields,
        media_asset_ids: z.array(id).optional(),
      }),
    )
    .mutation(({ input }) =>
      backend<Variant>("PATCH", `/variants/${input.id}`, {
        payload: input.payload,
        media_asset_ids: input.media_asset_ids,
      }),
    ),
  addVariant: authedProcedure
    .input(
      z.object({
        post_id: id,
        platform: z.string(),
        connected_account_id: id,
        payload: fields,
        media_asset_ids: z.array(id),
        idempotency_key: z.string().min(1).max(128),
      }),
    )
    .mutation(({ input }) => {
      const { post_id, ...data } = input;
      return backend<Variant>("POST", `/posts/${post_id}/variants`, data);
    }),
  publish: authedProcedure
    .input(z.object({ id }))
    .mutation(({ input }) =>
      backend<Payload>(
        "POST",
        `/publishing/variants/${input.id}/publish-now`,
        {},
      ),
    ),
  schedule: authedProcedure
    .input(z.object({ id, scheduled_time: z.string() }))
    .mutation(({ input }) =>
      backend<Payload>("POST", `/publishing/variants/${input.id}/schedule`, {
        scheduled_time: input.scheduled_time,
      }),
    ),
  cancel: authedProcedure
    .input(z.object({ id }))
    .mutation(({ input }) =>
      backend<Payload>("POST", `/publishing/variants/${input.id}/cancel`, {}),
    ),
  attempts: authedProcedure
    .input(z.object({ id }))
    .query(({ input }) =>
      backend<Payload[]>("GET", `/publishing/variants/${input.id}/attempts`),
    ),
  features: authedProcedure.query(() =>
    backend<Feature[]>("GET", "/assistant/features"),
  ),
  runFeature: authedProcedure
    .input(
      z.object({
        feature: z.string(),
        platform: z.string(),
        input_data: fields,
        connected_account_id: id.optional(),
        validation_context: fields.optional(),
        voice_profile_id: id.optional(),
        writing_instructions: z.string().max(2000).optional(),
        output_language: z.string().max(80).optional(),
        conversation_id: id.optional(),
        request_id: id.optional(),
        conversation_prompt: z.string().max(10000).optional(),
        conversation_source: z.string().max(10000).optional(),
        workspace_id: id.optional(),
      }),
    )
    .mutation(({ input }) =>
      backend<{
        output: Payload;
        tokens_used: number;
        validation_issues: {
          field: string;
          message: string;
          severity: string;
        }[];
      }>(
        "POST",
        `/assistant/features/${encodeURIComponent(input.feature)}/run`,
        {
          platform: input.platform,
          input_data: input.input_data,
          connected_account_id: input.connected_account_id,
          validation_context: input.validation_context,
          voice_profile_id: input.voice_profile_id,
          writing_instructions: input.writing_instructions,
          output_language: input.output_language,
          conversation_id: input.conversation_id,
          request_id: input.request_id,
          conversation_prompt: input.conversation_prompt,
          conversation_source: input.conversation_source,
        },
        undefined,
        input.workspace_id,
      ),
    ),
  resource: authedProcedure
    .input(
      z.object({
        kind: z.enum([
          "templates",
          "media",
          "voices",
          "runs",
          "analytics",
          "usage",
          "members",
        ]),
      }),
    )
    .query(({ input }) =>
      backend<Payload | Payload[]>("GET", resources[input.kind]),
    ),
  createTemplate: authedProcedure
    .input(z.object({ name: z.string().min(1), base_text: z.string() }))
    .mutation(({ input }) => backend<Payload>("POST", "/templates", input)),
  trainVoice: authedProcedure
    .input(
      z.object({
        tone_description: z.string(),
        sample_posts: z.array(z.string()),
      }),
    )
    .mutation(({ input }) =>
      backend<Payload>("POST", "/assistant/voice-profiles/train", input),
    ),
  connect: authedProcedure
    .input(
      z.object({
        platform: z.enum([
          "x",
          "linkedin",
          "reddit",
          "bluesky",
          "mastodon",
          "facebook",
          "instagram",
          "threads",
        ]),
        options: fields.optional(),
        return_to: z
          .enum(["/dashboard/channels", "/onboarding?step=connect"])
          .optional(),
      }),
    )
    .mutation(({ input }) =>
      backend<{ auth_url: string }>(
        "POST",
        `/channels/${input.platform}/connect`,
        {
          options: input.options ?? {},
          ...(input.return_to ? { return_to: input.return_to } : {}),
        },
      ),
    ),
  disconnect: authedProcedure
    .input(z.object({ id }))
    .mutation(({ input }) =>
      backend<Payload>("POST", `/channels/accounts/${input.id}/disconnect`, {}),
    ),
  refreshAccount: authedProcedure
    .input(z.object({ id }))
    .mutation(({ input }) =>
      backend<Account>("POST", `/channels/accounts/${input.id}/refresh`, {}),
    ),
});
