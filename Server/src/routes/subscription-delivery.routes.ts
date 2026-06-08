import { Router } from "express";
import { SubscriptionDeliveryController } from "../controllers/subscription-delivery.controller";
import { validate } from "../middleware/validate";
import { authMiddleware } from "../middleware/auth";
import { createSubscriptionDeliverySchema } from "../validators/subscriptionDelivery.validators";

const router = Router();
const controller = new SubscriptionDeliveryController();

router.post(
  "/",authMiddleware,
  validate(createSubscriptionDeliverySchema),
  controller.create.bind(controller)
);

router.get(
  "/subscription/:user_subscription_id",authMiddleware,
  controller.getBySubscription.bind(controller)
);

router.get(
  "/order/:order_id",authMiddleware,
  controller.getByOrder.bind(controller)
);

export default router;
