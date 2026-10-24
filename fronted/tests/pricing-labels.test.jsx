import { expect, test } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import PricingPlan from "../src/modules/billing/component/PricingPlan";

test("billing selector describes the actual six-month interval without generic discount promises", () => {
  const html = renderToStaticMarkup(<PricingPlan timeLine="quarterly" setTimeLine={() => {}} />);
  expect(html).toContain("Every 6 months");
  expect(html).not.toContain("Quarterly");
  expect(html).not.toContain("Save 10%");
  expect(html).not.toContain("Save 20%");
});
