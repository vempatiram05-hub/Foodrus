import { Router } from "express";
import NotificationChannelController from "../controllers/notificationChannel.controller";
import { validate } from "../middleware/validate";
import { authMiddleware } from "../middleware/auth";
import { createNotificationChannelSchema, updateNotificationChannelSchema } from "../validators/notificationChannel.validators";

const NotificationChannelRouter = Router();

NotificationChannelRouter.post("/create",authMiddleware, validate(createNotificationChannelSchema), NotificationChannelController.create);
NotificationChannelRouter.get("/getList",authMiddleware, NotificationChannelController.getList);
NotificationChannelRouter.get("/getbyid/:id",authMiddleware, NotificationChannelController.getById);
NotificationChannelRouter.patch("/update/:id",authMiddleware, validate(updateNotificationChannelSchema), NotificationChannelController.update);
NotificationChannelRouter.delete("/delete/:id",authMiddleware, NotificationChannelController.delete);

export default NotificationChannelRouter;
