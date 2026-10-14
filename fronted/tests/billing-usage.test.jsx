import { expect, test } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  BillingOverview,
  BillingSkeleton,
} from "../src/modules/billing/component/BillingView";
import { AiUsageNotice } from "../src/modules/billing/component/AiUsageNotice";
import { UsageMeter } from "../src/modules/billing/component/UsageMeter";
import { planFeatures } from "../src/modules/billing/component/PricingCardSection";
import { HomeOverview } from "../src/modules/dashboard/view/HomeView";
import {
  aiExhausted,
  usagePercent,
  usageReset,
} from "../src/modules/billing/usageModel";

const usage = {
  plan_code: "free",
  cycle_start: "2026-10-01T00:00:00Z",
  cycle_end: "2026-11-01T00:00:00Z",
  ai_credits: { used: 20, limit: 20, remaining: 0 },
  scheduled_posts: { used: 2, limit: 5, remaining: 3 },
  connected_accounts: { used: 1, limit: 2, remaining: 1 },
};
test("billing shows true free-plan usage without inventing a trial from checkout", () => {
  const html = renderToStaticMarkup(
    <BillingOverview
      data={{ usage, subscription: null, can_manage_billing: true }}
      checkoutReturned
    />,
  );
  expect(html).toContain("Free plan");
  expect(html).toContain("20 / 20");
  expect(html).toContain("Nov 1, 2026");
  expect(html).toContain("payment confirmation");
  expect(html).toContain("One post across all selected channels");
  expect(html).not.toContain("Trial active");
  expect(html).not.toContain("CDN");
  expect(html).not.toContain("Manage billing");
});
test("paid trial and cancellation reflect subscription state; viewers cannot change billing", () => {
  const data = {
    usage: { ...usage, plan_code: "pro" },
    subscription: {
      status: "trialing",
      current_period_end: "2026-10-11T12:00:00Z",
      cancel_at_period_end: false,
    },
    can_manage_billing: true,
  };
  let html = renderToStaticMarkup(<BillingOverview data={data} />);
  expect(html).toContain("Trial active");
  expect(html).toContain("Trial ends Oct 11, 2026");
  expect(html).toContain("Manage billing");
  html = renderToStaticMarkup(
    <BillingOverview
      data={{
        ...data,
        can_manage_billing: false,
        subscription: { ...data.subscription, status: "cancelled" },
      }}
    />,
  );
  expect(html).toContain("Access until");
  expect(html).toContain("Ask a workspace owner");
  expect(html).not.toContain("Compare plans");
});
test("AI sidecar explains exhausted, unlimited, loading and failed refresh states", () => {
  let html = renderToStaticMarkup(<AiUsageNotice usage={usage} />);
  expect(html).toContain('role="alert"');
  expect(html).toContain("Your AI credits are used up");
  expect(html).toContain("keep writing");
  expect(html).toContain("Publishing follows your post allowance");
  expect(html).toContain('href="/dashboard?settings=billing"');
  expect(aiExhausted(usage)).toBe(true);
  const unlimited = {
    ...usage,
    ai_credits: { used: 1000, limit: null, remaining: null },
  };
  html = renderToStaticMarkup(<AiUsageNotice usage={unlimited} />);
  expect(html).toContain("Unlimited");
  expect(html).not.toContain("used up");
  expect(aiExhausted(unlimited)).toBe(false);
  expect(usagePercent({ used: 0, limit: 0, remaining: 0 })).toBe(100);
  expect(usageReset(usage.cycle_end)).toBe("Nov 1, 2026");
  expect(renderToStaticMarkup(<AiUsageNotice loading />)).toContain(
    "Loading AI allowance",
  );
  expect(renderToStaticMarkup(<AiUsageNotice usage={usage} error />)).toContain(
    "Try again",
  );
  expect(renderToStaticMarkup(<BillingSkeleton />)).toContain(
    "Loading plan and usage",
  );
});
test("Home includes real connections and AI quota alongside its three original summaries", () => {
  const data = {
    workspace_name: "Workspace",
    usage,
    can_edit: true,
    can_manage_channels: true,
    fetched_at: usage.cycle_start,
    counts: {
      drafts: 0,
      scheduled: 0,
      published_week: 0,
      published: 0,
      failed: 0,
    },
    accounts: [],
    drafts: [],
    upcoming: [],
    failed: [],
    published: [],
  };
  const html = renderToStaticMarkup(<HomeOverview data={data} />);
  expect(html).toContain("Connected accounts");
  expect(html).toContain("of 2 included");
  expect(html).toContain("AI allowance used up");
  expect(html).toContain("credits remaining");
  expect(html).toContain('aria-valuetext="20 of 20 credits used"');
  expect(html).toContain('href="/dashboard?settings=billing"');
});

test("plan comparison shows configured social allowances without video-service promises", () => {
  const features = planFeatures({
    limits: {
      ai_credits: 123,
      scheduled_posts: 50,
      connected_accounts: 5,
      seats: 3,
      workspaces: 3,
    },
  });
  expect(features.map((f) => f.label)).toContain("123 AI credits / month");
  expect(features.map((f) => f.label)).toContain("50 posts / month");
  expect(features.map((f) => f.label).join(" ")).not.toContain("Video Storage");
});

test("unlimited post plans have no monthly cap or slot-based pricing copy", () => {
  const features = planFeatures({
    limits: {
      ai_credits: 250,
      scheduled_posts: null,
      connected_accounts: 5,
      seats: 3,
      workspaces: 3,
    },
  });
  const labels = features.map((f) => f.label);
  expect(labels).toContain("Unlimited posts");
  expect(labels).toContain("250 AI credits / month");
  expect(labels.join(" ")).not.toContain("uses one slot");
  const html = renderToStaticMarkup(
    <UsageMeter
      title="Posts"
      value={{ used: 1001, limit: null, remaining: null }}
    />,
  );
  expect(html).toContain("Unlimited");
  expect(html).not.toContain('role="progressbar"');
  expect(html).not.toContain("remaining");
  const billing = renderToStaticMarkup(
    <BillingOverview
      data={{
        usage: {
          ...usage,
          plan_code: "starter",
          scheduled_posts: { used: 1001, limit: null, remaining: null },
        },
        subscription: { status: "active" },
        can_manage_billing: true,
      }}
    />,
  );
  expect(billing).toContain("AI credits reset");
  expect(billing).not.toContain("AI and post allowances reset");
  expect(billing).not.toContain("One post across all selected channels");
});
