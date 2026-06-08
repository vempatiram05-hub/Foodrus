import { z } from "zod";

export const createTemplateSchema = z.object({
  name: z.string().trim().min(1, "Template name is required").max(100),
  is_global: z.boolean().optional(),
});

export const updateTemplateSchema = z.object({
  name: z.string().trim().min(1, "Template name is required").max(100).optional(),
  is_global: z.boolean().optional(),
});
