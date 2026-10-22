import { timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  getAuthApiUrl,
  getAuthClientHeaders,
  setAuthCookies,
} from "@/lib/http-error";
import { invalidateUserSession } from "@/trpc/init";
import { readXLoginCookie, X_LOGIN_COOKIE } from "@/modules/user/socialAuth";
import { verificationPath } from "@/modules/user/authFlow";
import {
  authResponseSchema,
  parseAuthResponse,
} from "@/modules/user/contracts";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const cookieStore = await cookies();
  const flow = readXLoginCookie(cookieStore.get(X_LOGIN_COOKIE)?.value);
  cookieStore.set(X_LOGIN_COOKIE, "", { path: "/api/auth/x", maxAge: 0 });
  const failure = (reason: string) => {
    const target = new URL(flow?.return_to || "/login", url.origin);
    target.searchParams.set("social_error", reason);
    target.searchParams.set("next", flow?.next || "/dashboard");
    const response = NextResponse.redirect(target, 303);
    response.headers.set("Cache-Control", "private, no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  };
  const state = url.searchParams.get("state");
  const code = url.searchParams.get("code");
  if (
    !flow ||
    !state ||
    !/^[A-Za-z0-9_-]{32,128}$/.test(state) ||
    state.length !== flow.state.length ||
    !timingSafeEqual(Buffer.from(state), Buffer.from(flow.state)) ||
    url.searchParams.getAll("state").length !== 1
  )
    return failure("expired");
  if (url.searchParams.has("error")) return failure("cancelled");
  if (
    !code ||
    code.length > 2048 ||
    url.searchParams.getAll("code").length !== 1
  )
    return failure("failed");
  try {
    const result = await fetch(`${getAuthApiUrl()}/x/complete`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(await getAuthClientHeaders()),
      },
      body: JSON.stringify({ state, code, browser_token: flow.browser_token }),
      cache: "no-store",
      signal: AbortSignal.timeout(40_000),
    });
    if (!result.ok) {
      const data = await result.json().catch(() => ({}));
      return failure(
        result.status === 403
          ? "account_disabled"
          : typeof data.detail === "string" &&
              data.detail.includes("confirmed email")
            ? "email_required"
            : result.status === 503
              ? "unavailable"
              : "failed",
      );
    }
    const session = parseAuthResponse(authResponseSchema, await result.json());
    await setAuthCookies(session);
    invalidateUserSession();
    const destination = session.verification_required
      ? verificationPath(session.email, flow.next)
      : flow.next;
    const response = NextResponse.redirect(
      new URL(destination, url.origin),
      303,
    );
    response.headers.set("Cache-Control", "private, no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  } catch {
    return failure("failed");
  }
}
