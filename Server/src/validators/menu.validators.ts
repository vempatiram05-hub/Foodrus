import { z } from "zod";

const menuProductSchema = z.union([
  z.string().uuid("product_id must be a valid UUID"),
  z.object({ product_id: z.string().uuid("product_id must be a valid UUID") }),
]);

export const createMenuSchema = z.object({
  store_id: z.string().uuid("store_id must be a valid UUID"),
  time_slot_id: z.string().uuid("time_slot_id must be a valid UUID"),
  products: z.array(menuProductSchema).min(1, "At least one product is required"),
  date: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD").optional(),
  weekday: z.union([
    z.enum(["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"]),
    z.number().int().min(0).max(6)
  ]).optional(),
  is_active: z.boolean().optional(),
  submitted_by: z.string().uuid("submitted_by must be a valid UUID"),
  notes: z.string().optional(),
});

export const updateMenuSchema = createMenuSchema.partial();

/**
 * Validates the body when a Store Admin adds more products to an
 * already-APPROVED menu.  Products can be bare UUID strings or
 * objects carrying a `product_id` UUID.
 */

export const addPendingProductsSchema = z.object({
  products: z
    .array(menuProductSchema)
    .min(1, "At least one product is required"),
});
