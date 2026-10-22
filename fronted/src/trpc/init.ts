import { initTRPC, TRPCError } from "@trpc/server";
import { cookies } from "next/headers";
import axios from "axios";
import { getApiBase } from "@/lib/http-error";
import { authUserSchema, parseAuthResponse } from "@/modules/user/contracts";
import type { AuthUser } from "@/modules/user/types";

function decodeCookie(value: string): string | undefined {
  try {
    return decodeURIComponent(value);
  } catch {
    return undefined;
  }
}

export const createTRPCContext = async (opts?: { req?: Request }) => {
  let tokenFromHeader: string | undefined;
  let workspaceFromHeader: string | undefined;

  if (opts?.req) {
    const cookieHeader = opts.req.headers.get("cookie") || "";
    const tokenMatch = cookieHeader.match(/(?:^|;\s*)access_token=([^;]+)/);
    if (tokenMatch) {
      tokenFromHeader = decodeCookie(tokenMatch[1]);
    }
    const wsMatch = cookieHeader.match(/(?:^|;\s*)workspace_id=([^;]+)/);
    if (wsMatch) {
      workspaceFromHeader = decodeCookie(wsMatch[1]);
    }
    const authHeader = opts.req.headers.get("authorization");
    if (!tokenFromHeader && authHeader?.startsWith("Bearer ")) {
      tokenFromHeader = authHeader.slice(7).trim();
    }
    const wsHeader = opts.req.headers.get("x-workspace-id");
    if (!workspaceFromHeader && wsHeader) {
      workspaceFromHeader = wsHeader.trim();
    }
  }

  return {
    tokenFromHeader,
    workspaceFromHeader,
  };
};

export type Context = Awaited<ReturnType<typeof createTRPCContext>>;

const t = initTRPC.context<Context>().create({
  errorFormatter({ shape, error }) {
    const retryAfter = (error.cause as Error & { retryAfter?: number })
      ?.retryAfter;
    return { ...shape, data: { ...shape.data, retryAfter } };
  },
});

// Base router and procedure helpers
export const createTRPCRouter = t.router;
export const createCallerFactory = t.createCallerFactory;

export const baseProcedure = t.procedure.use(async ({ next }) => {
  return next({ ctx: {} });
});

interface CachedUserSession {
  user: AuthUser;
  timestamp: number;
}

// In-memory cache for validated user profiles to prevent hammering the backend
// /v1/auth/me on every concurrent procedure or rapid navigation.
const userSessionCache = new Map<string, CachedUserSession>();
const userSessionInFlight = new Map<string, Promise<AuthUser | null>>();
const userSessionRequestMarkers = new Map<string, symbol>();
const USER_CACHE_TTL_MS = 60 * 1000; // 60 seconds

export function invalidateUserSession(token?: string) {
  if (token) {
    userSessionCache.delete(token);
    userSessionInFlight.delete(token);
    userSessionRequestMarkers.delete(token);
  } else {
    userSessionCache.clear();
    userSessionInFlight.clear();
    userSessionRequestMarkers.clear();
  }
}

async function fetchUserWithCache(
  access_token: string,
  workspace_id?: string,
): Promise<AuthUser | null> {
  const cached = userSessionCache.get(access_token);
  const now = Date.now();

  // Return fresh cached session if still valid
  if (
    cached?.user.email_verified &&
    now - cached.timestamp < USER_CACHE_TTL_MS
  ) {
    return cached.user;
  }

  // Deduplicate simultaneous requests for the same token
  const pending = userSessionInFlight.get(access_token);
  if (pending) {
    return pending;
  }

  const marker = Symbol();
  userSessionRequestMarkers.set(access_token, marker);
  const promise: Promise<AuthUser | null> = (async () => {
    try {
      const headers: Record<string, string> = {
        Authorization: `Bearer ${access_token}`,
      };
      if (workspace_id) {
        headers["X-Workspace-ID"] = workspace_id;
      }

      const res = await axios.get(`${getApiBase()}/v1/auth/me`, {
        headers,
        timeout: 8000,
      });

      const profile = parseAuthResponse(authUserSchema, res.data);
      const user = { ...profile, display_name: profile.name };

      if (userSessionRequestMarkers.get(access_token) === marker) {
        if (userSessionCache.size >= 1000) {
          const oldest = userSessionCache.keys().next().value;
          if (oldest) userSessionCache.delete(oldest);
        }
        userSessionCache.set(access_token, { user, timestamp: Date.now() });
      }

      return user;
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        const status = err.response?.status;
        // 401: Token is genuinely expired, revoked, or invalid
        if (status === 401) {
          userSessionCache.delete(access_token);
          return null;
        }

        if (status === 403) {
          userSessionCache.delete(access_token);
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Your session no longer has access. Please sign in again.",
          });
        }

        // If rate limited and no cache, throw clear rate-limit error
        if (status === 429) {
          throw new TRPCError({
            code: "TOO_MANY_REQUESTS",
            message: "Too many requests. Please wait a moment.",
          });
        }
      }

      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Could not check your session. Please try again.",
      });
    } finally {
      if (userSessionRequestMarkers.get(access_token) === marker) {
        userSessionInFlight.delete(access_token);
        userSessionRequestMarkers.delete(access_token);
      }
    }
  })();

  userSessionInFlight.set(access_token, promise);
  return promise;
}

export const getUserProcedure = baseProcedure.use(async ({ ctx, next }) => {
  let access_token = ctx.tokenFromHeader;
  let workspace_id = ctx.workspaceFromHeader;

  try {
    const cookieStore = await cookies();
    access_token = cookieStore.get("access_token")?.value ?? access_token;
    workspace_id = cookieStore.get("workspace_id")?.value ?? workspace_id;
  } catch {
    // cookies() may throw in certain contexts, fallback to context tokens
  }

  if (!access_token) {
    return next({
      ctx: {
        ...ctx,
        user: null,
        token: undefined,
        workspace_id: undefined,
      },
    });
  }

  const user = await fetchUserWithCache(access_token, workspace_id);

  return next({
    ctx: {
      ...ctx,
      user,
      token: access_token,
      workspace_id,
    },
  });
});

export const authedProcedure = getUserProcedure.use(async ({ ctx, next }) => {
  // if (!ctx.user || !ctx.token) {
  //   throw new TRPCError({
  //     code: "UNAUTHORIZED",
  //     message: "Authentication required",
  //   });
  // }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
      token: ctx.token,
      workspace_id: ctx.workspace_id,
    },
  });
});

export const protectedProcedure = (requiredPermissions: string[]) =>
  getUserProcedure.use(async ({ ctx, next }) => {
    const userRole = (ctx.user as (AuthUser & { role?: string }) | null)?.role;
    if (
      !ctx.user ||
      !userRole ||
      !requiredPermissions.includes(String(userRole))
    ) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
    }

    return next({ ctx });
  });
