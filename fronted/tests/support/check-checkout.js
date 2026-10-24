import assert from "node:assert/strict";
import { mock } from "bun:test";
import axios from "axios";
const cookies = new Map();
mock.module("next/headers", () => ({
  cookies: async () => ({ get: (name) => cookies.has(name) ? { value: cookies.get(name) } : undefined }),
  headers: async () => new Headers(),
}));
const { billingRouter } = await import("../../src/modules/billing/server/procedures");
const { invalidateUserSession } = await import("../../src/trpc/init");
const calls = [];
axios.get = async () => ({ data: { id: "user", email: "writer@example.com", name: "Writer", email_verified: true, workspace_id: "workspace" } });
axios.post = async (_url, body, options) => {
  assert.equal(options.headers.Authorization, "Bearer fixture-session");
  calls.push(body);
  return { data: { checkout_url: "https://checkout.dodopayments.com/session", session_id: "session" } };
};
const guest = billingRouter.createCaller({});
for (const name of ["createCheckout", "Createcheckout"]) {
  await assert.rejects(guest[name]({ plan_code: "pro", billing_cycle: "annually" }), (error) => error.code === "UNAUTHORIZED");
}
assert.equal(calls.length, 0);
cookies.set("access_token", "fixture-session");
cookies.set("workspace_id", "workspace");
const caller = billingRouter.createCaller({ tokenFromHeader: "fixture-session", workspaceFromHeader: "workspace" });
for (const name of ["createCheckout", "Createcheckout"]) {
  const result = await caller[name]({ plan_code: "business", billing_cycle: "quarterly" });
  assert.equal(result.session_id, "session");
}
assert.deepEqual(calls, [
  { plan_code: "business", billing_cycle: "quarterly", seats: 1 },
  { plan_code: "business", billing_cycle: "quarterly", seats: 1 }
]);
invalidateUserSession();
console.log("Checkout authentication and cycle forwarding passed");
