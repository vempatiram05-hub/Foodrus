import { z } from "zod";

export const createAddressSchema = z.object({
  user_id: z.string().uuid("user_id must be a valid UUID"),
  line1: z.string().trim().min(1, "line1 is required").max(255),
  line2: z.string().trim().max(255).optional(),
  city_id: z.string().trim().max(255).optional(),
  state_id: z.string().trim().max(255).optional(),
  country_id: z.string().trim().max(255).optional(),
  postal_code: z.string().trim().max(20).optional(),
  label: z.string().trim().max(50).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  is_default: z.boolean().optional(),
});

export const updateAddressSchema = createAddressSchema.omit({ user_id: true }).partial();
