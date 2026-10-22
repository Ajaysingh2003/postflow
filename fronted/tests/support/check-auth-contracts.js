import assert from "node:assert/strict";
import { mock } from "bun:test";
import axios from "axios";
const cookieValues = new Map();
const writes = [];
mock.module("next/headers", () => ({
  cookies: async () => ({
    get: (name) =>
      cookieValues.has(name) ? { value: cookieValues.get(name) } : undefined,
    set: (name, value) => {
      writes.push({ name, value });
      cookieValues.set(name, value);
    },
    delete: (name) => cookieValues.delete(name),
  }),
  headers: async () => new Headers(),
}));
const { userRouter } = await import("../../src/modules/user/server/procedures");
const { createTRPCContext, invalidateUserSession } =
  await import("../../src/trpc/init");
const { handleAuthBackendError } = await import("../../src/lib/http-error");
const caller = userRouter.createCaller({});
const valid = {
  access_token: "a".repeat(43),
  token_type: "bearer",
  expires_in: 3600,
  user_id: "user",
  workspace_id: "workspace",
  email: "person@example.com",
  name: "Person",
  email_verified: true,
  verification_required: false,
};
let response = valid;
let failure;
axios.post = async () => {
  if (failure) throw failure;
  return { data: response };
};
axios.get = async () => {
  if (failure) throw failure;
  return { data: response };
};
for (const method of ["login", "register", "google"]) {
  const input =
    method === "google"
      ? { id_token: "g".repeat(32) }
      : {
          email: valid.email,
          password: "valid password",
          display_name: "Person",
        };
  for (const bad of [
    {},
    { ...valid, access_token: "" },
    { ...valid, email: "invalid" },
    { ...valid, expires_in: -1 },
    { ...valid, verification_required: true },
  ]) {
    response = bad;
    await assert.rejects(caller[method](input), /temporarily unavailable/);
    assert.equal(writes.length, 0);
  }
}
response = valid;
const session = await caller.login({
  email: valid.email,
  password: "valid password",
});
assert.equal(session.user.email, valid.email);
assert.equal(writes.length, 2);
assert.ok(!JSON.stringify(session).includes(valid.access_token));
failure = {
  isAxiosError: true,
  response: {
    status: 401,
    headers: {},
    data: { detail: "Invalid email or password" },
  },
};
await assert.rejects(
  caller.login({ email: valid.email, password: "wrong" }),
  (error) => error.code === "UNAUTHORIZED",
);
assert.equal(cookieValues.get("access_token"), valid.access_token);
failure = undefined;
// A malformed refresh must not replace an existing valid cookie.
response = { ...valid, expires_in: 0 };
await assert.rejects(caller.refresh(), /temporarily unavailable/);
assert.equal(writes.length, 2);
cookieValues.clear();
await assert.rejects(caller.me(), (error) => error.code === "UNAUTHORIZED");
assert.equal(await caller.profile(), null);
// Missing/malformed successful recovery responses cannot be shown as success.
response = { unexpected: true };
await assert.rejects(
  caller.forgotPassword({ email: valid.email }),
  /temporarily unavailable/,
);
response = {
  outcome: "accepted",
  message: "Request received",
  delivery_status: "accepted",
  retry_after: 60,
};
assert.equal(
  (await caller.forgotPassword({ email: valid.email })).delivery_status,
  "accepted",
);
// Verification/reset must report their own completed outcome, not just any message.
await assert.rejects(
  caller.verifyEmail({ email: valid.email, token: "123456" }),
  /temporarily unavailable/,
);
await assert.rejects(
  caller.resetPassword({ token: "t".repeat(32), password: "valid password" }),
  /temporarily unavailable/,
);
const requests = [];
axios.post = async (...args) => {
  requests.push(args);
  return { data: response };
};
for (const [method, input] of [
  ["verifyEmail", { email: "invalid", token: "123456" }],
  ["verifyEmail", { token: "123456" }],
  ["resetPassword", { token: "short", password: "valid password" }],
  ["register", { email: valid.email, password: "valid password" }],
]) {
  await assert.rejects(
    caller[method](input),
    (error) => error.code === "BAD_REQUEST",
  );
}
assert.equal(requests.length, 0);
await assert.rejects(
  handleAuthBackendError(new Error("PRIVATE credentials"), "Failed"),
  (error) => !error.message.includes("PRIVATE"),
);
// An unsuccessful logout-all must leave the local session available for retry.
cookieValues.set("access_token", valid.access_token);
response = { id: "user", ...valid };
await assert.rejects(caller.logoutAll(), /temporarily unavailable/);
assert.equal(cookieValues.get("access_token"), valid.access_token);
invalidateUserSession();
// No stale profile fallback on rejected, malformed or unavailable upstream sessions.
response = { id: "user", ...valid };
let now = Date.now();
const realNow = Date.now;
Date.now = () => now;
cookieValues.set("access_token", valid.access_token);
assert.equal((await caller.me()).id, "user");
now += 61_000;
failure = { isAxiosError: true, response: { status: 403 } };
await assert.rejects(caller.me(), (error) => error.code === "FORBIDDEN");
failure = undefined;
response = { private: "invalid profile" };
await assert.rejects(caller.me(), /Could not check your session/);
response = { id: "user", ...valid };
await caller.me();
now += 61_000;
failure = new Error("connection failed");
await assert.rejects(caller.me(), /Could not check your session/);
Date.now = realNow;
invalidateUserSession();
const ctx = await createTRPCContext({
  req: new Request("http://localhost/api/trpc", {
    headers: { cookie: "access_token=%E0%A4%A; workspace_id=%" },
  }),
});
assert.equal(ctx.tokenFromHeader, undefined);
assert.equal(ctx.workspaceFromHeader, undefined);
console.log(
  "Auth contracts: invalid responses, cookies, inputs, recovery, privacy and session rejection passed.",
);
