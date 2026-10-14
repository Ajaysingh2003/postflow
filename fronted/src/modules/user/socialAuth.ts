import { z } from "zod";
import { safeAuthRedirect } from "./authFlow";

export const X_LOGIN_COOKIE = "draftva_x_login";
export const xLoginCookieSchema = z.object({
  browser_token: z.string().min(32).max(128),
  state: z.string().regex(/^[A-Za-z0-9_-]{32,128}$/),
  next: z.string().transform((value) => safeAuthRedirect(value)),
  return_to: z.enum(["/login", "/register"]),
});
export function readXLoginCookie(value?: string) {
  try {
    const parsed = xLoginCookieSchema.safeParse(JSON.parse(value || ""));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function xLoginStartPath(next: unknown, register = false) {
  return (
    "/api/auth/x/start?" +
    new URLSearchParams({
      next: safeAuthRedirect(next),
      return_to: register ? "/register" : "/login",
    })
  );
}

export const socialErrorMessages: Record<string, string> = {
  unavailable:
    "X sign-in is currently unavailable. Please use email or Google instead.",
  cancelled: "X sign-in was cancelled. You can try again or use email.",
  expired: "This X sign-in session expired. Please start again.",
  email_required:
    "X did not share a confirmed email. Please use email or Google sign-in.",
  account_disabled: "This account is unavailable. Please contact support.",
  failed: "X sign-in could not be completed. Please try again or use email.",
};

export function socialErrorMessage(code: string | null) {
  return code && Object.hasOwn(socialErrorMessages, code)
    ? socialErrorMessages[code]
    : null;
}
