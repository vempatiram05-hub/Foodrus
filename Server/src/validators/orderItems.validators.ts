import { z } from "zod";

export const createOrderItemSchema = z.object({
  order_id: z.string().uuid("order_id must be a valid UUID"),
  product_id: z.string().uuid("product_id must be a valid UUID").optional(),
  menus_id: z.string().uuid("menus_id must be a valid UUID").optional(),
  quantity: z.number().int().positive("quantity must be > 0"),
  unit_price: z.number().positive("unit_price must be > 0"),
  is_food: z.boolean().optional(),
}).refine((d) => d.product_id || d.menus_id, {
  message: "Either product_id or menus_id is required",
});

export const updateOrderItemSchema = z.object({
  quantity: z.number().int().positive("quantity must be > 0").optional(),
  unit_price: z.number().positive("unit_price must be > 0").optional(),
}).refine((d) => d.quantity !== undefined || d.unit_price !== undefined, {
  message: "At least one field must be provided",
});
