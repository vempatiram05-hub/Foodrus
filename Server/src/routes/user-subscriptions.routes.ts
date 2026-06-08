import { Router } from "express";
import { UserSubscriptionController } from "../controllers/user-subscriptions.controller";
import { validate } from "../middleware/validate";
import { authMiddleware } from "../middleware/auth";
import { createUserSubscriptionSchema } from "../validators/userSubscription.validators";

const router = Router();
const controller = new UserSubscriptionController();

router.post("/Create",authMiddleware, validate(createUserSubscriptionSchema), controller.create.bind(controller));
router.get("/getList",authMiddleware, controller.getList.bind(controller));
router.get("/GetById/:id",authMiddleware, controller.getById.bind(controller));
router.get("/GetByuserId/:user_id",authMiddleware, controller.getByUser.bind(controller));
router.delete("/Delete/:id",authMiddleware, controller.delete.bind(controller));
router.patch("/cancel/:id",authMiddleware, controller.cancel.bind(controller));
router.patch("/expire/:id",authMiddleware, controller.expire.bind(controller));

export default router;
