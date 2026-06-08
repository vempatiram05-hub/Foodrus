import { z } from "zod";

export const createSubscriptionPlanSchema = z.object({
  name: z.string().trim().min(1, "name is required").max(100),
  description: z.string().trim().max(1000).optional(),
  max_deliveries: z.number().int().positive("max_deliveries must be > 0"),
  period_type: z.enum(["WEEKLY", "MONTHLY"]),
  price: z.number().positive("price must be > 0"),
  max_radius_km: z.number().positive().optional(),
  free_trial_deliveries: z.number().int().nonnegative().optional(),
  is_active: z.boolean().optional(),
});

export const updateSubscriptionPlanSchema = createSubscriptionPlanSchema.partial();
