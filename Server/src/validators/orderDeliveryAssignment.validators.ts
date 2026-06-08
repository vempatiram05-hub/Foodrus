import { z } from "zod";

export const assignDeliverySchema = z.object({
  order_id: z.string().uuid("order_id must be a valid UUID"),
  delivery_partner_id: z.string().uuid("delivery_partner_id must be a valid UUID"),
});
