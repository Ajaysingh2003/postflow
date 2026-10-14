import { z } from "zod";
import type { AuthResponse, TokenResponse } from "./types";

export const passwordSchema = z
  .string()
  .min(10, "Use at least 10 characters")
  .max(200, "Use at most 200 characters");
export const registerSchema = z.object({
  display_name: z
    .string()
    .trim()
    .min(2, "Enter at least 2 characters")
    .max(160),
  email: z.string().trim().email("Enter a valid email address"),
  password: passwordSchema,
});
export const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required").max(200),
});

export function safeAuthRedirect(value: unknown, fallback = "/dashboard") {
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    value.includes(String.fromCharCode(92)) ||
    /%5c/i.test(value) ||
    [...value].some(
      (char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127,
    )
  )
    return fallback;
  try {
    const url = new URL(value, "https://draftva.invalid");
    if (
      url.origin !== "https://draftva.invalid" ||
      /^\/(login|register|verify-otp|verify-email)(\/|$)/.test(url.pathname)
    )
      return fallback;
    return url.pathname + url.search + url.hash;
  } catch {
    return fallback;
  }
}

export function nextAuthPath(search: string) {
  const query = new URLSearchParams(search);
  return safeAuthRedirect(query.get("next") || query.get("redirect"));
}

export function verificationPath(
  email: string,
  next = "/dashboard",
  sent = false,
) {
  return (
    "/verify-otp?" +
    new URLSearchParams({
      email,
      next: safeAuthRedirect(next),
      sent: sent ? "1" : "0",
    })
  );
}

// Browser responses contain identity metadata only; bearer tokens stay in HTTP-only cookies.
export function publicAuthSession(data: AuthResponse): TokenResponse {
  return {
    token_type: data.token_type,
    expires_in: data.expires_in,
    user_id: data.user_id,
    workspace_id: data.workspace_id,
    verification_required: data.verification_required ?? !data.email_verified,
    verification_sent: data.verification_sent ?? false,
    retry_after: data.retry_after ?? 0,
    user: {
      id: data.user_id,
      email: data.email,
      name: data.name,
      display_name: data.name,
      email_verified: data.email_verified,
      workspace_id: data.workspace_id,
    },
  };
}

export function authRetrySeconds(error: unknown, fallback = 60) {
  const seconds = (error as { data?: { retryAfter?: number } })?.data
    ?.retryAfter;
  return typeof seconds === "number" && Number.isFinite(seconds) && seconds > 0
    ? Math.ceil(seconds)
    : fallback;
}

export function reloadAuthPage(path: string) {
  const destination = new URL(path, window.location.origin);
  if (destination.origin !== window.location.origin)
    throw new Error("Invalid authentication destination");
  window.location.assign(destination.href);
}
