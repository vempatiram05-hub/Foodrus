import { z } from "zod";

export const createPaymentSchema = z.object({
  order_id: z.string().uuid("order_id must be a valid UUID"),
  payment_method_id: z.string().uuid("payment_method_id must be a valid UUID"),
  amount: z.number().positive("amount must be > 0"),
  currency: z.string().trim().length(3, "currency must be a 3-letter code").optional(),
  status: z.string().trim().max(50).optional(),
  provider_payment_id: z.string().trim().max(255).optional(),
  notes: z.string().trim().max(500).optional(),
});

export const updatePaymentSchema = createPaymentSchema.partial().omit({ order_id: true, payment_method_id: true });
