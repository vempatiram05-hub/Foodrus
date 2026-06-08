import express from "express";
import PaymentController from "../controllers/payment.controller";
import { authMiddleware, requirePermission } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { createPaymentSchema, updatePaymentSchema } from "../validators/payment.validators";

const PaymentRouter = express.Router();

PaymentRouter.post("/createPayment", authMiddleware, requirePermission('Payments', 'create'), validate(createPaymentSchema), PaymentController.create);
PaymentRouter.get("/getList", authMiddleware, requirePermission('Payments', 'view'), PaymentController.getList);
PaymentRouter.get(
  "/getPaymentById/:id",
  authMiddleware,
  requirePermission('Payments', 'view'),
  PaymentController.getById
);
PaymentRouter.put(
  "/updatePayment/:id",
  authMiddleware,
  requirePermission('Payments', 'edit'),
  validate(updatePaymentSchema),
  PaymentController.update
);
PaymentRouter.delete(
  "/deletePayment/:id",
  authMiddleware,
  requirePermission('Payments', 'delete'),
  PaymentController.delete
);


PaymentRouter.post("/helcim-session", authMiddleware, PaymentController.helcimSession);
PaymentRouter.post("/tokenize-card", authMiddleware, PaymentController.tokenizeCard);
PaymentRouter.get("/getPaymentsByOrder/:orderId", authMiddleware, requirePermission('Payments', 'view'), PaymentController.getByOrder);
// PaymentRouter.post("/helcimPayment", PaymentController.helcimPayment);
export default PaymentRouter;
