import express from "express";
import { orderController } from "../controllers/order.controller";
import { authMiddleware, requireRole, requirePermission } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { createOrderSchema, updateOrderSchema } from "../validators/order.validators";

const OrderRouter = express.Router();

OrderRouter.post("/createOrder", authMiddleware, requirePermission('Orders', 'create'), validate(createOrderSchema), orderController.create);
OrderRouter.get("/getList", authMiddleware, requirePermission('Orders', 'view'), orderController.getList.bind(orderController));
OrderRouter.get("/getOrderById/:id", authMiddleware, requirePermission('Orders', 'view'), orderController.getById);
OrderRouter.put("/updateOrder/:id", authMiddleware, requirePermission('Orders', 'edit'), validate(updateOrderSchema), orderController.update);
OrderRouter.delete("/deleteOrder/:id", authMiddleware, requireRole("Admin", "SuperAdmin", "SubAdmin"), requirePermission('Orders', 'delete'), orderController.delete);
OrderRouter.get("/getOrdersByUserId/:userId", authMiddleware, requirePermission('Orders', 'view'), orderController.getOrdersByUserId);
OrderRouter.put("/ApproveOrderById/approve/:id", authMiddleware, requireRole("Admin", "SuperAdmin", "SubAdmin", "StoreAdmin", "Employee"), requirePermission('Orders', 'approve'), orderController.approve);
OrderRouter.put("/RejectOrderById/reject/:id", authMiddleware, requireRole("Admin", "SuperAdmin", "SubAdmin", "StoreAdmin", "Employee"), requirePermission('Orders', 'approve'), orderController.reject);
OrderRouter.get("/invoice/:id", authMiddleware, requireRole("Admin", "SuperAdmin", "SubAdmin", "StoreAdmin", "Employee"), requirePermission('Orders', 'view'), orderController.downloadInvoice);

export default OrderRouter;
