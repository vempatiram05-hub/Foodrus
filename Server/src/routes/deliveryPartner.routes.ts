import { Router } from "express";
import { DeliveryPartnerController } from "../controllers/deliveryPartner.controller";
import { validate } from "../middleware/validate";
import { authMiddleware } from "../middleware/auth"
import { createDeliveryPartnerSchema, updateDeliveryPartnerSchema } from "../validators/deliveryPartner.validators";

const router = Router();

router.post("/Create", authMiddleware, validate(createDeliveryPartnerSchema), DeliveryPartnerController.create);
router.get("/getList", authMiddleware, DeliveryPartnerController.getList);
router.get("/GetById/:id", authMiddleware, DeliveryPartnerController.getById);
router.patch("/update/:id", authMiddleware, validate(updateDeliveryPartnerSchema), DeliveryPartnerController.update);
router.delete("/delete/:id", authMiddleware, DeliveryPartnerController.delete);

export default router;
