import { z } from "zod";

export const createRefundSchema = z.object({
  payment_id: z.string().uuid("payment_id must be a valid UUID"),
  amount: z.number().positive("amount must be > 0"),
  reason: z.string().trim().max(500).optional(),
});

export const updateRefundStatusSchema = z.object({
  status: z.enum(["PENDING", "SUCCESS", "FAILED"]),
});
