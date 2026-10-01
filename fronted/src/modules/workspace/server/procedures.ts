import axios from "axios";
import { z } from "zod";

import { authedProcedure, createTRPCRouter } from "@/trpc/init";
import {
  getApiBase,
  getAuthHeaders,
  getWorkspacesApiUrl,
  handleBackendError,
  setActiveWorkspaceCookie,
} from "@/lib/http-error";
import type {
  Workspace,
  WorkspaceInvitation,
  WorkspaceMember,
} from "@/modules/workspace/types";

export interface LinkedInConnectionData {
  id: string;
  workspace_id: string;
  profile_url: string;
  public_identifier: string;
  status: string;
  verification_method: string;
  is_primary: boolean;
  first_name?: string | null;
  last_name?: string | null;
  headline?: string | null;
  picture_url?: string | null;
  dash_entity_urn?: string | null;
  member_urn?: string | null;
  has_session: boolean;
  can_publish?: boolean;
  connected_at: string;
  last_confirmed_at: string;
}

export interface LinkedInVerifySessionResponse {
  valid: boolean | null;
  status: string;
  account_id?: string;
  message: string;
  status_code?: number;
  profile?: {
    public_identifier: string;
    first_name?: string | null;
    last_name?: string | null;
    headline?: string | null;
    picture_url?: string | null;
  };
  last_confirmed_at?: string;
}

export const workspaceRouter = createTRPCRouter({
  /**
   * Lists all workspaces for the currently authenticated user.
   */
  list: authedProcedure.query(async (): Promise<Workspace[]> => {
    try {
      const response = await axios.get<Workspace[]>(getWorkspacesApiUrl(), {
        headers: await getAuthHeaders(),
      });
      return response.data;
    } catch (error) {
      return handleBackendError(error, "Could not load workspaces");
    }
  }),

  /**
   * Retrieves the user's currently active workspace.
   */
  current: authedProcedure.query(async (): Promise<Workspace> => {
    try {
      const response = await axios.get<Workspace>(`${getWorkspacesApiUrl()}/current`, {
        headers: await getAuthHeaders(),
      });
      return response.data;
    } catch (error) {
      return handleBackendError(error, "Could not load current workspace");
    }
  }),

  /**
   * Creates a new workspace and sets it as active.
   */
  create: authedProcedure
    .input(z.object({ name: z.string().trim().min(1, "Workspace name is required").max(160) }))
    .mutation(async ({ input }): Promise<Workspace> => {
      try {
        const response = await axios.post<Workspace>(
          getWorkspacesApiUrl(),
          { name: input.name },
          { headers: await getAuthHeaders() },
        );

        await setActiveWorkspaceCookie(response.data.id);
        return response.data;
      } catch (error) {
        return handleBackendError(error, "Could not create workspace");
      }
    }),

  /**
   * Switches the active workspace in cookies.
   */
  switch: authedProcedure
    .input(z.object({ workspaceId: z.string().min(1, "Workspace ID is required") }))
    .mutation(async ({ input }) => {
      await setActiveWorkspaceCookie(input.workspaceId);
      return { success: true, workspaceId: input.workspaceId };
    }),

  /**
   * Retrieves all members of the current workspace.
   */
  members: authedProcedure.query(async (): Promise<WorkspaceMember[]> => {
    try {
      const response = await axios.get<WorkspaceMember[]>(
        `${getWorkspacesApiUrl()}/current/members`,
        { headers: await getAuthHeaders() },
      );
      return response.data;
    } catch (error) {
      return handleBackendError(error, "Could not load workspace members");
    }
  }),

  /**
   * Invites a new member to the current workspace.
   */
  invite: authedProcedure
    .input(
      z.object({
        email: z.string().email("Valid email is required"),
        role: z.enum(["admin", "editor", "viewer", "billing"]),
      }),
    )
    .mutation(async ({ input }): Promise<WorkspaceInvitation> => {
      try {
        const response = await axios.post<WorkspaceInvitation>(
          `${getWorkspacesApiUrl()}/current/invitations`,
          input,
          { headers: await getAuthHeaders() },
        );
        return response.data;
      } catch (error) {
        return handleBackendError(error, "Could not invite workspace member");
      }
    }),

  /**
   * Invites multiple members to the current workspace in a single batch.
   */
  bulkInvite: authedProcedure
    .input(
    z.object({
        invitations: z
          .array(
            z.object({
              email: z.string().email("Valid email is required"),
              role: z.enum(["admin", "editor", "viewer", "billing"]),
            }),
          )
          .min(1, "At least one invitation is required"),
      }),
    )
    .mutation(async ({ input }): Promise<WorkspaceInvitation[]> => {
      try {
        const response = await axios.post<WorkspaceInvitation[]>(
          `${getWorkspacesApiUrl()}/current/invitations/bulk`,
          input,
          { headers: await getAuthHeaders() },
        );
        return response.data;
      } catch (error) {
        return handleBackendError(error, "Could not invite workspace members");
      }
    }),

  /**
   * Accepts an invitation to join a workspace.
   */
  acceptInvitation: authedProcedure
    .input(z.object({ token: z.string().min(1, "Invitation token is required") }))
    .mutation(async ({ input }): Promise<Workspace> => {
      try {
        const response = await axios.post<Workspace>(
          `${getWorkspacesApiUrl()}/invitations/accept`,
          { token: input.token },
          { headers: await getAuthHeaders() },
        );

        await setActiveWorkspaceCookie(response.data.id);
        return response.data;
      } catch (error) {
        return handleBackendError(error, "Could not accept workspace invitation");
      }
    }),

  /**
   * Changes the role of a workspace member.
   */
  updateRole: authedProcedure
    .input(
      z.object({
        membershipId: z.string().min(1),
        role: z.enum(["admin", "editor", "viewer", "billing"]),
      }),
    )
    .mutation(async ({ input }): Promise<WorkspaceMember> => {
      try {
        const response = await axios.patch<WorkspaceMember>(
          `${getWorkspacesApiUrl()}/current/members/${encodeURIComponent(input.membershipId)}`,
          { role: input.role },
          { headers: await getAuthHeaders() },
        );
        return response.data;
      } catch (error) {
        return handleBackendError(error, "Could not update member role");
      }
    }),

  /**
   * Removes a member from the workspace.
   */
  removeMember: authedProcedure
    .input(z.object({ membershipId: z.string().min(1) }))
    .mutation(async ({ input }) => {
      try {
        await axios.delete(
          `${getWorkspacesApiUrl()}/current/members/${encodeURIComponent(input.membershipId)}`,
          { headers: await getAuthHeaders() },
        );
        return { success: true };
      } catch (error) {
        return handleBackendError(error, "Could not remove workspace member");
      }
    }),

  /**
   * Connects a LinkedIn account (or updates existing credentials) using server-side auth headers.
   */
  connectLinkedIn: authedProcedure
    .input(
      z.object({
        profile_url: z.string().optional(),
        public_identifier: z.string().optional(),
        username: z.string().optional(),
        first_name: z.string().optional(),
        last_name: z.string().optional(),
        headline: z.string().optional(),
        picture_url: z.string().optional(),
        dash_entity_urn: z.string().optional(),
        member_urn: z.string().optional(),
        cookie_li_at: z.string().optional(),
        cookie_jsessionid: z.string().optional(),
        user_agent: z.string().optional(),
      }),
    )
    .mutation(async ({ input }): Promise<LinkedInConnectionData> => {
      try {
        const response = await axios.post<LinkedInConnectionData>(
          `${getApiBase()}/v1/extension/linkedin/connect-web`,
          {
            ...input,
            confirmed_ownership: true,
          },
          { headers: await getAuthHeaders() },
        );
        return response.data;
      } catch (error) {
        return handleBackendError(error, "Failed to connect LinkedIn account");
      }
    }),

  /**
   * Retrieves the primary or specific connected LinkedIn account for the active workspace.
   */
  getLinkedInConnection: authedProcedure
    .input(z.object({ connectionId: z.string().optional() }).optional())
    .query(async ({ input }): Promise<LinkedInConnectionData | null> => {
      try {
        const params = input?.connectionId ? `?connection_id=${encodeURIComponent(input.connectionId)}` : "";
        const response = await axios.get<LinkedInConnectionData | null>(
          `${getApiBase()}/v1/extension/linkedin/connection${params}`,
          { headers: await getAuthHeaders() },
        );
        return response.data;
      } catch (error) {
        return handleBackendError(error, "Failed to load LinkedIn connection");
      }
    }),

  /**
   * Lists all connected LinkedIn accounts for the active workspace.
   */
  listLinkedInConnections: authedProcedure.query(async (): Promise<LinkedInConnectionData[]> => {
    try {
      const response = await axios.get<LinkedInConnectionData[]>(
        `${getApiBase()}/v1/extension/linkedin/connections`,
        { headers: await getAuthHeaders() },
      );
      return response.data;
    } catch (error) {
      return handleBackendError(error, "Failed to load LinkedIn accounts");
    }
  }),

  /**
   * Disconnects a specific LinkedIn account or all accounts from the workspace.
   */
  disconnectLinkedIn: authedProcedure
    .input(z.object({ connectionId: z.string().optional() }).optional())
    .mutation(async ({ input }): Promise<{ success: boolean }> => {
      try {
        if (input?.connectionId) {
          await axios.delete(
            `${getApiBase()}/v1/extension/linkedin/connections/${encodeURIComponent(input.connectionId)}`,
            { headers: await getAuthHeaders() },
          );
        } else {
          await axios.delete(
            `${getApiBase()}/v1/extension/linkedin/connection-web`,
            { headers: await getAuthHeaders() },
          );
        }
        return { success: true };
      } catch (error) {
        return handleBackendError(error, "Failed to disconnect LinkedIn account");
      }
    }),

  /**
   * Sets a specific LinkedIn connection as the primary connection for the workspace.
   */
  setPrimaryLinkedInConnection: authedProcedure
    .input(z.object({ connectionId: z.string().min(1) }))
    .mutation(async ({ input }): Promise<LinkedInConnectionData> => {
      try {
        const response = await axios.patch<LinkedInConnectionData>(
          `${getApiBase()}/v1/extension/linkedin/connections/${encodeURIComponent(input.connectionId)}/primary`,
          {},
          { headers: await getAuthHeaders() },
        );
        return response.data;
      } catch (error) {
        return handleBackendError(error, "Failed to set primary LinkedIn account");
      }
    }),

  /**
   * Tests stored cookies against LinkedIn's Voyager API for a workspace account.
   */
  verifyLinkedInSession: authedProcedure
    .input(z.object({ connectionId: z.string().optional() }).optional())
    .mutation(async ({ input }): Promise<LinkedInVerifySessionResponse> => {
      try {
        const params = input?.connectionId ? `?connection_id=${encodeURIComponent(input.connectionId)}` : "";
        const response = await axios.post<LinkedInVerifySessionResponse>(
          `${getApiBase()}/v1/extension/linkedin/verify-session${params}`,
          {},
          { headers: await getAuthHeaders() },
        );
        return response.data;
      } catch (error) {
        return handleBackendError(error, "Failed to verify LinkedIn session");
      }
    }),


  getBrandProfile:authedProcedure.query(async({ctx})=>{
    try {
      const response = await axios.get(`${getApiBase()}/v1/brand-profile`, {
        headers: await getAuthHeaders(),
      });
      return response.data;
    } catch (error) {
      return handleBackendError(error, "Could not load workspaces");
    }
  })
});
