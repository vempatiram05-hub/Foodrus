import { z } from "zod";

export const createSubscriptionDeliverySchema = z.object({
  user_subscription_id: z.string().uuid("user_subscription_id must be a valid UUID"),
  order_id: z.string().uuid("order_id must be a valid UUID"),
  is_trial_delivery: z.boolean().optional(),
});
