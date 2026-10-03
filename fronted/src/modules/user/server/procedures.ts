import axios from "axios";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
  authedProcedure,
  baseProcedure,
  createTRPCRouter,
  getUserProcedure,
  invalidateUserSession,
} from "@/trpc/init";
import {
  clearAuthCookies,
  getAccessToken,
  getAuthApiUrl,
  getAuthHeaders,
  handleBackendError,
  setAuthCookies,
} from "@/lib/http-error";
import type {
  ApiKey,
  AuthMessage,
  AuthResponse,
  AuthUser,
  CreatedApiKey,
  MessageResponse,
  OAuthStartResponse,
  RegisterResponse,
  SessionResponse,
  TokenResponse,
} from "@/modules/user/types";

export const userRouter = createTRPCRouter({
  /**
   * User registration: creates user, default workspace, and 30-day session token.
   * Also sets HTTP-only session cookies so the user is immediately authenticated.
   */
  register: baseProcedure
    .input(
      z.object({
        email: z.string().email("Invalid email address"),
        password: z.string().min(10, "Password must be at least 10 characters").max(200),
        name: z.string().min(1).max(160).optional(),
        display_name: z.string().min(1).max(160).optional(),
      }),
    )
    .mutation(async ({ input }): Promise<RegisterResponse> => {
      const name = (input.name || input.display_name || input.email.split("@")[0]).trim();
      try {
        const response = await axios.post<AuthResponse>(`${getAuthApiUrl()}/register`, {
          email: input.email,
          password: input.password,
          name,
        });

        await setAuthCookies(response.data);

        const authUser: AuthUser = {
          id: response.data.user_id,
          email: input.email,
          name,
          display_name: name,
          email_verified: false,
          workspace_id: response.data.workspace_id,
        };

        return {
          ...response.data,
          user: authUser,
          verification_required: false,
        };
      } catch (error) {
        return handleBackendError(error, "Registration failed");
      }
    }),

  /**
   * User login: validates credentials, returns access token, and sets cookies.
   */
  login: baseProcedure
    .input(
      z.object({
        email: z.string().email("Invalid email address"),
        password: z.string().min(1, "Password is required"),
      }),
    )
    .mutation(async ({ input }): Promise<TokenResponse> => {
      try {
        const response = await axios.post<AuthResponse>(`${getAuthApiUrl()}/login`, {
          email: input.email,
          password: input.password,
        });

        await setAuthCookies(response.data);

        return {
          ...response.data,
          user: {
            id: response.data.user_id,
            email: input.email,
            name: "",
            display_name: "",
            email_verified: false,
            workspace_id: response.data.workspace_id,
          },
        };
      } catch (error) {
        return handleBackendError(error, "Invalid email or password");
      }
    }),

  /**
   * Google login: exchanges a Google ID token for an authenticated session.
   */
  google: baseProcedure
    .input(z.object({ id_token: z.string().min(20, "Valid Google token required") }))
    .mutation(async ({ input }): Promise<TokenResponse> => {
      try {
        const response = await axios.post<AuthResponse>(`${getAuthApiUrl()}/google`, {
          id_token: input.id_token,
        });

        await setAuthCookies(response.data);
        return response.data;
      } catch (error) {
        return handleBackendError(error, "Google authentication failed");
      }
    }),

  /**
   * Google Sign-in helper for UI components initiating the flow.
   */
  googleSignIn: baseProcedure.mutation((): OAuthStartResponse => ({
    provider: "google",
    url: `${getAuthApiUrl()}/google`,
  })),

  /**
   * Fetches the current authenticated user from the backend identity service.
   * Utilizes getUserProcedure session caching to avoid redundant roundtrips.
   */
  me: getUserProcedure.query(async ({ ctx }): Promise<AuthUser> => {
    if (!ctx.user) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: "Not signed in" });
    }
    return ctx.user as AuthUser;
  }),

  /**
   * Fast client profile query returning the context user (or null if unauthenticated).
   */
  profile: getUserProcedure.query(({ ctx }) => {
    return (ctx.user as AuthUser | null) ?? null;
  }),

  /**
   * Updates user profile (name/display_name) in the backend database.
   */
  updateProfile: authedProcedure
    .input(
      z.object({
        name: z.string().trim().min(1).max(160).optional(),
        display_name: z.string().trim().min(1).max(160).optional(),
      }),
    )
    .mutation(async ({ input, ctx }): Promise<AuthUser> => {
      const name = (input.name || input.display_name)?.trim();
      if (!name) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Name is required" });
      }

      try {
        const response = await axios.patch<AuthUser>(
          `${getAuthApiUrl()}/me`,
          { name },
          { headers: await getAuthHeaders((ctx as any)?.token) },
        );

        invalidateUserSession((ctx as any)?.token);

        return {
          ...response.data,
          display_name: response.data.name,
        };
      } catch (error) {
        return handleBackendError(error, "Could not update profile");
      }
    }),

  /**
   * Logs out the current session and clears cookies.
   */
  logout: baseProcedure.mutation(async () => {
    try {
      const token = await getAccessToken();
      if (token) {
        invalidateUserSession(token);
        await axios.post(`${getAuthApiUrl()}/logout`, {}, { headers: await getAuthHeaders(token) });
      }
    } catch {
      // Ignore remote revocation failures; always clear local cookies.
    }

    await clearAuthCookies();
    invalidateUserSession();
    return { success: true };
  }),

  /**
   * Revokes all active sessions for the user and clears cookies.
   */
  logoutAll: authedProcedure.mutation(async ({ ctx }) => {
    try {
      invalidateUserSession((ctx as any)?.token);
      await axios.post(`${getAuthApiUrl()}/logout-all`, {}, { headers: await getAuthHeaders((ctx as any)?.token) });
    } catch (error) {
      await clearAuthCookies();
      invalidateUserSession();
      return handleBackendError(error, "Could not terminate all sessions");
    }

    await clearAuthCookies();
    invalidateUserSession();
    return { success: true };
  }),

  /**
   * Lists all active sessions for the authenticated user.
   */
  listSessions: authedProcedure.query(async (): Promise<SessionResponse[]> => {
    try {
      const response = await axios.get<SessionResponse[]>(`${getAuthApiUrl()}/sessions`, {
        headers: await getAuthHeaders(),
      });
      return response.data;
    } catch (error) {
      return handleBackendError(error, "Could not retrieve sessions");
    }
  }),

  /**
   * Revokes a specific session by ID.
   */
  revokeSession: authedProcedure
    .input(z.object({ sessionId: z.string().min(1) }))
    .mutation(async ({ input }) => {
      try {
        await axios.delete(`${getAuthApiUrl()}/sessions/${encodeURIComponent(input.sessionId)}`, {
          headers: await getAuthHeaders(),
        });
        return { success: true };
      } catch (error) {
        return handleBackendError(error, "Could not revoke session");
      }
    }),

  /**
   * Sends or requests email verification instructions.
   */
  requestVerification: authedProcedure.mutation(async (): Promise<MessageResponse> => {
    try {
      const response = await axios.post<MessageResponse>(
        `${getAuthApiUrl()}/email/request-verification`,
        {},
        { headers: await getAuthHeaders() },
      );
      return response.data;
    } catch (error) {
      return handleBackendError(error, "Could not request verification email");
    }
  }),

  /**
   * Alias for resending verification code.
   */
  resendVerification: baseProcedure
    .input(z.object({ email: z.string().email().optional() }))
    .mutation(async (): Promise<AuthMessage> => {
      const token = await getAccessToken();
      if (!token) {
        // If not logged in, inform user to sign in to request verification
        return {
          message: "Please sign in to request verification instructions.",
          detail: "Please sign in to request verification instructions.",
        };
      }

      try {
        const response = await axios.post<MessageResponse>(
          `${getAuthApiUrl()}/email/request-verification`,
          {},
          { headers: await getAuthHeaders(token) },
        );
        return {
          ...response.data,
          detail: response.data.message,
        };
      } catch (error) {
        return handleBackendError(error, "Could not resend verification code");
      }
    }),

  /**
   * Confirms email address with a verification token.
   */
  verifyEmail: baseProcedure
    .input(
      z.object({
        email: z.string().email().optional(),
        token: z.string().min(1, "Verification token is required"),
      }),
    )
    .mutation(async ({ input }): Promise<MessageResponse> => {
      try {
        const response = await axios.post<MessageResponse>(`${getAuthApiUrl()}/email/verify`, {
          token: input.token,
        });
        return response.data;
      } catch (error) {
        return handleBackendError(error, "Email verification failed");
      }
    }),

  /**
   * Requests a password recovery link.
   */
  forgotPassword: baseProcedure
    .input(z.object({ email: z.string().email("Invalid email address") }))
    .mutation(async ({ input }): Promise<MessageResponse> => {
      try {
        const response = await axios.post<MessageResponse>(`${getAuthApiUrl()}/password/forgot`, {
          email: input.email,
        });
        return {
          ...response.data,
          detail: response.data.message,
        };
      } catch (error) {
        return handleBackendError(error, "Could not start password recovery");
      }
    }),

  /**
   * Completes password reset with reset token and new password.
   */
  resetPassword: baseProcedure
    .input(
      z.object({
        token: z.string().min(1, "Reset token is required"),
        password: z.string().min(10, "Password must be at least 10 characters").max(200),
      }),
    )
    .mutation(async ({ input }): Promise<MessageResponse> => {
      try {
        const response = await axios.post<MessageResponse>(`${getAuthApiUrl()}/password/reset`, {
          token: input.token,
          password: input.password,
        });
        return response.data;
      } catch (error) {
        return handleBackendError(error, "Password reset failed");
      }
    }),

  /**
   * Verifies that the current session token is still valid in backend,
   * refreshing cookie maxAge. Used by SessionKeeper.
   */
  refresh: baseProcedure.mutation(async (): Promise<TokenResponse> => {
    const token = await getAccessToken();
    if (!token) {
      await clearAuthCookies();
      throw new TRPCError({ code: "UNAUTHORIZED", message: "Session expired" });
    }

    try {
      const response = await axios.get<AuthUser>(`${getAuthApiUrl()}/me`, {
        headers: await getAuthHeaders(token),
      });

      await setAuthCookies({
        access_token: token,
        workspace_id: response.data.workspace_id,
      });

      return {
        access_token: token,
        token_type: "bearer",
        expires_in: 60 * 60 * 24 * 30,
        user_id: response.data.id,
        workspace_id: response.data.workspace_id,
        user: {
          ...response.data,
          display_name: response.data.name,
        },
      };
    } catch (error) {
      await clearAuthCookies();
      return handleBackendError(error, "Session expired");
    }
  }),

  // Compatibility stubs for deprecated API keys
  listApiKeys: authedProcedure.query(async (): Promise<ApiKey[]> => []),
  createApiKey: authedProcedure
    .input(z.object({ name: z.string().trim().min(1) }))
    .mutation(async (): Promise<CreatedApiKey> => {
      throw new TRPCError({ code: "NOT_FOUND", message: "API keys are not supported in this version" });
    }),
  revokeApiKey: authedProcedure
    .input(z.object({ keyId: z.string().min(1) }))
    .mutation(async () => {
      throw new TRPCError({ code: "NOT_FOUND", message: "API keys are not supported in this version" });
    }),
});
