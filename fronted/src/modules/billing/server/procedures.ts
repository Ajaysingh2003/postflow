import axios from "axios";
import { z } from "zod";

import { authedProcedure, createTRPCRouter, getUserProcedure } from "@/trpc/init";
import {
  getApiBase,
  getAuthHeaders,
  handleBackendError,
} from "@/lib/http-error";
import type { BillingConfigResponse } from "@/modules/types";

export interface CheckoutResult {
  url: string;
  session_id: string;
}

export interface SubscriptionData {
  plan_code: string;
  status: string;
  current_period_end?: string | null;
  cancel_at_period_end: boolean;
  quantity: number;
  grace_until?: string | null;
}

export const defaultPlans: BillingConfigResponse = {
  starter: {
    id: "starter",
    name: "Starter",
    description: "Ideal for founders & creators scaling their personal brand.",
    trial_days: 3,
    billing_cycles: {
      monthly: { amount: 29, price_id: "starter_monthly", currency: "USD", interval: "month" },
      quarterly: { amount: 24, price_id: "starter_quarterly", currency: "USD", interval: "quarter" },
      annually: { amount: 19, price_id: "starter_annually", currency: "USD", interval: "year" },
    },
  },
  pro: {
    id: "pro",
    name: "Pro",
    description: "For growth leaders & high-volume teams running campaigns.",
    popular: true,
    trial_days: 3,
    billing_cycles: {
      monthly: { amount: 59, price_id: "pro_monthly", currency: "USD", interval: "month" },
      quarterly: { amount: 49, price_id: "pro_quarterly", currency: "USD", interval: "quarter" },
      annually: { amount: 39, price_id: "pro_annually", currency: "USD", interval: "year" },
    },
  },
  business: {
    id: "business",
    name: "Business",
    description: "For agencies managing multiple clients & unlimited pipelines.",
    trial_days: 3,
    billing_cycles: {
      monthly: { amount: 129, price_id: "business_monthly", currency: "USD", interval: "month" },
      quarterly: { amount: 109, price_id: "business_quarterly", currency: "USD", interval: "quarter" },
      annually: { amount: 89, price_id: "business_annually", currency: "USD", interval: "year" },
    },
  },
};

export const billingRouter = createTRPCRouter({
  /**
   * Retrieves available subscription plans with 3 days trial.
   */
  getPlans: getUserProcedure.query(async (): Promise<BillingConfigResponse> => {
    try {
      const response = await axios.get<BillingConfigResponse>(
        `${getApiBase()}/v1/billing/plans`,
      );
      if (response.data && Object.keys(response.data).length > 0) {
        return response.data;
      }
    } catch {
      // Fallback to default configured plans
    }
    return defaultPlans;
  }),

  /**
   * Initiates Dodo Payments hosted checkout session with 3-day trial.
   */
  Createcheckout: authedProcedure
    .input(
      z.object({
        price_id: z.string().optional(),
        plan_code: z.string().optional(),
        seats: z.number().int().min(1).default(1),
      }),
    )
    .mutation(async ({ input }): Promise<CheckoutResult> => {
      try {
        // Derive plan_code from price_id if not explicitly provided
        let planCode = input.plan_code;
        if (!planCode && input.price_id) {
          if (input.price_id.startsWith("business")) planCode = "business";
          else if (input.price_id.startsWith("pro")) planCode = "pro";
          else planCode = "starter";
        }
        planCode = planCode || "starter";

        const response = await axios.post<{ checkout_url: string; session_id: string }>(
          `${getApiBase()}/v1/billing/checkout`,
          {
            plan_code: planCode,
            price_id: input.price_id,
            seats: input.seats,
          },
          { headers: await getAuthHeaders() },
        );

        return {
          url: response.data.checkout_url,
          session_id: response.data.session_id,
        };
      } catch (error) {
        return handleBackendError(error, "Could not initiate checkout");
      }
    }),

  /**
   * Alias for createCheckout to match standard casing
   */
  createCheckout: authedProcedure
    .input(
      z.object({
        price_id: z.string().optional(),
        plan_code: z.string().optional(),
        seats: z.number().int().min(1).default(1),
      }),
    )
    .mutation(async ({ input }): Promise<CheckoutResult> => {
      let planCode = input.plan_code;
      if (!planCode && input.price_id) {
        if (input.price_id.startsWith("business")) planCode = "business";
        else if (input.price_id.startsWith("pro")) planCode = "pro";
        else planCode = "starter";
      }
      planCode = planCode || "starter";

      try {
        const response = await axios.post<{ checkout_url: string; session_id: string }>(
          `${getApiBase()}/v1/billing/checkout`,
          {
            plan_code: planCode,
            price_id: input.price_id,
            seats: input.seats,
          },
          { headers: await getAuthHeaders() },
        );

        return {
          url: response.data.checkout_url,
          session_id: response.data.session_id,
        };
      } catch (error) {
        return handleBackendError(error, "Could not initiate checkout");
      }
    }),

  /**
   * Retrieves the current workspace subscription status.
   */
  subscription: authedProcedure.query(async (): Promise<SubscriptionData | null> => {
    try {
      const response = await axios.get<SubscriptionData>(
        `${getApiBase()}/v1/billing/subscription`,
        { headers: await getAuthHeaders() },
      );
      return response.data;
    } catch {
      return null;
    }
  }),

  /**
   * Creates a Dodo customer portal session.
   */
  portal: authedProcedure.mutation(async (): Promise<{ link: string }> => {
    try {
      const response = await axios.post<{ link: string }>(
        `${getApiBase()}/v1/billing/portal`,
        {},
        { headers: await getAuthHeaders() },
      );
      return response.data;
    } catch (error) {
      return handleBackendError(error, "Could not open billing portal");
    }
  }),
});
