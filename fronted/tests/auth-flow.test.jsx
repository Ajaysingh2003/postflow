import { expect, test } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TRPCReactProvider } from "../src/trpc/client";
import LoginForm from "../src/modules/user/component/LoginForm";
import RegisterForm from "../src/modules/user/component/RegisterForm";
import VerifyOTPForm from "../src/modules/user/component/VerifyOTPForm";
import ResetPasswordForm from "../src/modules/user/component/ResetPasswordForm";
import AuthLoading from "../src/app/(auth)/loading";
import AuthError from "../src/app/(auth)/error";
import ResetPasswordPage from "../src/app/(auth)/reset-password/page";
import { allowedMutationOrigin } from "../src/lib/request-origin";
import {
  loginSchema,
  registerSchema,
  passwordSchema,
  safeAuthRedirect,
  publicAuthSession,
  verificationPath,
  nextAuthPath,
  authRetrySeconds,
} from "../src/modules/user/authFlow";

const render = (component) =>
  renderToStaticMarkup(<TRPCReactProvider>{component}</TRPCReactProvider>);

test("all password forms share the backend's length rules without trimming a password", () => {
  const base = {
    display_name: "Ajay",
    email: " person@example.com ",
    password: "1234567890",
  };
  expect(registerSchema.parse(base).email).toBe("person@example.com");
  for (const password of ["short123", "x".repeat(201)]) {
    expect(passwordSchema.safeParse(password).success).toBe(false);
    expect(registerSchema.safeParse({ ...base, password }).success).toBe(false);
  }
  expect(passwordSchema.parse(" 1234567890 ")).toBe(" 1234567890 ");
  expect(
    loginSchema.safeParse({ email: "a@b.com", password: "x".repeat(201) })
      .success,
  ).toBe(false);
  expect(render(<LoginForm />)).toContain('type="password"');
  expect(render(<LoginForm />)).not.toContain('type="text"');
  expect(render(<RegisterForm />)).toContain("At least 10 characters");
  for (const form of [
    <LoginForm />,
    <RegisterForm />,
    <ResetPasswordForm token="a-valid-complete-token-from-email" />,
    <VerifyOTPForm email="a@example.com" />,
  ]) {
    expect(render(form)).toContain('method="post"');
  }
  expect(
    render(<ResetPasswordForm token="a-valid-complete-token-from-email" />),
  ).toContain('id="confirm-password"');
});

test("redirects preserve internal destination and reject external hosts, controls and auth loops", () => {
  for (const unsafe of [
    ["/dashboard", "//evil.example"],
    "https://evil.example",
    "//evil.example",
    "/\\evil.example",
    "/%5cevil.example",
    "/\nevil.example",
    "/login",
    "/register",
    "/verify-otp",
  ]) {
    expect(safeAuthRedirect(unsafe)).toBe("/dashboard");
  }
  expect(safeAuthRedirect("/dashboard/posts?tab=drafts#draft")).toBe(
    "/dashboard/posts?tab=drafts#draft",
  );
  expect(nextAuthPath("?redirect=%2Fsettings%2Fbilling")).toBe(
    "/settings/billing",
  );
  expect(verificationPath("a+b@example.com", "//evil.example", true)).toContain(
    "next=%2Fdashboard",
  );
});

test("reset page passes the complete email-link token and rejects ambiguous repeated parameters", async () => {
  const token = "a-complete-reset-token-from-the-email";
  const page = await ResetPasswordPage({
    searchParams: Promise.resolve({ token }),
  });
  expect(page.props.token).toBe(token);
  const repeated = await ResetPasswordPage({
    searchParams: Promise.resolve({ token: [token, "other"] }),
  });
  expect(repeated.props.token).toBe("");
});

test("browser auth result never contains bearer tokens and retains true verification state", () => {
  const result = publicAuthSession({
    access_token: "secret-token",
    refresh_token: "secret-refresh",
    token_type: "bearer",
    expires_in: 180,
    user_id: "user",
    workspace_id: "workspace",
    email: "a@example.com",
    name: "Ajay",
    email_verified: false,
    verification_required: true,
    verification_sent: true,
  });
  expect(result.user.email).toBe("a@example.com");
  expect(result.verification_required).toBe(true);
  expect(result.verification_sent).toBe(true);
  expect(JSON.stringify(result)).not.toContain("secret");
  expect(result).not.toHaveProperty("access_token");
  expect(result).not.toHaveProperty("refresh_token");
});

test("OTP and legacy verification links have distinct usable forms", () => {
  const otp = render(<VerifyOTPForm email="a@example.com" />);
  expect(otp.toLowerCase()).toContain('autocomplete="one-time-code"');
  expect(otp).toContain('inputMode="numeric"');
  expect(otp).toContain("Send a new code");
  expect(otp).toContain("primary-btn");
  expect(otp).toContain("secondary-btn");
  const token = "long-previously-issued-verification-token";
  const legacy = render(<VerifyOTPForm token={token} />);
  expect(legacy).toContain("Confirm email verification");
  expect(legacy).not.toContain("6-digit code");
  expect(legacy).not.toContain(token);
});

test("missing reset links, server failures and loading have honest recovery states", () => {
  expect(render(<ResetPasswordForm token="" />)).toContain(
    "Get a new reset link",
  );
  expect(renderToStaticMarkup(<AuthLoading />)).toContain('aria-busy="true"');
  const error = renderToStaticMarkup(
    <AuthError error={new Error("private stack")} reset={() => {}} />,
  );
  expect(error).toContain("Try again");
  expect(error).not.toContain("private stack");
  expect(authRetrySeconds({ data: { retryAfter: 123 } })).toBe(123);
  expect(authRetrySeconds({ data: { retryAfter: -1 } })).toBe(0);
});

test("auth mutations reject cross-site origins while supporting the trusted HTTPS proxy", () => {
  const request = "https://draftva.com/api/trpc/user.login";
  expect(
    allowedMutationOrigin(
      "https://draftva.com",
      request,
      "draftva.com",
      "same-origin",
    ),
  ).toBe(true);
  expect(
    allowedMutationOrigin(
      "https://evil.example",
      request,
      "draftva.com",
      "cross-site",
    ),
  ).toBe(false);
  expect(allowedMutationOrigin("null", request, "draftva.com", null)).toBe(
    false,
  );
  expect(
    allowedMutationOrigin(null, request, "draftva.com", "cross-site"),
  ).toBe(false);
  expect(
    allowedMutationOrigin(
      "https://draftva.com",
      "http://internal/api/trpc",
      "draftva.com",
      "same-origin",
    ),
  ).toBe(true);
});

test("only actual rate limits receive a fallback cooldown", () => {
  expect(authRetrySeconds(new Error("Network unavailable"))).toBe(0);
  expect(authRetrySeconds({ data: { code: "BAD_REQUEST" } })).toBe(0);
  expect(authRetrySeconds({ data: { code: "TOO_MANY_REQUESTS" } })).toBe(60);
});
