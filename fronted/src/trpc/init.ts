import { initTRPC, TRPCError } from "@trpc/server";
import { cookies } from "next/headers";
import axios from "axios";
import { getApiBase } from "@/lib/http-error";

export const createTRPCContext = async () => {};

const t = initTRPC.create({});

// Base router and procedure helpers
export const createTRPCRouter = t.router;
export const createCallerFactory = t.createCallerFactory;

export const baseProcedure = t.procedure.use(async ({ next }) => {
  return next({ ctx: {} });
});

export const getUserProcedure = baseProcedure.use(async ({ ctx, next }) => {
  try {
    const cookieStore = await cookies();
    const access_token = cookieStore.get("access_token")?.value;

    if (!access_token) {
      return next({
        ctx: {
          ...ctx,
          user: null,
        },
      });
    }

    const workspace_id = cookieStore.get("workspace_id")?.value;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${access_token}`,
    };
    if (workspace_id) {
      headers["X-Workspace-ID"] = workspace_id;
    }

    const res = await axios.get(`${getApiBase()}/v1/auth/me`, {
      headers,
      timeout: 5000,
    });

    const user = {
      ...res.data,
      display_name: res.data.name,
    };

    return next({
      ctx: {
        ...ctx,
        user,
      },
    });
  } catch {
    return next({
      ctx: {
        ...ctx,
        user: null,
      },
    });
  }
});

export const authedProcedure = getUserProcedure.use(async ({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Authentication required" });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedProcedure = (requiredPermissions: string[]) =>
  getUserProcedure.use(async ({ ctx, next }) => {
    const userRole = (ctx.user as Record<string, any> | null)?.role;
    if (!ctx.user || (userRole && !requiredPermissions.includes(String(userRole)))) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
    }

    return next({ ctx });
  });

