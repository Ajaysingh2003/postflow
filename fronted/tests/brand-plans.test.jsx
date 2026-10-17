import { expect, test } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TRPCReactProvider } from "../src/trpc/client";
import { BrandProfileManager } from "../src/modules/content/component/BrandProfileManager";
import { EMPTY_BRAND } from "../src/modules/content/personaTypes";
import { PAID_ALLOWANCES } from "../src/modules/billing/planAllowances";
import { planFeatures } from "../src/modules/billing/component/PricingCardSection";
import PricingComparisonTable from "../src/modules/billing/component/PricingComparisonTable";
import PricingFaqSection from "../src/modules/billing/component/PricingFaqSection";

const profile = {
  ...EMPTY_BRAND,
  id: "one",
  workspace_id: "workspace",
  profile_name: "Personal",
  paid_access: true,
  can_edit: true,
  updated_at: "2026-10-17T00:00:00Z",
  profiles: [
    { id: "one", name: "Personal", active: true },
    { id: "two", name: "Studio", active: false },
  ],
  profile_limit: 3,
};
function render(props) {
  return renderToStaticMarkup(
    <TRPCReactProvider>
      <BrandProfileManager
        workspaceId="workspace"
        profile={profile}
        {...props}
      />
    </TRPCReactProvider>,
  );
}
test("pricing shows the same monthly AI and saved voice allowances for every tier", () => {
  const comparison = renderToStaticMarkup(<PricingComparisonTable />);
  for (const [code, values] of Object.entries(PAID_ALLOWANCES)) {
    const labels = planFeatures({ id: code, limits: values }).map(
      (item) => item.label,
    );
    expect(labels).toContain(
      `${values.ai_credits.toLocaleString("en-US")} AI credits / month`,
    );
    expect(labels).toContain(
      `${values.brand_profiles} custom brand voice profiles`,
    );
    expect(comparison).toContain(
      `${values.ai_credits.toLocaleString("en-US")} credits`,
    );
    expect(comparison).toContain(`${values.brand_profiles} voice profiles`);
  }
  const faq = renderToStaticMarkup(<PricingFaqSection />);
  expect(faq).toContain("no trial deadline");
  expect(faq).not.toContain("3-day");
});
test("Free has an honest upgrade state with no creation or training controls", () => {
  const html = render({
    profile: {
      ...profile,
      paid_access: false,
      can_edit: false,
      profile_limit: 0,
    },
  });
  expect(html).toContain("Custom brand voices are a paid feature");
  expect(html).toContain('href="/dashboard?settings=billing"');
  expect(html).not.toContain("New profile");
  expect(html).not.toContain("Learn from saved samples");
});
test("profile selection uses saved names and blocks managing unsaved edits", () => {
  const html = render({ disabled: true });
  expect(html).toContain("Active brand voice");
  expect(html).toContain('value="one" selected=""');
  expect(html).toContain("Personal");
  expect(html).toContain("Studio");
  expect(html).toContain("Save or discard your edits");
  expect(html).toContain("disabled");
  expect(html).not.toContain("<form");
});
test("profile limits, training prerequisites and read-only permissions remain visible", () => {
  const full = render({ profile: { ...profile, profile_limit: 2 } });
  expect(full).toContain("profile limit is reached");
  expect(full).toContain("1 credit");
  const viewer = render({ profile: { ...profile, can_edit: false } });
  expect(viewer).not.toContain("Delete selected brand profile");
  expect(viewer).not.toContain("Learn from saved samples");
  expect(viewer).toContain("disabled");
});
