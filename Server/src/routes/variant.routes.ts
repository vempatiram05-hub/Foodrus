import { Router } from "express";
import { variantController } from "../controllers/variant.controller";
import { validate } from "../middleware/validate";
import { createVariantSchema, updateVariantSchema } from "../validators/variant.validators";

const router = Router();

router.post("/CreateVariants", validate(createVariantSchema), variantController.create);
router.get("/getList", variantController.getList.bind(variantController));
router.get("/GetVariantById/:id", variantController.getById);
router.put("/UpdateVariant/:id", validate(updateVariantSchema), variantController.update);
router.delete("/DeleteVariant/:id", variantController.delete);

export default router;
