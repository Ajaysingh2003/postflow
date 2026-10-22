import { expect, test } from "bun:test";
import {
  authMessageSchema,
  authResponseSchema,
  verificationInputSchema,
  linkTokenSchema,
} from "../src/modules/user/contracts";

test("auth boundaries reject malformed upstream success and never install a bad session", () => {
  const result = Bun.spawnSync(
    ["bun", "tests/support/check-auth-contracts.js"],
    { cwd: process.cwd() },
  );
  expect(result.stderr.toString() + result.stdout.toString()).toContain(
    "Auth contracts:",
  );
  expect(result.exitCode).toBe(0);
});

test("verification and recovery validate complete credentials before submission", () => {
  expect(verificationInputSchema.safeParse({ token: "123456" }).success).toBe(
    false,
  );
  expect(
    verificationInputSchema.safeParse({
      email: "a@example.com",
      token: "123456",
    }).success,
  ).toBe(true);
  expect(
    verificationInputSchema.safeParse({
      email: "a@example.com",
      token: "abcdef",
    }).success,
  ).toBe(false);
  expect(linkTokenSchema.safeParse("x".repeat(501)).success).toBe(false);
  expect(
    authMessageSchema.safeParse({ message: "", retry_after: 60 }).success,
  ).toBe(false);
  expect(
    authMessageSchema.safeParse({
      message: "sent",
      delivery_status: "sent",
      retry_after: -1,
    }).success,
  ).toBe(false);
  expect(authResponseSchema.safeParse({ success: true }).success).toBe(false);
});
