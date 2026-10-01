// fronted/src/modules/types.ts

export interface FeatureItem {
  label: string;
  icon: any;
}

export interface BillingCycleConfig {
  amount: number;
  price_id: string;
  currency?: string;
  interval?: string;
}

export interface PlanConfig {
  id: string;
  name: string;
  description: string;
  popular?: boolean;
  trial_days: number;
  billing_cycles: {
    monthly: BillingCycleConfig;
    quarterly: BillingCycleConfig;
    annually: BillingCycleConfig;
  };
}

export type BillingConfigResponse = Record<string, PlanConfig>;
