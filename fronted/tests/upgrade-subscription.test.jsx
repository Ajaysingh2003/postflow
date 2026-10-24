import { expect, test } from "bun:test";
import React from "react";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createTRPCClient, httpLink } from "@trpc/client";
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";
import { TRPCProvider } from "../src/trpc/client";
import PricingCardSection from "../src/modules/billing/component/PricingCardSection";
import PricingPlan from "../src/modules/billing/component/PricingPlan";
import { UpgradePlansSkeleton } from "../src/components/base/UpgradeSubscriptionDialog";
import {
  canonicalPlan,
  catalogCycleLabel,
  priceLabel,
} from "../src/modules/billing/upgradeModel";
import { startPlanCheckout } from "../src/modules/billing/checkout";

const plans = Object.fromEntries(
  [
    ["starter", 300, 3, 9],
    ["pro", 2000, 5, 29],
    ["business", 5000, 10, 49],
  ].map(([code, credits, profiles, amount]) => [
    code,
    {
      id: code,
      name: code.charAt(0).toUpperCase() + code.slice(1),
      description: `${code} description`,
      trial_days: 0,
      limits: {
        ai_credits: credits,
        brand_profiles: profiles,
        scheduled_posts: null,
        connected_accounts: 5,
        seats: 3,
        workspaces: 3,
      },
      billing_cycles: {
        monthly: { amount, currency: "USD", interval: "month" },
        quarterly: {
          amount: { starter: 24, pro: 78, business: 132 }[code],
          currency: "USD",
          interval: "quarter",
        },
        annually: { amount: amount * 10, currency: "USD", interval: "year" },
      },
    },
  ]),
);
const billing = {
  usage: { plan_code: "free" },
  subscription: null,
  can_manage_billing: true,
};
function renderCards(data = billing, cycle = "monthly", catalogPlans = plans) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  const trpcClient = createTRPCClient({
    links: [httpLink({ url: "https://fixture.invalid/api/trpc" })],
  });
  const options = createTRPCOptionsProxy({
    client: trpcClient,
    queryClient: client,
  });
  client.setQueryData(options.billing.getPlans.queryKey(), catalogPlans);
  client.setQueryData(options.user.profile.queryKey(), { id: "user" });
  client.setQueryData(
    options.studio.billingUsage.queryKey({ workspace_id: "selected" }),
    data,
  );
  return renderToStaticMarkup(
    <AppRouterContext.Provider
      value={{ push() {}, replace() {}, prefetch() {} }}
    >
      <QueryClientProvider client={client}>
        <TRPCProvider trpcClient={trpcClient} queryClient={client}>
          <PricingCardSection workspaceId="selected" timeLine={cycle} />
        </TRPCProvider>
      </QueryClientProvider>
    </AppRouterContext.Provider>,
  );
}

test("upgrade reuses the existing pricing cards with actual allowances and comparison links", () => {
  const html = renderCards();
  for (const feature of [
    "300 AI credits / month",
    "2,000 AI credits / month",
    "5,000 AI credits / month",
    "3 custom brand voice profiles",
    "5 custom brand voice profiles",
    "10 custom brand voice profiles",
    "Unlimited posts",
  ])
    expect(html).toContain(feature);
  expect(html).toContain("$9");
  expect((html.match(/Get started:/g) || []).length).toBe(3);
  expect((html.match(/href="\/pricing#compare-plans"/g) || []).length).toBe(3);
  expect(html).not.toContain("Premium");
  expect(html).not.toContain("free trial");
});

test("quarterly cards preserve the original three-month totals", () => {
  expect(catalogCycleLabel(plans, "quarterly")).toBe("Quarterly");
  expect(priceLabel(plans.starter, "quarterly")).toEqual({
    amount: "$24",
    suffix: "/ 3 months",
    interval: "Quarterly",
  });
  const html = renderCards(billing, "quarterly");
  for (const amount of ["$24", "$78", "$132"]) expect(html).toContain(amount);
  expect(html).toContain("/ 3 months");
  expect(html).not.toContain("6 months");
  const selector = renderToStaticMarkup(
    <PricingPlan
      timeLine="quarterly"
      setTimeLine={() => {}}
      labels={{ quarterly: catalogCycleLabel(plans, "quarterly") }}
    />,
  );
  expect(selector).toContain("Quarterly");
  expect(selector).toContain('aria-pressed="true"');
});

test("shared cards disable the current plan and respect selected workspace billing permissions", () => {
  expect(canonicalPlan("creator")).toBe("starter");
  expect(canonicalPlan("agency")).toBe("business");
  let html = renderCards({
    ...billing,
    usage: { plan_code: "starter" },
    subscription: { plan_code: "starter", status: "active" },
  });
  expect(html).toContain("Current plan: Starter");
  expect((html.match(/disabled=""/g) || []).length).toBe(1);
  html = renderCards({ ...billing, can_manage_billing: false });
  expect((html.match(/disabled=""/g) || []).length).toBe(3);
  expect(html).toContain("Ask a workspace owner or billing admin");
  expect(renderToStaticMarkup(<UpgradePlansSkeleton />)).toContain(
    "Loading available plans",
  );
});

test("an existing legacy trial opens the billing portal instead of another paid subscription", async () => {
  const opened = [];
  await startPlanCheckout({
    input: { plan_code: "business", billing_cycle: "annually" },
    getUser: async () => ({ id: "user" }),
    getBilling: async () => ({
      ...billing,
      subscription: { plan_code: "pro", status: "trialing" },
    }),
    checkout: async () => {
      throw new Error("Duplicate subscription");
    },
    openPortal: async () => ({
      link: "https://customer.dodopayments.com/manage",
    }),
    open: (url) => opened.push(url),
    push: () => {},
    returnTo: "/dashboard",
  });
  expect(opened).toEqual(["https://customer.dodopayments.com/manage"]);
});

test("shared cards render changed provider amounts and currency precision without code price constants", () => {
  const updated = {
    ...plans,
    starter: {
      ...plans.starter,
      billing_cycles: {
        ...plans.starter.billing_cycles,
        monthly: {
          amount: 17.45,
          currency: "EUR",
          currency_decimals: 2,
          interval: "month",
        },
      },
    },
  };
  expect(renderCards(billing, "monthly", updated)).toContain("€17.45");
  const kd = {
    ...plans.starter,
    billing_cycles: {
      ...plans.starter.billing_cycles,
      monthly: { amount: 1.234, currency: "KWD", currency_decimals: 3 },
    },
  };
  expect(priceLabel(kd, "monthly").amount).toContain("1.234");
});
