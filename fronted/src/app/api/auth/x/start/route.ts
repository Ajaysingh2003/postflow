import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getAuthApiUrl, getAuthClientHeaders } from "@/lib/http-error";
import { isSameOrigin } from "@/lib/request-origin";
import { safeAuthRedirect } from "@/modules/user/authFlow";
import { X_LOGIN_COOKIE } from "@/modules/user/socialAuth";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const returnTo =
    url.searchParams.get("return_to") === "/register" ? "/register" : "/login";
  const next = safeAuthRedirect(url.searchParams.get("next"));
  const cookieStore = await cookies();
  if (!isSameOrigin(request))
    return new Response("Invalid request origin", { status: 403 });
  cookieStore.set(X_LOGIN_COOKIE, "", { path: "/api/auth/x", maxAge: 0 });
  try {
    const browserToken = randomBytes(32).toString("base64url");
    const response = await fetch(`${getAuthApiUrl()}/x/start`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(await getAuthClientHeaders()),
      },
      body: JSON.stringify({ browser_token: browserToken }),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error("Unavailable");
    const flow = await response.json();
    const target = new URL(flow.authorization_url);
    if (
      target.origin !== "https://x.com" ||
      target.pathname !== "/i/oauth2/authorize" ||
      typeof flow.state !== "string" ||
      flow.state.length < 32 ||
      flow.state.length > 128 ||
      target.searchParams.get("state") !== flow.state
    )
      throw new Error("Invalid provider response");
    cookieStore.set(
      X_LOGIN_COOKIE,
      JSON.stringify({
        browser_token: browserToken,
        state: flow.state,
        next,
        return_to: returnTo,
      }),
      {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/api/auth/x",
        maxAge: 600,
      },
    );
    const redirect = NextResponse.redirect(target, 303);
    redirect.headers.set("Cache-Control", "private, no-store");
    redirect.headers.set("Referrer-Policy", "no-referrer");
    return redirect;
  } catch {
    const target = new URL(returnTo, url.origin);
    target.searchParams.set("social_error", "unavailable");
    target.searchParams.set("next", next);
    return NextResponse.redirect(target, 303);
  }
}
