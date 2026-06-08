import { Router } from "express";
import { orderStatusHistoryController } from "../controllers/orderStatusHistory.controller";
import { validate } from "../middleware/validate";
import { authMiddleware } from "../middleware/auth";
import { createOrderStatusHistorySchema } from "../validators/orderStatusHistory.validators";

const router = Router();

router.post("/Create",authMiddleware, validate(createOrderStatusHistorySchema), orderStatusHistoryController.create.bind(orderStatusHistoryController));
router.get("/getList",authMiddleware, orderStatusHistoryController.getList.bind(orderStatusHistoryController));
router.get("/getById/:id",authMiddleware, orderStatusHistoryController.getById.bind(orderStatusHistoryController));
router.get("/order/:order_id",authMiddleware, orderStatusHistoryController.getByOrderId.bind(orderStatusHistoryController));
router.delete("/:id",authMiddleware, orderStatusHistoryController.delete.bind(orderStatusHistoryController));

export default router;
