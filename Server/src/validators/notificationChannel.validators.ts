import { z } from "zod";

export const createNotificationChannelSchema = z.object({
  name: z.string().regex(/^[A-Z_]+$/, "name must be uppercase letters and underscores only"),
  provider: z.string().trim().min(1, "provider is required").max(100),
});

export const updateNotificationChannelSchema = createNotificationChannelSchema.partial();
