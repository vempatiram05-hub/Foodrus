import { z } from "zod";

export const createDeliveryZoneSchema = z.object({
  store_id: z.string().uuid("store_id must be a valid UUID"),
  max_radius_km: z.number().positive("max_radius_km must be > 0"),
  base_delivery_fee: z.number().nonnegative("base_delivery_fee must be >= 0"),
  per_km_fee: z.number().nonnegative("per_km_fee must be >= 0").optional(),
});

export const updateDeliveryZoneSchema = createDeliveryZoneSchema.omit({ store_id: true }).partial();
