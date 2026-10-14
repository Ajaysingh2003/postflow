import { expect, test } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  settingsHref,
  settingsSection,
  settingsUrl,
  canManageTeam,
  canEditMember,
} from "../src/modules/settings/model";
import { ProfileForm } from "../src/modules/settings/AccountSettings";
import { UsageCircle } from "../src/modules/billing/component/UsageCircle";
import { BillingOverview } from "../src/modules/billing/component/BillingView";

test("settings opens and closes without losing the current page filters or hash", () => {
  const page = new URL(
    "https://draftva.com/dashboard/posts?account=selected&tab=drafts#recent",
  );
  expect(settingsUrl(page, "billing")).toBe(
    "/dashboard/posts?account=selected&tab=drafts&settings=billing#recent",
  );
  expect(
    settingsUrl(
      new URL(
        "https://draftva.com/dashboard/posts?tab=drafts&settings=billing&checkout=success#recent",
      ),
      null,
    ),
  ).toBe("/dashboard/posts?tab=drafts#recent");
  expect(settingsHref("billing")).toBe("/dashboard?settings=billing");
  expect(settingsSection("security")).toBe("security");
  expect(settingsSection("unknown")).toBeNull();
  expect(settingsSection(null)).toBeNull();
  expect(page.searchParams.has("settings")).toBe(false);
});
test("team controls respect owner, admin, viewer and self restrictions", () => {
  expect(canManageTeam("owner")).toBe(true);
  expect(canManageTeam("billing")).toBe(false);
  expect(canEditMember("owner", "owner", false)).toBe(false);
  expect(canEditMember("admin", "admin", false)).toBe(false);
  expect(canEditMember("owner", "admin", false)).toBe(true);
  expect(canEditMember("admin", "editor", false)).toBe(true);
  expect(canEditMember("viewer", "editor", false)).toBe(false);
  expect(canEditMember("owner", "editor", true)).toBe(false);
});
test("profile form uses actual user information with a bounded name and verified email", () => {
  const html = renderToStaticMarkup(
    <ProfileForm
      user={{
        id: "user",
        name: "Taylor",
        email: "taylor@example.com",
        email_verified: true,
        workspace_id: "workspace",
      }}
      saving={false}
      onSave={() => {}}
    />,
  );
  expect(html).toContain('value="Taylor"');
  expect(html).toContain('maxLength="160"');
  expect(html).toContain('autoComplete="name"');
  expect(html).toContain("taylor@example.com");
  expect(html).toContain("Verified");
  expect(html).toContain("Save changes");
  expect(html).not.toContain("Change email");
});
test("usage circles distinguish unavailable, exhausted, over-limit and unlimited allowances", () => {
  const show = (value) =>
    renderToStaticMarkup(
      <UsageCircle title="Posts" value={value} note="This month" />,
    );
  const zero = show({ used: 0, limit: 5, remaining: 5 });
  expect(zero).toContain('aria-valuenow="0"');
  expect(zero).toContain('stroke-linecap="butt"');
  const over = show({ used: 7, limit: 5, remaining: 0 });
  expect(over).toContain('aria-valuenow="100"');
  expect(over).toContain('aria-valuetext="7 of 5 used"');
  expect(over).toContain("0 remaining");
  expect(show({ used: 0, limit: 0, remaining: 0 })).toContain(
    'aria-valuenow="100"',
  );
  const unlimited = show({ used: 1001, limit: null, remaining: null });
  expect(unlimited).toContain("1,001 used");
  expect(unlimited).toContain("Unlimited");
  expect(unlimited).not.toContain('role="progressbar"');
  expect(unlimited).not.toContain("remaining");
});
test("embedded billing keeps real subscription state and omits page navigation", () => {
  const usage = {
    plan_code: "pro",
    cycle_start: "2026-10-01",
    cycle_end: "2026-11-01",
    ai_credits: { used: 4, limit: 1000, remaining: 996 },
    scheduled_posts: { used: 29, limit: null, remaining: null },
    connected_accounts: { used: 2, limit: 15, remaining: 13 },
  };
  const html = renderToStaticMarkup(
    <BillingOverview
      embedded
      data={{
        usage,
        can_manage_billing: false,
        subscription: {
          status: "on_hold",
          current_period_end: "2026-11-01",
          cancel_at_period_end: false,
        },
      }}
      refreshError
    />,
  );
  expect(html).toContain("on hold");
  expect(html).toContain("last loaded usage");
  expect(html).toContain("Ask a workspace owner");
  expect(html).toContain("Unlimited");
  expect(html).not.toContain("Manage billing");
  expect(html).not.toContain("Back to Home");
});
