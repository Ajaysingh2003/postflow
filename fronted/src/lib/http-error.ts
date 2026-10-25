import axios, { type AxiosError } from "axios";
import { cookies, headers as requestHeaders } from "next/headers";
import { createHmac } from "node:crypto";
import { isIP } from "node:net";
import { TRPCError } from "@trpc/server";

export interface BackendValidationErrorDetail {
  loc?: Array<string | number>;
  msg?: string;
  message?: string;
  type?: string;
}

export interface BackendErrorBody {
  detail?: string | BackendValidationErrorDetail[] | Record<string, unknown>;
  message?: string;
}

/**
 * Resolves and normalizes the backend API base URL.
 * Defaults to http://localhost:18000/api matching Draftva backend settings.
 */
export const getApiBase = (): string => {
  let base = (
    process.env.BASE_API ||
    process.env.NEXT_PUBLIC_API_URL ||
    "https://api.draftva.com"
  )
    .trim()
    .replace(/\/+$/, "");

  if (!base.endsWith("/api")) {
    if (base.endsWith("/api/v1")) {
      return base.slice(0, -3);
    }
    base = `${base}/api`;
  }
  return base;
};

export const getAuthApiUrl = (): string => `${getApiBase()}/v1/auth`;
export const getWorkspacesApiUrl = (): string =>
  `${getApiBase()}/v1/workspaces`;

/**
 * Retrieves the stored access token from HTTP-only cookies.
 */
export const getAccessToken = async (): Promise<string | undefined> => {
  const cookieStore = await cookies();
  return cookieStore.get("access_token")?.value;
};

/**
 * Retrieves the stored active workspace ID from cookies.
 */
export const getActiveWorkspaceId = async (): Promise<string | undefined> => {
  const cookieStore = await cookies();
  return cookieStore.get("workspace_id")?.value;
};

/** Relay only the client-IP header provided by the trusted frontend reverse proxy. */
export const getAuthClientHeaders = async (): Promise<
  Record<string, string>
> => {
  const secret = process.env.AUTH_PROXY_SECRET;
  const header = process.env.AUTH_CLIENT_IP_HEADER;
  if (!secret || !header) return {};
  const incoming = await requestHeaders();
  const ip = incoming.get(header)?.split(",", 1)[0].trim();
  if (!ip || !isIP(ip)) return {};
  const timestamp = Math.floor(Date.now() / 1000).toString();
  return {
    "X-Auth-Client-IP": ip,
    "X-Auth-Client-Timestamp": timestamp,
    "X-Auth-Client-Signature": createHmac("sha256", secret)
      .update(`${timestamp}:${ip}`)
      .digest("hex"),
  };
};

/**
 * Builds standard headers including Authorization and X-Workspace-ID.
 */
export const getAuthHeaders = async (
  explicitToken?: string,
  explicitWorkspaceId?: string,
): Promise<Record<string, string>> => {
  const token = explicitToken ?? (await getAccessToken());
  const workspaceId = explicitWorkspaceId ?? (await getActiveWorkspaceId());
  const headers: Record<string, string> = await getAuthClientHeaders();

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  if (workspaceId) {
    headers["X-Workspace-ID"] = workspaceId;
  }
  return headers;
};

/**
 * Sets session tokens and active workspace in secure cookies.
 */
export const setAuthCookies = async (data: {
  access_token: string;
  expires_in?: number;
  workspace_id?: string;
}): Promise<void> => {
  const cookieStore = await cookies();
  const maxAge = data.expires_in ?? 60 * 60 * 24 * 30; // 30 days default
  const baseOptions = {
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
  };

  cookieStore.set("access_token", data.access_token, {
    ...baseOptions,
    httpOnly: true,
    maxAge,
  });

  if (data.workspace_id) {
    cookieStore.set("workspace_id", data.workspace_id, {
      ...baseOptions,
      httpOnly: false, // Allows client to read active workspace ID if needed
      maxAge,
    });
  }
};

/**
 * Sets the active workspace cookie.
 */
export const setActiveWorkspaceCookie = async (
  workspaceId: string,
): Promise<void> => {
  const cookieStore = await cookies();
  cookieStore.set("workspace_id", workspaceId, {
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
};

/**
 * Clears all authentication and workspace cookies.
 */
export const clearAuthCookies = async (): Promise<void> => {
  const cookieStore = await cookies();
  cookieStore.delete("access_token");
  cookieStore.delete("refresh_token");
  cookieStore.delete("workspace_id");
};

/**
 * Parses and formats backend detail messages into clean user-friendly text.
 */
export const formatBackendErrorDetail = (
  detail: BackendErrorBody["detail"],
  fallback: string,
): string => {
  if (typeof detail === "string" && detail.trim()) {
    return detail.trim();
  }

  if (Array.isArray(detail)) {
    const formatted = detail
      .map((item) => {
        const rawMsg = item.msg || item.message;
        if (!rawMsg) return null;
        const field = item.loc
          ? item.loc
              .filter((part) => part !== "body" && part !== "query")
              .join(".")
          : "";
        return field ? `${field}: ${rawMsg}` : rawMsg;
      })
      .filter(Boolean)
      .join(" | ");

    if (formatted) return formatted;
  }

  if (detail && typeof detail === "object") {
    try {
      return JSON.stringify(detail);
    } catch {
      return fallback;
    }
  }

  return fallback;
};

/**
 * Centralized error handler that translates Axios/FastAPI errors into TRPCErrors.
 */
export const handleBackendError = async (
  error: unknown,
  fallbackMessage: string,
  options: { clearUnauthorizedSession?: boolean } = {},
): Promise<never> => {
  if (axios.isAxiosError(error)) {
    console.error("Backend API error", {
      status: error.response?.status,
      code: error.code,
      requestId: error.response?.headers?.["x-request-id"],
    });
    const axiosError = error as AxiosError<BackendErrorBody>;

    // Network error / connection refused / host unreachable
    if (!axiosError.response) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "The service is temporarily unavailable. Please try again.",
      });
    }

    const status = axiosError.response.status;
    const data = axiosError.response.data;
    const message = formatBackendErrorDetail(
      data?.detail,
      data?.message || fallbackMessage,
    );
    const requestId = axiosError.response.headers?.["x-request-id"] as
      string | undefined;

    // Map HTTP status to TRPC error code
    let trpcCode: TRPCError["code"] = "BAD_REQUEST";
    if (status === 401) {
      trpcCode = "UNAUTHORIZED";
      // Clear invalid session cookies automatically
      if (options.clearUnauthorizedSession !== false)
        await clearAuthCookies().catch(() => {});
    } else if (status === 403 || status === 402) {
      trpcCode = "FORBIDDEN";
    } else if (status === 404) {
      trpcCode = "NOT_FOUND";
    } else if (status === 409) {
      trpcCode = "CONFLICT";
    } else if (status === 422) {
      trpcCode = "BAD_REQUEST";
    } else if (status === 429) {
      trpcCode = "TOO_MANY_REQUESTS";
    } else if (status >= 500) {
      trpcCode = "INTERNAL_SERVER_ERROR";
    }

    throw new TRPCError({
      code: trpcCode,
      message,
      cause: {
        status,
        requestId,
        retryAfter:
          Number(axiosError.response.headers?.["retry-after"]) || undefined,
      },
    });
  }

  if (error instanceof TRPCError) {
    throw error;
  }

  throw new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: error instanceof Error ? error.message : fallbackMessage,
  });
};

/** Auth errors never expose infrastructure details, provider bodies or raw exceptions. */
export async function handleAuthBackendError(
  error: unknown,
  fallback: string,
  options: { clearUnauthorizedSession?: boolean } = {},
): Promise<never> {
  if (error instanceof TRPCError) throw error;
  if (
    axios.isAxiosError(error) &&
    error.response &&
    error.response.status < 500
  ) {
    return handleBackendError(error, fallback, options);
  }
  console.error("Authentication service failure", {
    status: axios.isAxiosError(error) ? error.response?.status : undefined,
  });
  throw new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message:
      "Authentication service is temporarily unavailable. Please try again.",
  });
}
