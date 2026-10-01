import axios from "axios";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getApiBase, getAuthHeaders, handleBackendError } from "@/lib/http-error";
import { authedProcedure, createTRPCRouter } from "@/trpc/init";
import type { BrandProfile, AccountWritingSamples } from "../personaTypes";

const list = (limit: number) => z.array(z.string().trim().min(1).max(500)).max(limit);
const brandUpdate = z.object({
  niche: z.string().trim().max(240).nullable(),
  persona: z.string().trim().max(2000).nullable(),
  target_audience: z.string().trim().max(5000).nullable(),
  style_guide: z.string().trim().max(2000).nullable(),
  writing_rules: z.string().trim().max(2000).nullable(),
  linkedin_instructions: z.string().trim().max(2000).nullable(),
  goals: list(20),
  voice_traits: list(20),
  preferred_formats: list(20),
  calls_to_action: list(20),
  restricted_topics: list(50),
});

function personaError(error: unknown, fallback: string): Promise<never> {
  if (axios.isAxiosError(error) && !error.response) {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Could not reach the server. Try again." });
  }
  if (axios.isAxiosError(error) && error.response && error.response.status >= 500) {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: fallback });
  }
  return handleBackendError(error, fallback);
}

export const personaRouter = createTRPCRouter({
  brand: authedProcedure.query(async (): Promise<BrandProfile | null> => {
    try {
      return (await axios.get<BrandProfile | null>(`${getApiBase()}/v1/brand-profile`, {
        headers: await getAuthHeaders(),
      })).data;
    } catch (error) {
      return personaError(error, "Could not load writing guide");
    }
  }),
  saveBrand: authedProcedure.input(brandUpdate).mutation(async ({ input }): Promise<BrandProfile> => {
    try {
      return (await axios.patch<BrandProfile>(`${getApiBase()}/v1/brand-profile`, input, {
        headers: await getAuthHeaders(),
      })).data;
    } catch (error) {
      return personaError(error, "Could not save writing guide");
    }
  }),
  samples: authedProcedure.input(z.object({ connectionId: z.string().optional() }))
    .query(async ({ input }): Promise<AccountWritingSamples> => {
      try {
        return (await axios.get<AccountWritingSamples>(`${getApiBase()}/v1/profile-intelligence/writing-samples`, {
          headers: await getAuthHeaders(), params: { connection_id: input.connectionId },
        })).data;
      } catch (error) {
        return personaError(error, "Could not load writing samples");
      }
    }),
  saveSamples: authedProcedure.input(z.object({
    connectionId: z.string().min(1),
    writing_samples: z.array(z.string().trim().min(1).max(10000)).max(30),
  })).mutation(async ({ input }): Promise<AccountWritingSamples> => {
    try {
      return (await axios.patch<AccountWritingSamples>(`${getApiBase()}/v1/profile-intelligence/writing-samples`, {
        writing_samples: input.writing_samples,
      }, {
        headers: await getAuthHeaders(), params: { connection_id: input.connectionId },
      })).data;
    } catch (error) {
      return personaError(error, "Could not save writing samples");
    }
  }),
});
