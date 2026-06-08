import express from "express";
import PaymentMethodController from "../controllers/paymentMethod.controller";
import { authMiddleware } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { createPaymentMethodSchema, updatePaymentMethodSchema } from "../validators/paymentMethod.validators";

const PaymentMethodRouter = express.Router();

PaymentMethodRouter.post("/createpaymentMethod", authMiddleware, validate(createPaymentMethodSchema), PaymentMethodController.create);
PaymentMethodRouter.get("/getList", authMiddleware, PaymentMethodController.getList);
PaymentMethodRouter.get("/getpaymentMethodById/:id", authMiddleware, PaymentMethodController.getById);
PaymentMethodRouter.get("/getpaymentMethodsByUserId/:userId", authMiddleware, PaymentMethodController.getByUser);
PaymentMethodRouter.put("/updatepaymentMethod/:id", authMiddleware, validate(updatePaymentMethodSchema), PaymentMethodController.update);
PaymentMethodRouter.delete("/deletepaymentMethod/:id", authMiddleware, PaymentMethodController.delete);

export default PaymentMethodRouter;
