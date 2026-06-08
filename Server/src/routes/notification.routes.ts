import { Router } from "express";
import { notificationController } from "../controllers/notification.controller";
import { validate } from "../middleware/validate";
import { authMiddleware } from "../middleware/auth";
import { createNotificationSchema } from "../validators/notification.validators";

const router = Router();

router.post("/Create", authMiddleware, validate(createNotificationSchema), notificationController.create);
router.get("/getList", authMiddleware, notificationController.getList);
router.get("/pending", authMiddleware, notificationController.getPending);
router.get("/user/:user_id", authMiddleware, notificationController.getByUser);
router.get("/:id", authMiddleware, notificationController.getById);
router.patch("/sent/:id", authMiddleware, notificationController.markSent);
router.patch("/read/:id", authMiddleware, notificationController.markRead);
router.patch("/failed/:id", authMiddleware, notificationController.markFailed);
router.delete("/delete/:id", authMiddleware, notificationController.delete);

export default router;
