import { z } from "zod";

const isoDateRegex = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})?)?)?$/;

export const createUserSubscriptionSchema = z.object({
  user_id: z.string().uuid("user_id must be a valid UUID"),
  subscription_plan_id: z.string().uuid("subscription_plan_id must be a valid UUID"),
  start_date: z.string().trim().regex(isoDateRegex, "start_date must be a valid date"),
  end_date: z.string().trim().regex(isoDateRegex, "end_date must be a valid date"),
  remaining_deliveries: z.number().int().nonnegative("remaining_deliveries must be >= 0"),
  is_trial: z.boolean().optional(),
});
