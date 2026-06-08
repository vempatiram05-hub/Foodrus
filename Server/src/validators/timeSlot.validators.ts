import { z } from "zod";

const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

export const createTimeSlotSchema = z.object({
  name: z.string().trim().min(1, "TimeSlot name is required").max(100),
  code: z.string().trim().min(1, "TimeSlot code is required").max(50),
  start_time: z.string().trim().regex(timeRegex, "start_time must be HH:MM").optional(),
  end_time: z.string().trim().regex(timeRegex, "end_time must be HH:MM").optional(),
});

export const updateTimeSlotSchema = createTimeSlotSchema.partial();
