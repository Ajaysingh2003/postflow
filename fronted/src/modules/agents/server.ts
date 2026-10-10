import axios from "axios";
import { z } from "zod";
import { authedProcedure, createTRPCRouter } from "@/trpc/init";
import {
  getApiBase,
  getAuthHeaders,
  handleBackendError,
} from "@/lib/http-error";
import type { AgentConnection, AgentSettings } from "./model";

async function backend<T>(
  method: "GET" | "POST" | "DELETE",
  path: string,
  data?: unknown,
  workspaceId?: string,
) {
  try {
    const response = await axios.request<T>({
      method,
      url: `${getApiBase()}/v1/agents${path}`,
      data,
      headers: await getAuthHeaders(undefined, workspaceId),
      timeout: 15000,
    });
    return response.data;
  } catch (error) {
    return handleBackendError(
      error,
      "Could not complete this agent connection.",
    );
  }
}

export const agentsRouter = createTRPCRouter({
  settings: authedProcedure
    .input(z.object({ workspace_id: z.string().uuid().optional() }))
    .query(({ input }) =>
      backend<AgentSettings>(
        "GET",
        "/connections",
        undefined,
        input.workspace_id,
      ),
    ),
  createToken: authedProcedure
    .input(
      z.object({
        name: z.string().trim().min(1).max(160),
        scopes: z
          .array(
            z.enum([
              "draftva:read",
              "draftva:write",
              "draftva:publish",
              "draftva:assistant",
            ]),
          )
          .min(1)
          .max(4),
        workspace_id: z.string().uuid().optional(),
      }),
    )
    .mutation(({ input }) =>
      backend<{ token: string; connection: AgentConnection }>(
        "POST",
        "/connections",
        { name: input.name, scopes: input.scopes },
        input.workspace_id,
      ),
    ),
  revoke: authedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        workspace_id: z.string().uuid().optional(),
      }),
    )
    .mutation(({ input }) =>
      backend<{ revoked: boolean }>(
        "DELETE",
        `/connections/${input.id}`,
        undefined,
        input.workspace_id,
      ),
    ),
  authorization: authedProcedure
    .input(z.object({ request: z.string().min(1).max(128) }))
    .query(async ({ input }) => {
      try {
        const response = await axios.get<{
          client_name: string;
          redirect_origin: string;
          scopes: Record<string, string>;
        }>(`${getApiBase()}/v1/agents/authorization`, {
          params: input,
          headers: await getAuthHeaders(),
          timeout: 15000,
        });
        return response.data;
      } catch (error) {
        return handleBackendError(
          error,
          "Could not load this connection request.",
        );
      }
    }),
  decide: authedProcedure
    .input(
      z.object({
        request: z.string().min(1).max(128),
        approve: z.boolean(),
        workspace_id: z.string().uuid().optional(),
      }),
    )
    .mutation(({ input }) =>
      backend<{ redirect_url: string }>(
        "POST",
        "/authorization",
        { request: input.request, approve: input.approve },
        input.workspace_id,
      ),
    ),
});
