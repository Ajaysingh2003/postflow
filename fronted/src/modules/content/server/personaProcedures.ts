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
  manageBrand: authedProcedure
    .input(
      workspace.extend({
        action: z.enum(["create", "activate", "rename", "delete", "train"]),
        profileId: z.string().uuid().optional(),
        name: z.string().trim().min(1).max(120).optional(),
        expectedUpdatedAt: z
          .string()
          .datetime({ offset: true })
          .nullable()
          .optional(),
      }),
    )
    .mutation(async ({ input }): Promise<BrandProfile> => {
      if (input.action !== "create" && !input.profileId)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Choose a brand profile",
        });
      if (["create", "rename"].includes(input.action) && !input.name)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Enter a profile name",
        });
      const path =
        input.action === "create"
          ? ""
          : `/${input.profileId}${input.action === "delete" ? "" : input.action === "rename" ? "/name" : `/${input.action}`}`;
      try {
        return (
          await axios.request<BrandProfile>({
            method:
              input.action === "delete"
                ? "DELETE"
                : input.action === "rename"
                  ? "PATCH"
                  : "POST",
            url: `${getApiBase()}/v1/assistant/brand-profiles${path}`,
            data:
              input.action === "train"
                ? { expected_updated_at: input.expectedUpdatedAt }
                : { name: input.name },
            headers: await getAuthHeaders(undefined, input.workspaceId),
            timeout: input.action === "train" ? 120000 : 15000,
          })
        ).data;
      } catch (error) {
        return brandError(
          error,
          "Could not update your brand profiles. Please try again.",
        );
      }
    }),
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
        profileId: z.string().uuid().optional(),
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
              params: { profile_id: input.profileId },
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
