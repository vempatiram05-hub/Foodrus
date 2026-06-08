import { z } from "zod";

export const createInventorySchema = z.object({
  product_id: z.string().uuid("product_id must be a valid UUID"),
  current_stock: z.number().int().nonnegative("current_stock must be >= 0").optional(),
  stock_threshold: z.number().int().nonnegative("stock_threshold must be >= 0").optional(),
});

export const updateStockSchema = z.object({
  stock_delta: z.number().int("stock_delta must be an integer"),
}).or(z.object({
  current_stock: z.number().int().nonnegative("current_stock must be >= 0"),
}));
