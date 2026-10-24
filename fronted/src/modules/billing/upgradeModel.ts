import type { BillingConfigResponse, PlanConfig } from "@/modules/types";
import type { BillingCycle } from "./checkout";

export function canonicalPlan(code: string) {
  return code === "creator" ? "starter" : code === "agency" ? "business" : code;
}

export function planName(code: string) {
  const name = canonicalPlan(code);
  return name.charAt(0).toUpperCase() + name.slice(1).replaceAll("_", " ");
}

export function cycleLabel(cycle: BillingCycle, interval?: string) {
  if (cycle === "quarterly" || interval === "quarter") return "Quarterly";
  return cycle === "annually" ? "Annually" : "Monthly";
}

export function priceLabel(plan: PlanConfig, cycle: BillingCycle) {
  const price = plan.billing_cycles[cycle];
  const amount = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: price.currency || "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: price.currency_decimals ?? 2,
  }).format(price.amount);
  const interval = cycleLabel(cycle, price.interval);
  return {
    amount,
    interval,
    suffix:
      interval === "Monthly"
        ? "/ month"
        : interval === "Annually"
          ? "/ year"
          : "/ 3 months",
  };
}

export function catalogCycleLabel(
  plans: BillingConfigResponse,
  cycle: BillingCycle,
) {
  return cycleLabel(cycle, plans.starter?.billing_cycles[cycle].interval);
}
