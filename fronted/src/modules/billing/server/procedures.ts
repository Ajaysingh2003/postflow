import axios from "axios";

import { authedProcedure, createTRPCRouter, baseProcedure } from "@/trpc/init";
import {
  getApiBase,
  getAuthHeaders,
  handleBackendError,
} from "@/lib/http-error";
import type { BillingConfigResponse } from "@/modules/types";
import { checkoutInputSchema } from "../checkout";

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

const createCheckout = authedProcedure
  .input(checkoutInputSchema)
  .mutation(async ({ input, ctx }): Promise<CheckoutResult> => {
    try {
      const response = await axios.post<{
        checkout_url: string;
        session_id: string;
      }>(`${getApiBase()}/v1/billing/checkout`, input, {
        headers: await getAuthHeaders(ctx.token, ctx.workspace_id),
        timeout: 25_000,
      });
      return {
        url: response.data.checkout_url,
        session_id: response.data.session_id,
      };
    } catch (error) {
      return handleBackendError(error, "Could not initiate checkout");
    }
  });

export const billingRouter = createTRPCRouter({
  /**
   * Retrieves available subscription plans without a trial.
   */
  getPlans: baseProcedure.query(async (): Promise<BillingConfigResponse> => {
    try {
      const response = await axios.get<BillingConfigResponse>(
        `${getApiBase()}/v1/billing/plans`,
        { timeout: 15_000 },
      );

      if (
        !response.data?.starter ||
        !response.data?.pro ||
        !response.data?.business
      )
        throw new Error("Plans are temporarily unavailable");

      return response.data;
    } catch (error) {
      return handleBackendError(
        error,
        "Could not load pricing. Please try again.",
      );
    }
  }),

  // Keep both procedure names for existing clients; one validated implementation.
  Createcheckout: createCheckout,
  createCheckout,

  /**
   * Retrieves the current workspace subscription status.
   */
  subscription: authedProcedure.query(
    async (): Promise<SubscriptionData | null> => {
      try {
        const response = await axios.get<SubscriptionData>(
          `${getApiBase()}/v1/billing/subscription`,
          { headers: await getAuthHeaders() },
        );
        return response.data;
      } catch {
        return null;
      }
    },
  ),

  /**
   * Creates a Dodo customer portal session.
   */
  portal: authedProcedure.mutation(
    async ({ ctx }): Promise<{ link: string }> => {
      try {
        const response = await axios.post<{ link: string }>(
          `${getApiBase()}/v1/billing/portal`,
          {},
          { headers: await getAuthHeaders(ctx.token, ctx.workspace_id) },
        );
        return response.data;
      } catch (error) {
        return handleBackendError(error, "Could not open billing portal");
      }
    },
  ),
});
