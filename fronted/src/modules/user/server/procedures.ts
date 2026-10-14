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
  getAuthClientHeaders,
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
  RegisterResponse,
  SessionResponse,
  TokenResponse,
} from "@/modules/user/types";

import { publicAuthSession } from "../authFlow";

export const userRouter = createTRPCRouter({
  /**
   * User registration: creates user, default workspace, and 30-day session token.
   * Also sets HTTP-only session cookies so the user is immediately authenticated.
   */
  register: baseProcedure
    .input(
      z.object({
        email: z.string().trim().email("Invalid email address"),
        password: z
          .string()
          .min(10, "Password must be at least 10 characters")
          .max(200),
        name: z.string().trim().min(2).max(160).optional(),
        display_name: z.string().trim().min(2).max(160).optional(),
      }),
    )
    .mutation(async ({ input }): Promise<RegisterResponse> => {
      const name = (
        input.name ||
        input.display_name ||
        input.email.split("@")[0]
      ).trim();
      try {
        const response = await axios.post<AuthResponse>(
          `${getAuthApiUrl()}/register`,
          {
            email: input.email,
            password: input.password,
            name,
          },
          { headers: await getAuthClientHeaders(), timeout: 25_000 },
        );

        await setAuthCookies(response.data);
        invalidateUserSession(response.data.access_token);

        const session = publicAuthSession(response.data);
        return {
          ...session,
          verification_required: !!session.verification_required,
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
        email: z.string().trim().email("Invalid email address"),
        password: z.string().min(1, "Password is required").max(200),
      }),
    )
    .mutation(async ({ input }): Promise<TokenResponse> => {
      try {
        const response = await axios.post<AuthResponse>(
          `${getAuthApiUrl()}/login`,
          {
            email: input.email,
            password: input.password,
          },
          { headers: await getAuthClientHeaders(), timeout: 25_000 },
        );

        await setAuthCookies(response.data);
        invalidateUserSession(response.data.access_token);

        return publicAuthSession(response.data);
      } catch (error) {
        return handleBackendError(error, "Invalid email or password");
      }
    }),

  /**
   * Google login: exchanges a Google ID token for an authenticated session.
   */
  google: baseProcedure
    .input(
      z.object({
        id_token: z.string().min(20, "Valid Google token required").max(8192),
      }),
    )
    .mutation(async ({ input }): Promise<TokenResponse> => {
      try {
        const response = await axios.post<AuthResponse>(
          `${getAuthApiUrl()}/google`,
          {
            id_token: input.id_token,
          },
          { headers: await getAuthClientHeaders(), timeout: 25_000 },
        );

        await setAuthCookies(response.data);
        invalidateUserSession(response.data.access_token);
        return publicAuthSession(response.data);
      } catch (error) {
        return handleBackendError(error, "Google authentication failed");
      }
    }),

  /**
   * Google Sign-in helper for UI components initiating the flow.
   */
  authConfig: baseProcedure.query(
    async (): Promise<{
      google_client_id: string | null;
      x_login_enabled: boolean;
    }> => {
      try {
        return (await axios.get(`${getAuthApiUrl()}/config`, { timeout: 8000 }))
          .data;
      } catch (error) {
        return handleBackendError(error, "Could not load sign-in options");
      }
    },
  ),

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
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Name is required",
        });
      }

      try {
        const response = await axios.patch<AuthUser>(
          `${getAuthApiUrl()}/me`,
          { name },
          { headers: await getAuthHeaders(ctx.token) },
        );

        invalidateUserSession(ctx.token);

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
        await axios.post(
          `${getAuthApiUrl()}/logout`,
          {},
          { headers: await getAuthHeaders(token) },
        );
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
      invalidateUserSession(ctx.token);
      await axios.post(
        `${getAuthApiUrl()}/logout-all`,
        {},
        { headers: await getAuthHeaders(ctx.token) },
      );
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
      const response = await axios.get<SessionResponse[]>(
        `${getAuthApiUrl()}/sessions`,
        {
          headers: await getAuthHeaders(),
        },
      );
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
        await axios.delete(
          `${getAuthApiUrl()}/sessions/${encodeURIComponent(input.sessionId)}`,
          {
            headers: await getAuthHeaders(),
          },
        );
        return { success: true };
      } catch (error) {
        return handleBackendError(error, "Could not revoke session");
      }
    }),

  /**
   * Sends or requests email verification instructions.
   */
  requestVerification: authedProcedure.mutation(
    async (): Promise<MessageResponse> => {
      try {
        const response = await axios.post<MessageResponse>(
          `${getAuthApiUrl()}/email/request-verification`,
          {},
          { headers: await getAuthHeaders() },
        );
        return response.data;
      } catch (error) {
        return handleBackendError(
          error,
          "Could not request verification email",
        );
      }
    },
  ),

  verificationStatus: authedProcedure.query(
    async ({ ctx }): Promise<MessageResponse> => {
      try {
        return (
          await axios.get<MessageResponse>(`${getAuthApiUrl()}/email/status`, {
            headers: await getAuthHeaders(ctx.token),
            timeout: 8000,
          })
        ).data;
      } catch (error) {
        return handleBackendError(error, "Could not check verification status");
      }
    },
  ),

  /**
   * Alias for resending verification code.
   */
  resendVerification: getUserProcedure
    .input(z.object({ email: z.string().trim().email() }))
    .mutation(async ({ input, ctx }): Promise<AuthMessage> => {
      try {
        const ownsEmail =
          (ctx.user as AuthUser | null)?.email?.toLowerCase() ===
          input.email.toLowerCase();
        if (ctx.user && !(ctx.user as AuthUser).email_verified && !ownsEmail) {
          const result = await axios.patch<MessageResponse>(
            `${getAuthApiUrl()}/email`,
            { email: input.email },
            { headers: await getAuthHeaders(ctx.token), timeout: 25_000 },
          );
          invalidateUserSession(ctx.token);
          return result.data;
        }
        const response = await axios.post<MessageResponse>(
          `${getAuthApiUrl()}/email/${ownsEmail ? "request-verification" : "resend"}`,
          ownsEmail ? {} : { email: input.email },
          {
            headers: ownsEmail
              ? await getAuthHeaders(ctx.token)
              : await getAuthClientHeaders(),
            timeout: 25_000,
          },
        );
        return response.data;
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
        const response = await axios.post<MessageResponse>(
          `${getAuthApiUrl()}/email/verify`,
          {
            token: input.token,
            email: input.email,
          },
          { headers: await getAuthClientHeaders(), timeout: 15_000 },
        );
        const sessionToken = await getAccessToken();
        invalidateUserSession(sessionToken);
        let authenticated = false;
        if (sessionToken) {
          try {
            const me = await axios.get<AuthUser>(`${getAuthApiUrl()}/me`, {
              headers: await getAuthHeaders(sessionToken),
              timeout: 8000,
            });
            authenticated =
              me.data.email_verified &&
              (!input.email ||
                me.data.email.toLowerCase() === input.email.toLowerCase());
          } catch {
            /* Verification succeeded; an expired session can sign in again. */
          }
        }
        return { ...response.data, authenticated };
      } catch (error) {
        return handleBackendError(error, "Email verification failed");
      }
    }),

  /**
   * Requests a password recovery link.
   */
  forgotPassword: baseProcedure
    .input(
      z.object({ email: z.string().trim().email("Invalid email address") }),
    )
    .mutation(async ({ input }): Promise<MessageResponse> => {
      try {
        const response = await axios.post<MessageResponse>(
          `${getAuthApiUrl()}/password/forgot`,
          {
            email: input.email,
          },
          { headers: await getAuthClientHeaders(), timeout: 25_000 },
        );
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
        password: z
          .string()
          .min(10, "Password must be at least 10 characters")
          .max(200),
      }),
    )
    .mutation(async ({ input }): Promise<MessageResponse> => {
      try {
        const response = await axios.post<MessageResponse>(
          `${getAuthApiUrl()}/password/reset`,
          {
            token: input.token,
            password: input.password,
          },
          { headers: await getAuthClientHeaders(), timeout: 15_000 },
        );
        await clearAuthCookies();
        invalidateUserSession();
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
      const response = await axios.get<AuthResponse>(
        `${getAuthApiUrl()}/session`,
        {
          headers: await getAuthHeaders(token),
          timeout: 8000,
        },
      );
      await setAuthCookies(response.data);
      invalidateUserSession(token);
      return publicAuthSession(response.data);
    } catch (error) {
      return handleBackendError(error, "Could not check your session");
    }
  }),

  // Compatibility stubs for deprecated API keys
  listApiKeys: authedProcedure.query(async (): Promise<ApiKey[]> => []),
  createApiKey: authedProcedure
    .input(z.object({ name: z.string().trim().min(1) }))
    .mutation(async (): Promise<CreatedApiKey> => {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "API keys are not supported in this version",
      });
    }),
  revokeApiKey: authedProcedure
    .input(z.object({ keyId: z.string().min(1) }))
    .mutation(async () => {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "API keys are not supported in this version",
      });
    }),
});
