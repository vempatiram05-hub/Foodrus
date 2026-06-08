import { z } from "zod";

export const createNotificationSchema = z.object({
  user_id: z.string().uuid("user_id must be a valid UUID"),
  channel: z.string().trim().min(1, "channel is required").max(50),
  template_code: z.string().trim().max(100).optional(),
  payload: z.record(z.string(), z.unknown()),
});
