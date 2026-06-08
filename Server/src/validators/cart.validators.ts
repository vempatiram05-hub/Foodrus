import { z } from "zod";

export const createCartSchema = z.object({
  user_id: z.string().uuid("user_id must be a valid UUID"),
  store_id: z.string().uuid("store_id must be a valid UUID"),
});
