import { Router } from "express";
import { brandController } from "../controllers/brands.controller";
import { validate } from "../middleware/validate";
import { authMiddleware, requirePermission } from "../middleware/auth";
import { createBrandSchema, updateBrandSchema } from "../validators/brands.validators";

const router = Router();

router.post(
  "/CreateBrand",
  authMiddleware,
  requirePermission("Brands", "create"),
  validate(createBrandSchema),
  brandController.create.bind(brandController)
);
router.get("/getList", brandController.getList.bind(brandController));
router.get("/GetBrandById/:id", brandController.getOne.bind(brandController));
router.put(
  "/UpdateBrand/:id",
  authMiddleware,
  requirePermission("Brands", "edit"),
  validate(updateBrandSchema),
  brandController.update.bind(brandController)
);
router.delete(
  "/DeleteBrand/:id",
  authMiddleware,
  requirePermission("Brands", "delete"),
  brandController.delete.bind(brandController)
);

export default router;
