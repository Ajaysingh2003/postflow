import { z } from "zod";

export const emailSchema = z
  .string()
  .trim()
  .max(254)
  .email("Enter a valid email address");
export const linkTokenSchema = z
  .string()
  .min(20, "This link is invalid. Request a new one.")
  .max(500);
export const verificationInputSchema = z
  .object({
    email: emailSchema.optional(),
    token: z.union([z.string().regex(/^[0-9]{6}$/), linkTokenSchema]),
  })
  .refine((value) => !/^[0-9]{6}$/.test(value.token) || !!value.email, {
    message: "Enter the email address that received the code",
    path: ["email"],
  });

export const authUserSchema = z.object({
  id: z.string().min(1),
  email: emailSchema,
  name: z.string().trim().min(1).max(160),
  workspace_id: z.string().min(1),
  email_verified: z.boolean(),
  onboarding_completed_at: z.string().nullable().optional(),
});

export const authResponseSchema = z
  .object({
    access_token: z.string().min(20).max(4096).regex(/^\S+$/),
    token_type: z.literal("bearer"),
    expires_in: z.number().int().positive(),
    user_id: z.string().min(1),
    workspace_id: z.string().min(1),
    email: emailSchema,
    name: z.string().trim().min(1).max(160),
    email_verified: z.boolean(),
    verification_required: z.boolean(),
    verification_sent: z.boolean().default(false),
    verification_error: z.string().nullable().optional(),
    retry_after: z.number().int().nonnegative().default(0),
  })
  .refine((value) => !(value.email_verified && value.verification_required));

export const authMessageSchema = z.object({
  outcome: z.enum(["completed", "accepted", "verified", "password_updated"]),
  message: z.string().trim().min(1),
  retry_after: z.number().int().nonnegative().default(0),
  expires_in: z.number().int().nonnegative().nullable().optional(),
  already_verified: z.boolean().default(false),
  delivery_status: z.enum(["accepted", "sent", "failed"]).nullable().optional(),
  email: emailSchema.nullable().optional(),
});

// Never send raw upstream payloads (including validation issues) to the browser.
export function parseAuthResponse<T>(schema: z.ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success)
    throw new Error("Invalid authentication service response");
  return result.data;
}
