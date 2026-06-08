import { z } from "zod";

export const createSubcategorySchema = z.object({
  name: z.string().trim().min(1, "Subcategory name is required").max(100),
  category_id: z.string().uuid("category_id must be a valid UUID"),
  description: z.string().trim().max(1000).optional(),
  is_active: z.boolean().optional(),
});

export const updateSubcategorySchema = createSubcategorySchema.partial();
