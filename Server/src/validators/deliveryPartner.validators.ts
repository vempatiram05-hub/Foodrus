import { z } from "zod";

export const createDeliveryPartnerSchema = z.object({
  user_id: z.string().uuid("user_id must be a valid UUID"),
  vehicle_type: z.enum(["BIKE", "CAR"]).optional(),
});

export const updateDeliveryPartnerSchema = z.object({
  vehicle_type: z.enum(["BIKE", "CAR"]).optional(),
  is_active: z.boolean().optional(),
}).refine((d) => Object.keys(d).length > 0, { message: "At least one field must be provided" });
