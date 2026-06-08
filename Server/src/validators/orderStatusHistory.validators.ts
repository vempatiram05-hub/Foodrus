import { z } from "zod";

const ORDER_STATUSES = ["pending", "confirmed", "preparing", "ready", "delivering", "delivered", "cancelled"] as const;

export const createOrderStatusHistorySchema = z.object({
  order_id: z.string().uuid("order_id must be a valid UUID"),
  from_status: z.enum(ORDER_STATUSES).optional(),
  to_status: z.enum(ORDER_STATUSES),
  changed_by: z.string().uuid("changed_by must be a valid UUID").optional(),
  note: z.string().trim().max(500).optional(),
});
