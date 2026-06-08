import { z } from "zod";

export const createRegionSchema = z.object({
  name: z.string().trim().min(1, "Region name is required").max(100),
  code: z.string().trim().min(1, "Region code is required").max(20).toUpperCase(),
});

export const updateRegionSchema = createRegionSchema.partial();
