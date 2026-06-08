import { z } from "zod";

export const createAuditLogSchema = z.object({
  user_id: z.string().uuid("user_id must be a valid UUID").optional(),
  entity_type: z.string().trim().min(1, "entity_type is required").max(100),
  entity_id: z.string().uuid("entity_id must be a valid UUID").optional(),
  action: z.string().trim().min(1, "action is required").max(100),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const updateAuditLogSchema = createAuditLogSchema.partial();
