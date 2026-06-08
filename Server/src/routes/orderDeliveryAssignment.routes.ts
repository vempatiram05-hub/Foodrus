import { Router } from "express";
import { orderDeliveryAssignmentController } from "../controllers/orderDeliveryAssignment.controller";
import { validate } from "../middleware/validate";
import { authMiddleware } from "../middleware/auth";
import { assignDeliverySchema } from "../validators/orderDeliveryAssignment.validators";

  const router = Router();

router.post(
  "/assign",authMiddleware,
  validate(assignDeliverySchema),
  orderDeliveryAssignmentController.assign.bind(orderDeliveryAssignmentController)
);
router.get("/getList",authMiddleware, orderDeliveryAssignmentController.getList.bind(orderDeliveryAssignmentController));
router.patch(
  "/picked/:id",authMiddleware,
  orderDeliveryAssignmentController.markPicked.bind(orderDeliveryAssignmentController)
);

router.patch(
  "/delivered/:id",authMiddleware,
  orderDeliveryAssignmentController.markDelivered.bind(orderDeliveryAssignmentController)
);

router.get(
  "/order/:order_id",authMiddleware,
  orderDeliveryAssignmentController.getByOrder.bind(orderDeliveryAssignmentController)
);

router.get(
  "/partner/:delivery_partner_id",authMiddleware, 
  orderDeliveryAssignmentController.getByDeliveryPartner.bind(orderDeliveryAssignmentController)
);

export default router;
