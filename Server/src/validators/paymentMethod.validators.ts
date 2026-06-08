import { z } from "zod";

export const createPaymentMethodSchema = z.object({
  user_id: z.string().uuid("user_id must be a valid UUID"),
  last4: z.string().regex(/^\d{4}$/, "last4 must be exactly 4 digits"),
  method_type: z.string().trim().min(1, "method_type is required").max(50),
  provider: z.string().trim().min(1, "provider is required").max(100),
  token_reference: z.string().trim().min(1, "token_reference is required").max(255),
});

export const updatePaymentMethodSchema = z.object({
  last4: z.string().regex(/^\d{4}$/, "last4 must be exactly 4 digits").optional(),
  method_type: z.string().trim().min(1).max(50).optional(),
  provider: z.string().trim().min(1).max(100).optional(),
}).refine((d) => d.last4 || d.method_type || d.provider, {
  message: "At least one field must be provided",
});
