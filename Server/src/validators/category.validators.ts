import { z } from "zod";

export const createCategorySchema = z.object({
  name: z.string().trim().min(1, "Category name is required").max(100),
  description: z.string().trim().max(1000).optional(),
  is_active: z.boolean().optional(),
  type: z.enum(["food", "grocery", "bakery"]).optional(),
});

export const updateCategorySchema = createCategorySchema.partial();
