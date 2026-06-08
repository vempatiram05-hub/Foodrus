import { z } from "zod";

export const createProductSchema = z.object({
  name: z.string().trim().min(1, "Product name is required").max(200),
  sku: z.string().trim().max(100).optional(),
  description: z.string().trim().max(2000).optional(),
  base_price: z.coerce.number().nonnegative("base_price must be >= 0").optional(),
  quantity: z.coerce.number().int().nonnegative("quantity must be >= 0").optional(),
  is_veg: z.preprocess(
    (v) => (v === "true" || v === true ? true : v === "false" || v === false ? false : v === "" ? undefined : v),
    z.boolean()
  ).optional(),
  is_active: z.preprocess(
    (v) => (v === "true" || v === true ? true : v === "false" || v === false ? false : v === "" ? undefined : v),
    z.boolean()
  ).optional(),
  variant_id: z.preprocess(
    (v) => (typeof v === "string" && v.trim() !== "" ? JSON.parse(v) : v === "" ? undefined : v),
    z.array(z.string().uuid())
  ).optional(),
  category_id: z.string().uuid("category_id must be a valid UUID").optional(),
  subcategory_id: z.string().uuid("subcategory_id must be a valid UUID").optional(),
  brand_id: z.string().uuid("brand_id must be a valid UUID").optional(),
  template_id: z.string().uuid("template_id must be a valid UUID").optional(),
  store_id: z.string().uuid("store_id must be a valid UUID").optional(),
});

export const updateProductSchema = createProductSchema.partial();
