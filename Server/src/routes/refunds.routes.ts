import { Router } from "express";
import { refundController } from "../controllers/refunds.controller";
import { validate } from "../middleware/validate";
import { createRefundSchema, updateRefundStatusSchema } from "../validators/refunds.validators";
import { authMiddleware, requireRole } from "../middleware/auth";

const refundRouter = Router();

refundRouter.post("/Create", authMiddleware, validate(createRefundSchema), refundController.create);
refundRouter.get("/getList", authMiddleware, refundController.getList);
refundRouter.get("/getById/:id", authMiddleware, refundController.getById);
refundRouter.patch("/status/:id", authMiddleware, validate(updateRefundStatusSchema), refundController.updateStatus);
refundRouter.patch("/failed/:id", authMiddleware, refundController.markRefundFailed);
refundRouter.patch("/success/:id", authMiddleware, refundController.markRefundSuccess);
refundRouter.delete("/delete/:id", authMiddleware, requireRole("Admin", "SuperAdmin"), refundController.delete);

export default refundRouter;
