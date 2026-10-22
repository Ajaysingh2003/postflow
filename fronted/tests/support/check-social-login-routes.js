import assert from "node:assert/strict";
import { mock } from "bun:test";
const values = new Map();
const writes = [];
const sessions = [];
const requests = [];
let response = { status: 200, body: {} };
mock.module("next/headers", () => ({
  cookies: async () => ({
    get: (name) => (values.has(name) ? { value: values.get(name) } : undefined),
    set: (name, value, options) => {
      values.set(name, value);
      writes.push({ name, value, options });
    },
  }),
}));
mock.module("../../src/lib/http-error", () => ({
  getAuthApiUrl: () => "http://backend.test/api/v1/auth",
  getAuthClientHeaders: async () => ({
    "X-Auth-Client-Signature": "test-signature",
  }),
  setAuthCookies: async (session) => {
    sessions.push(session);
  },
}));
mock.module("../../src/trpc/init", () => ({ invalidateUserSession: () => {} }));
globalThis.fetch = async (url, options) => {
  requests.push({ url: String(url), options });
  return Response.json(response.body, { status: response.status });
};
const { GET: start } = await import("../../src/app/api/auth/x/start/route");
const { GET: callback } =
  await import("../../src/app/api/auth/x/callback/route");
const { X_LOGIN_COOKIE } = await import("../../src/modules/user/socialAuth");
const state = "s".repeat(43);
response.body = {
  state,
  authorization_url: `https://x.com/i/oauth2/authorize?state=${state}&redirect_uri=${encodeURIComponent("http://localhost:3000/api/auth/x/callback")}`,
};
const begun = await start(
  new Request(
    "http://localhost:3000/api/auth/x/start?return_to=%2Fregister&next=%2Fdashboard%2Fposts",
    { headers: { "sec-fetch-site": "same-origin" } },
  ),
);
assert.equal(begun.status, 303);
assert.match(
  begun.headers.get("location"),
  /^https:\/\/x\.com\/i\/oauth2\/authorize/,
);
const cookie = writes.at(-1);
assert.equal(cookie.options.httpOnly, true);
assert.equal(cookie.options.sameSite, "lax");
assert.equal(cookie.options.path, "/api/auth/x");
assert.equal(cookie.options.maxAge, 600);
const flow = JSON.parse(cookie.value);
assert.equal(flow.next, "/dashboard/posts");
assert.equal(
  JSON.parse(requests[0].options.body).browser_token,
  flow.browser_token,
);
const validAuthorization = response.body.authorization_url;
for (const redirect of [
  "http://localhost:18000/api/v1/channels/x/callback",
  "http://localhost:3001/api/auth/x/callback",
  "https://evil.example/api/auth/x/callback",
]) {
  response.body.authorization_url = `https://x.com/i/oauth2/authorize?state=${state}&redirect_uri=${encodeURIComponent(redirect)}`;
  const badConfiguration = await start(
    new Request("http://localhost:3000/api/auth/x/start"),
  );
  assert.match(
    badConfiguration.headers.get("location"),
    /login\?social_error=unavailable/,
  );
  assert.equal(values.get(X_LOGIN_COOKIE), "");
}
response.body.authorization_url = validAuthorization;
const callsBefore = requests.length;
const foreign = await start(
  new Request("http://localhost:3000/api/auth/x/start", {
    headers: { "sec-fetch-site": "cross-site" },
  }),
);
assert.equal(foreign.status, 403);
assert.equal(requests.length, callsBefore);
values.set(X_LOGIN_COOKIE, cookie.value);
const wrongBrowser = await callback(
  new Request(
    "http://localhost:3000/api/auth/x/callback?state=wrong&code=provider-code",
  ),
);
assert.match(wrongBrowser.headers.get("location"), /social_error=expired/);
assert.equal(sessions.length, 0);
assert.equal(requests.length, callsBefore);
values.set(X_LOGIN_COOKIE, cookie.value);
const unicode = await callback(
  new Request(
    `http://localhost:3000/api/auth/x/callback?state=${"é".repeat(43)}&code=provider-code`,
  ),
);
assert.match(unicode.headers.get("location"), /social_error=expired/);
values.set(X_LOGIN_COOKIE, cookie.value);
const cancelled = await callback(
  new Request(
    `http://localhost:3000/api/auth/x/callback?state=${state}&error=access_denied`,
  ),
);
assert.match(cancelled.headers.get("location"), /social_error=cancelled/);
assert.equal(requests.length, callsBefore);
values.set(X_LOGIN_COOKIE, cookie.value);
response = {
  status: 200,
  body: {
    access_token: "server-session-token-long-enough",
    token_type: "bearer",
    name: "Person",
    user_id: "user",
    workspace_id: "workspace",
    email: "person@example.com",
    email_verified: true,
    verification_required: false,
    expires_in: 3600,
  },
};
const validSession = response.body;
for (const invalid of [
  {},
  { ...validSession, email: "invalid" },
  { ...validSession, expires_in: 0 },
  { ...validSession, verification_required: true },
]) {
  values.set(X_LOGIN_COOKIE, cookie.value);
  response.body = invalid;
  const rejected = await callback(
    new Request(
      `http://localhost:3000/api/auth/x/callback?state=${state}&code=provider-code`,
    ),
  );
  assert.match(rejected.headers.get("location"), /social_error=failed/);
  assert.equal(sessions.length, 0);
}
values.set(X_LOGIN_COOKIE, cookie.value);
response.body = validSession;
const complete = await callback(
  new Request(
    `http://localhost:3000/api/auth/x/callback?state=${state}&code=provider-code`,
  ),
);
assert.equal(
  complete.headers.get("location"),
  "http://localhost:3000/dashboard/posts",
);
assert.equal(complete.headers.get("cache-control"), "private, no-store");
assert.equal(complete.headers.get("referrer-policy"), "no-referrer");
assert.equal(sessions.length, 1);
assert.ok(!complete.headers.get("location")?.includes("server-session"));
assert.equal(values.get(X_LOGIN_COOKIE), "");
assert.equal(
  JSON.parse(requests.at(-1).options.body).browser_token,
  flow.browser_token,
);
values.set(X_LOGIN_COOKIE, cookie.value);
response = {
  status: 400,
  body: {
    detail: "X did not provide a confirmed email. PRIVATE provider data",
  },
};
const missingEmail = await callback(
  new Request(
    `http://localhost:3000/api/auth/x/callback?state=${state}&code=provider-code`,
  ),
);
assert.match(
  missingEmail.headers.get("location"),
  /social_error=email_required/,
);
assert.ok(!missingEmail.headers.get("location")?.includes("PRIVATE"));
assert.equal(sessions.length, 1);
response = { status: 503, body: { detail: "PRIVATE API details" } };
const unavailable = await start(
  new Request("http://localhost:3000/api/auth/x/start?return_to=%2Fregister"),
);
assert.match(
  unavailable.headers.get("location"),
  /register\?social_error=unavailable/,
);
assert.ok(!unavailable.headers.get("location")?.includes("PRIVATE"));
console.log(
  "Social login route checks passed: cookies, browser binding, safe redirects, cancellation, completion and recovery.",
);
