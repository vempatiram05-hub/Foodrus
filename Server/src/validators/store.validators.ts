import { z } from "zod";

export const createStoreSchema = z.object({
  name: z.string().trim().min(1, "Store name is required").max(200),
  type: z.string().trim().min(1, "Store type is required").max(100),
  description: z.string().trim().max(2000).optional(),
  address_line1: z.string().trim().max(500).optional().nullable(),
  address_line2: z.string().trim().max(500).optional().nullable(),
  city: z.string().trim().max(100).optional().nullable(),
  state: z.string().trim().max(100).optional().nullable(),
  postal_code: z.string().trim().max(20).optional().nullable(),
  phone: z.string().trim().max(20).optional(),
  email: z.email("Invalid email").trim().max(254).optional(),
  latitude: z.coerce.number().min(-90, "Latitude must be between -90 and 90").max(90, "Latitude must be between -90 and 90").optional().nullable(),
  longitude: z.coerce.number().min(-180, "Longitude must be between -180 and 180").max(180, "Longitude must be between -180 and 180").optional().nullable(),
  opening_time: z.string().trim().optional().nullable(),
  closing_time: z.string().trim().optional().nullable(),
  is_active: z.boolean().optional(),
  store_admin_id: z.string("Store Admin is required").min(1, "Store Admin is required").uuid("store_admin_id must be a valid UUID"),
  region_id: z.uuid("region_id must be a valid UUID").optional().nullable(),
});

export const updateStoreSchema = createStoreSchema.partial();
