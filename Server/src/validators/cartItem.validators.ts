import { z } from "zod";

export const addCartItemSchema = z.object({
  cart_id: z.string().uuid("cart_id must be a valid UUID"),
  product_id: z.string().uuid("product_id must be a valid UUID").optional(),
  menus_id: z.string().uuid("menus_id must be a valid UUID").optional(),
  quantity: z.number().int().positive("quantity must be > 0"),
  unit_price: z.number().positive("unit_price must be > 0"),
}).refine((d) => d.product_id || d.menus_id, {
  message: "Either product_id or menus_id is required",
});

export const updateCartItemSchema = z.object({
  quantity: z.number().int().positive("quantity must be > 0"),
});
