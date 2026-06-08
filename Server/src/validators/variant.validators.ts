import { z } from "zod";

export const createVariantSchema = z.object({
  name: z.string().trim().min(1, "Variant name is required").max(100),
  description: z.string().trim().max(500).optional(),
});

export const updateVariantSchema = createVariantSchema.partial();
