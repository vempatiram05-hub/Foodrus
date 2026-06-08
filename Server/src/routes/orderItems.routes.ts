import { Router } from "express";
import { orderItemsController } from "../controllers/orderItems.controller";
import { validate } from "../middleware/validate";
import { authMiddleware } from "../middleware/auth";
import { createOrderItemSchema, updateOrderItemSchema } from "../validators/orderItems.validators";

const router = Router();

router.post("/create",authMiddleware, validate(createOrderItemSchema), orderItemsController.create.bind(orderItemsController));
router.get("/getById/:id",authMiddleware, orderItemsController.getById.bind(orderItemsController));
router.get("/getList",authMiddleware, orderItemsController.getList.bind(orderItemsController));
router.get("/getByOrder/:order_id",authMiddleware, orderItemsController.getByOrderId.bind(orderItemsController));
router.patch("/update/:id",authMiddleware, validate(updateOrderItemSchema), orderItemsController.update.bind(orderItemsController));
router.delete("/delete/:id",authMiddleware, orderItemsController.delete.bind(orderItemsController));

export default router;
