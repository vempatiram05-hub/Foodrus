import { z } from "zod";

export const createBrandSchema = z.object({
  name: z.string().trim().min(1, "Brand name is required").max(100),
  store_id: z.string().uuid("store_id must be a valid UUID"),
  category_id: z.string().uuid("category_id must be a valid UUID").optional(),
  subcategory_id: z.string().uuid("subcategory_id must be a valid UUID").optional(),
  description: z.string().trim().max(1000).optional(),
  is_active: z.boolean().optional(),
});

export const updateBrandSchema = createBrandSchema.partial();
