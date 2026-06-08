import { z } from "zod";

export const recordDeliveryLocationSchema = z.object({
  delivery_partner_id: z.string().uuid("delivery_partner_id must be a valid UUID"),
  latitude: z.number().min(-90, "latitude must be between -90 and 90").max(90, "latitude must be between -90 and 90"),
  longitude: z.number().min(-180, "longitude must be between -180 and 180").max(180, "longitude must be between -180 and 180"),
  order_id: z.string().uuid("order_id must be a valid UUID").optional(),
});
