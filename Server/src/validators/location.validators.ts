import { z } from "zod";

const countryPayloadSchema = z.object({
  name: z.string().trim().min(1, "name is required").max(100),
  code: z.string().trim().min(2).max(3).optional(),
});

const statePayloadSchema = z.object({
  name: z.string().trim().min(1, "name is required").max(100),
  country_id: z.string().uuid("country_id must be a valid UUID"),
  code: z.string().trim().max(10).optional(),
});

const cityPayloadSchema = z.object({
  name: z.string().trim().min(1, "name is required").max(100),
  state_id: z.string().uuid("state_id must be a valid UUID"),
});

export const createLocationSchema = z.discriminatedUnion("table", [
  z.object({ table: z.literal("country"), payload: countryPayloadSchema }),
  z.object({ table: z.literal("state"), payload: statePayloadSchema }),
  z.object({ table: z.literal("city"), payload: cityPayloadSchema }),
]);

export const updateLocationSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  code: z.string().trim().max(10).optional(),
  country_id: z.string().uuid().optional(),
  state_id: z.string().uuid().optional(),
}).refine((d) => Object.values(d).some((v) => v !== undefined), {
  message: "At least one field must be provided",
});
