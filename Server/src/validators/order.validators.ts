import { z } from "zod";

const orderItemSchema = z.object({
  product_id: z.uuid("product_id must be a valid UUID").optional().nullable(),
  menus_id: z.uuid("menus_id must be a valid UUID").optional().nullable(),
  name: z.string().max(500).optional(),
  quantity: z.number().int().positive("quantity must be > 0"),
  unit_price: z.number().nonnegative("unit_price must be >= 0"),
});

export const createOrderSchema = z.object({
  // Order fields
  user_id: z.uuid("user_id must be a valid UUID"),
  address_id: z.uuid("address_id must be a valid UUID"),
  items: z.array(orderItemSchema).optional(),
  tax_amount: z.number().nonnegative().optional(),
  delivery_fee: z.number().nonnegative().optional(),
  discount_amount: z.number().nonnegative().optional(),
  store_id: z.uuid("store_id must be a valid UUID").optional(),

  // Payment fields (all optional — skipped if not provided)
  amount: z.number().positive("amount must be > 0").optional(),
  currency: z.string().length(3).optional().default("USD"),

  // Payment method — provide existing ID OR new card details (both optional)
  payment_method_id: z.uuid("payment_method_id must be a valid UUID").optional(),
  last4: z.string().regex(/^[0-9]{4}$/, "last4 must be exactly 4 digits").optional(),
  method_type: z.string().min(1).optional(),
  provider: z.string().min(1).optional(),
  token_reference: z.string().min(1).optional(),
});

export const updateOrderSchema = z.object({
  order_status: z.enum(["PENDING", "APPROVED", "PREPARING", "READY", "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED", "REJECTED"]).optional(),
  payment_status: z.enum(["unpaid", "paid", "refunded"]).optional(),
  notes: z.string().trim().max(500).optional(),
}).strict();
