import { expect, test } from "bun:test";
import { checkoutInputSchema, hasPurchasedSubscription, startPlanCheckout, subscriptionNeedsManagement } from "../src/modules/billing/checkout";

test("purchase status ignores pending or failed purchases and recognizes existing subscribers", () => {
  expect(hasPurchasedSubscription()).toBe(false);
  for (const status of ["pending", "failed", "incomplete"])
    expect(hasPurchasedSubscription({ subscription: { plan_code: "pro", status } })).toBe(false);
  for (const status of ["active", "cancelled", "expired", "on_hold"])
    expect(hasPurchasedSubscription({ subscription: { plan_code: "pro", status } })).toBe(true);
  expect(subscriptionNeedsManagement({ subscription: { plan_code: "pro", status: "expired" } })).toBe(false);
});

test("active subscribers open existing billing instead of creating another subscription", async () => {
  const destinations = [];
  await startPlanCheckout({
    input: { plan_code: "business" }, getUser: async () => ({ id: "subscriber" }),
    getBilling: async () => ({ can_manage_billing: true, subscription: { plan_code: "pro", status: "active" } }),
    checkout: async () => { throw new Error("Must not create a duplicate subscription"); },
    openPortal: async () => ({ link: "https://customer.dodopayments.com/manage" }),
    open: (url) => destinations.push(url), push: () => {}, returnTo: "/pricing",
  });
  expect(destinations).toEqual(["https://customer.dodopayments.com/manage"]);
});

test("billing failures and missing billing permission never start checkout", async () => {
  for (const getBilling of [
    async () => { throw new Error("Billing unavailable"); },
    async () => ({ can_manage_billing: false, subscription: null }),
  ]) {
    await expect(startPlanCheckout({
      input: { plan_code: "pro" }, getUser: async () => ({ id: "user" }), getBilling,
      checkout: async () => { throw new Error("Should not call checkout"); },
      open: () => {}, push: () => {}, returnTo: "/pricing",
    })).rejects.toThrow();
  }
});

test("older card price keys preserve their cycle and reject mismatched selections", () => {
  expect(checkoutInputSchema.parse({ plan_code: "pro", price_id: "pro_annually" }))
    .toEqual({ plan_code: "pro", billing_cycle: "annually", seats: 1 });
  expect(checkoutInputSchema.safeParse({ plan_code: "pro", price_id: "business_monthly" }).success).toBe(false);
  expect(checkoutInputSchema.safeParse({ plan_code: "pro", price_id: "pro_annually", billing_cycle: "monthly" }).success).toBe(false);
});
for (const plan_code of ["starter", "pro", "business"]) {
  for (const billing_cycle of ["monthly", "quarterly", "annually"]) {
    test(`${plan_code} ${billing_cycle} redirects guests without creating checkout`, async () => {
      const routes = [];
      await startPlanCheckout({
        input: { plan_code, billing_cycle },
        getUser: async () => null,
        checkout: async () => {
          throw new Error("Guests must not reach checkout");
        },
        push: (path) => routes.push(path),
        open: () => {
          throw new Error("Guests must not open checkout");
        },
        returnTo: "/pricing#pricing"
      });
      expect(routes).toEqual(["/login?next=%2Fpricing%23pricing"]);
    });
    test(`${plan_code} ${billing_cycle} checks session before checkout and opens the provider URL`, async () => {
      const calls = [];
      await startPlanCheckout({
        input: { plan_code, billing_cycle },
        getUser: async () => {
          calls.push("session");
          return { id: "user" };
        },
        checkout: async (input) => {
          calls.push(input);
          return { url: "https://checkout.dodopayments.com/session" };
        },
        push: () => {
          throw new Error("Signed-in user should reach checkout");
        },
        open: (url) => calls.push(url),
        returnTo: "/pricing"
      });
      expect(calls).toEqual(["session", { plan_code, billing_cycle, seats: 1 }, "https://checkout.dodopayments.com/session"]);
    });
  }
}
test("session errors do not become guest redirects or payment requests", async () => {
  await expect(startPlanCheckout({
    input: { plan_code: "pro" },
    getUser: async () => {
      throw new Error("Session unavailable");
    },
    checkout: async () => {
      throw new Error("Should not checkout");
    },
    push: () => {
      throw new Error("Should not redirect");
    },
    open: () => {},
    returnTo: "/pricing"
  })).rejects.toThrow("Session unavailable");
});
test("checkout validates plans, cycles and redirect protocols", async () => {
  expect(checkoutInputSchema.safeParse({ plan_code: "free" }).success).toBe(false);
  expect(checkoutInputSchema.safeParse({ plan_code: "pro", billing_cycle: "forever" }).success).toBe(false);
  for (const url of ["javascript:alert(1)", "http://evil.example", "https://user:secret@example.com"]) {
    await expect(startPlanCheckout({
      input: { plan_code: "pro" },
      getUser: async () => ({ id: "user" }),
      checkout: async () => ({ url }),
      push: () => {},
      open: () => {
        throw new Error("Unsafe URL opened");
      },
      returnTo: "/pricing"
    })).rejects.toThrow("invalid checkout link");
  }
});
test("billing procedures enforce authentication and forward cycles for both aliases", () => {
  const result = Bun.spawnSync(["bun", "tests/support/check-checkout.js"], { cwd: process.cwd() });
  expect(result.exitCode, result.stderr.toString()).toBe(0);
});
