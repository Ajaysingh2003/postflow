export type Allowance = {
  used: number;
  limit: number | null;
  remaining: number | null;
};
export type PlanUsage = {
  plan_code: string;
  cycle_start: string;
  cycle_end: string;
  ai_credits: Allowance;
  scheduled_posts: Allowance;
  connected_accounts: Allowance;
};
export type BillingUsage = {
  usage: PlanUsage;
  can_manage_billing: boolean;
  subscription: null | {
    plan_code: string;
    status: string;
    current_period_end: string | null;
    cancel_at_period_end: boolean;
    quantity: number;
    grace_until: string | null;
  };
};
export const USAGE_QUERY_OPTIONS = {
  staleTime: 15_000,
  refetchOnWindowFocus: true,
  refetchInterval: 60_000,
  retry: false,
} as const;
export function usagePercent(value: Allowance) {
  return value.limit === null
    ? 0
    : value.limit === 0
      ? 100
      : Math.min(100, Math.max(0, (value.used / value.limit) * 100));
}
export function usageReset(value: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).formatToParts(new Date(value));
  const values = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${values.month} ${values.day}, ${values.year}`;
}
export function aiExhausted(value?: PlanUsage) {
  return (
    !!value &&
    value.ai_credits.limit !== null &&
    value.ai_credits.remaining === 0
  );
}
