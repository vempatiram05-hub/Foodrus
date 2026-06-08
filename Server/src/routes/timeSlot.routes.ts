import { Router } from "express";
import { TimeSlotController } from "../controllers/timeSlot.controller";
import { validate } from "../middleware/validate";
import { createTimeSlotSchema, updateTimeSlotSchema } from "../validators/timeSlot.validators";

const router = Router();

router.post("/CreateTimeSlot", validate(createTimeSlotSchema), TimeSlotController.create);
router.get("/getList", TimeSlotController.getList);
router.get("/GetTimeSlotById/:id", TimeSlotController.getById);
router.put("/UpdateTimeSlot/:id", validate(updateTimeSlotSchema), TimeSlotController.update);
router.delete("/DeleteTimeSlot/:id", TimeSlotController.delete);

export default router;
