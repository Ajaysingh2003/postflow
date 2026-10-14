import axios from "axios";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  getApiBase,
  getAuthHeaders,
  handleBackendError,
} from "@/lib/http-error";
import { authedProcedure, createTRPCRouter } from "@/trpc/init";
import { brandSchema, type BrandProfile } from "../personaTypes";

const workspace = z.object({ workspaceId: z.string().uuid() });
async function brandError(error: unknown, fallback: string): Promise<never> {
  if (
    axios.isAxiosError(error) &&
    (!error.response || error.response.status >= 500)
  )
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: fallback });
  return handleBackendError(error, fallback);
}
export const personaRouter = createTRPCRouter({
  brand: authedProcedure
    .input(workspace)
    .query(async ({ input }): Promise<BrandProfile> => {
      try {
        return (
          await axios.get<BrandProfile>(
            `${getApiBase()}/v1/assistant/brand-profile`,
            {
              headers: await getAuthHeaders(undefined, input.workspaceId),
              timeout: 15000,
            },
          )
        ).data;
      } catch (error) {
        return brandError(
          error,
          "Could not load your brand profile. Please try again.",
        );
      }
    }),
  saveBrand: authedProcedure
    .input(
      workspace.extend({
        profile: brandSchema,
        expectedUpdatedAt: z.string().datetime({ offset: true }).nullable(),
      }),
    )
    .mutation(async ({ input }): Promise<BrandProfile> => {
      try {
        return (
          await axios.patch<BrandProfile>(
            `${getApiBase()}/v1/assistant/brand-profile`,
            {
              ...input.profile,
              expected_updated_at: input.expectedUpdatedAt,
            },
            {
              headers: await getAuthHeaders(undefined, input.workspaceId),
              timeout: 15000,
            },
          )
        ).data;
      } catch (error) {
        return brandError(
          error,
          "Could not save your brand profile. Your edits are still here.",
        );
      }
    }),
});
