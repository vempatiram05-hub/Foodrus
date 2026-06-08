import { z } from "zod";

const CHANGE_TYPES = ["PRICE_UPDATE", "STOCK_UPDATE", "DESCRIPTION_UPDATE", "CREATE", "DELETE", "OTHER"] as const;

export const createProductChangeLogSchema = z.object({
  product_id: z.string().uuid("product_id must be a valid UUID"),
  changed_by: z.string().uuid("changed_by must be a valid UUID"),
  change_type: z.enum(CHANGE_TYPES),
  old_value: z.record(z.string(), z.unknown()).optional(),
  new_value: z.record(z.string(), z.unknown()).optional(),
});
