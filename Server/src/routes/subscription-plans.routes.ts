import { Router } from "express";
import { SubscriptionPlanController } from "../controllers/subscription-plans.controller";
import { validate } from "../middleware/validate";
import { authMiddleware,requireRole } from "../middleware/auth"
import { createSubscriptionPlanSchema, updateSubscriptionPlanSchema } from "../validators/subscriptionPlan.validators";

const router = Router();
const controller = new SubscriptionPlanController();

router.post("/create", authMiddleware,requireRole("Admin","SuperAdmin"),validate(createSubscriptionPlanSchema), controller.create.bind(controller));
router.get("/getList", authMiddleware, controller.getList.bind(controller));
router.get("/getById/:id", authMiddleware, controller.getById.bind(controller));
router.patch("/update/:id", authMiddleware,requireRole("Admin","SuperAdmin"), validate(updateSubscriptionPlanSchema), controller.update.bind(controller));
router.delete("/delete/:id", authMiddleware,requireRole("Admin","SuperAdmin"), controller.delete.bind(controller));

export default router;
