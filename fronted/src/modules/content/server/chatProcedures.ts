import axios from "axios";
import { z } from "zod";
import {
  getApiBase,
  getAuthHeaders,
  handleBackendError,
} from "@/lib/http-error";
import { authedProcedure, createTRPCRouter } from "@/trpc/init";
import type { ChatPage, Conversation, ConversationPage } from "../chatTypes";
import type { Payload } from "@/modules/studio/types";
const scope = z.object({
  workspace_id: z.string().uuid(),
  viewer_id: z.string().uuid(),
});
async function request<T>(
  method: "GET" | "POST",
  path: string,
  workspaceId: string,
  data?: unknown,
  params?: unknown,
) {
  try {
    return (
      await axios.request<T>({
        method,
        url: `${getApiBase()}/v1/assistant/conversations${path}`,
        headers: await getAuthHeaders(undefined, workspaceId),
        data,
        params,
        timeout: method === "POST" ? 120000 : 15000,
      })
    ).data;
  } catch (error) {
    return handleBackendError(
      error,
      "Your conversation couldn’t load. Please try again.",
    );
  }
}
export const assistantChatsRouter = createTRPCRouter({
  list: authedProcedure
    .input(
      scope.extend({
        search: z.string().max(160).default(""),
        cursor: z.number().int().min(0).optional(),
      }),
    )
    .query(({ input }) =>
      request<ConversationPage>("GET", "", input.workspace_id, undefined, {
        search: input.search,
        cursor: input.cursor,
      }),
    ),
  detail: authedProcedure
    .input(
      scope.extend({
        id: z.string().uuid(),
        cursor: z.number().int().min(1).optional(),
      }),
    )
    .query(({ input }) =>
      request<ChatPage>("GET", `/${input.id}`, input.workspace_id, undefined, {
        cursor: input.cursor,
      }),
    ),
  create: authedProcedure
    .input(
      scope.extend({
        id: z.string().uuid(),
        title: z.string().trim().min(1).max(160),
        platform: z.string().max(32),
        connected_account_id: z.string().uuid().optional(),
        context: z.object({
          source_text: z.string().max(10000),
          origin_scope: z.string().max(2000),
          account_name: z.string().max(240),
          draft_id: z.string().uuid().nullable().optional(),
        }),
      }),
    )
    .mutation(({ input }) => {
      const workspace_id = input.workspace_id;
      const body = {
        id: input.id,
        title: input.title,
        platform: input.platform,
        connected_account_id: input.connected_account_id,
        context: input.context,
      };
      return request<Conversation>("POST", "", workspace_id, body);
    }),
  continue: authedProcedure
    .input(
      scope.extend({
        id: z.string().uuid(),
        prompt: z.string().trim().min(3).max(10000),
        request_id: z.string().uuid(),
      }),
    )
    .mutation(({ input }) =>
      request<{ output: Payload; tokens_used: number }>(
        "POST",
        `/${input.id}/messages`,
        input.workspace_id,
        { prompt: input.prompt, request_id: input.request_id },
      ),
    ),
});
