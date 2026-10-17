// Keep in sync with the backend plan policy and its data migration.
export const PAID_ALLOWANCES = {
  starter: { ai_credits: 1000, brand_profiles: 3 },
  pro: { ai_credits: 5000, brand_profiles: 5 },
  business: { ai_credits: 8000, brand_profiles: 10 },
} as const;
