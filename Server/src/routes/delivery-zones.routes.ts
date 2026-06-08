import { Router } from "express";
import { DeliveryZoneController } from "../controllers/delivery-zones.controller";
import { validate } from "../middleware/validate";
import { authMiddleware } from "../middleware/auth";
import { createDeliveryZoneSchema, updateDeliveryZoneSchema } from "../validators/deliveryZones.validators";

const router = Router();

router.post("/",authMiddleware, validate(createDeliveryZoneSchema), DeliveryZoneController.create);
router.get("/getList",authMiddleware, DeliveryZoneController.getList);
router.get("/store/:store_id",authMiddleware, DeliveryZoneController.getByStore);
router.get("/:id",authMiddleware, DeliveryZoneController.getById);
router.patch("/update/:id",authMiddleware, validate(updateDeliveryZoneSchema), DeliveryZoneController.update);
router.delete("/delete/:id",authMiddleware, DeliveryZoneController.delete);

export default router;
