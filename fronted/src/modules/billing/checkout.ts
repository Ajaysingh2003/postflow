import { z } from "zod";
import { safeAuthRedirect } from "@/modules/user/authFlow";
import type { BillingUsage } from "./usageModel";

const billingCycles = ["monthly", "quarterly", "annually"] as const;

export const checkoutInputSchema = z.object({
  plan_code: z.enum(["starter", "pro", "business"]),
  billing_cycle: z.enum(billingCycles).optional(),
  price_id: z.string().optional(),
  seats: z.number().int().min(1).max(100).default(1),
}).superRefine((input, context) => {
  if (!input.price_id) return;
  const cycle = billingCycles.find((cycle) => `${input.plan_code}_${cycle}` === input.price_id);
  if (!cycle || (input.billing_cycle && input.billing_cycle !== cycle)) {
    context.addIssue({ code: "custom", path: ["price_id"], message: "Price selection must match the plan and billing cycle" });
  }
}).transform(({ plan_code, billing_cycle, price_id, seats }) => ({
  plan_code,
  billing_cycle: billing_cycle ?? billingCycles.find((cycle) => `${plan_code}_${cycle}` === price_id) ?? "monthly",
  seats,
}));

export type CheckoutInput = z.infer<typeof checkoutInputSchema>;
export type BillingCycle = CheckoutInput["billing_cycle"];

export function hasPurchasedSubscription(billing?: BillingUsage) {
  const subscription = billing?.subscription;
  return !!subscription && subscription.plan_code !== "free" &&
    ["active", "trialing", "renewed", "updated", "plan_changed", "on_hold", "cancelled", "expired"].includes(subscription.status);
}

export function subscriptionNeedsManagement(billing?: BillingUsage) {
  if (!hasPurchasedSubscription(billing)) return false;
  const subscription = billing!.subscription!;
  return ["active", "trialing", "renewed", "updated", "plan_changed", "on_hold"].includes(subscription.status) ||
    (subscription.status === "cancelled" && !!subscription.current_period_end &&
      new Date(subscription.current_period_end).getTime() > Date.now());
}

export function checkoutLoginPath(returnTo: string) {
  return "/login?" + new URLSearchParams({
    next: safeAuthRedirect(returnTo, "/pricing"),
  });
}

export async function startPlanCheckout({
  input,
  getUser,
  checkout,
  push,
  open,
  returnTo,
  getBilling,
  openPortal,
}: {
  input: z.input<typeof checkoutInputSchema>;
  getUser: () => Promise<unknown | null>;
  checkout: (input: CheckoutInput) => Promise<{ url: string }>;
  push: (path: string) => void;
  open: (url: string) => void;
  returnTo: string;
  getBilling?: () => Promise<BillingUsage>;
  openPortal?: () => Promise<{ link: string }>;
}) {
  const selected = checkoutInputSchema.parse(input);
  if (!(await getUser())) {
    push(checkoutLoginPath(returnTo));
    return;
  }
  const billing = await getBilling?.();
  if (billing && !billing.can_manage_billing)
    throw new Error("Ask a workspace owner or billing admin to change the plan.");
  const needsPortal = subscriptionNeedsManagement(billing);
  if (needsPortal && !openPortal) throw new Error("Open billing settings to manage your subscription.");
  const result = needsPortal ? { url: (await openPortal!()).link } : await checkout(selected);
  const destination = new URL(result.url);
  if (
    destination.username ||
    destination.password ||
    (destination.protocol !== "https:" &&
      !(destination.protocol === "http:" &&
        ["localhost", "127.0.0.1", "[::1]"].includes(destination.hostname)))
  ) {
    throw new Error("The payment provider returned an invalid checkout link. Please try again.");
  }
  open(destination.href);
}
