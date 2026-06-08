import { Router } from "express";
import { deliveryLocationController } from "../controllers/deliveryLocation.controller";
import { validate } from "../middleware/validate";
import {authMiddleware} from "../middleware/auth"
import { recordDeliveryLocationSchema } from "../validators/deliveryLocation.validators";

const router = Router();

router.post(
  "/",authMiddleware,
  validate(recordDeliveryLocationSchema),
  deliveryLocationController.record.bind(deliveryLocationController)
);
router.get("/getList",authMiddleware, deliveryLocationController.getList.bind(deliveryLocationController));
router.get(
  "/order/:order_id",authMiddleware,
  deliveryLocationController.getLatestByOrder.bind(deliveryLocationController)
);

router.get(
  "/partner/:delivery_partner_id",authMiddleware,
  deliveryLocationController.getLatestByDeliveryPartner.bind(
    deliveryLocationController
  )
);

export default router;
