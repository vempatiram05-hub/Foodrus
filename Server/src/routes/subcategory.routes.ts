import { Router } from "express";
import { SubcategoryController } from "../controllers/subcategory.controller";
import { memoryUploader } from "../middleware/upload";
import { validate } from "../middleware/validate";
import { authMiddleware, optionalAuthMiddlewares, requirePermission, requireRole } from "../middleware/auth";
import { createSubcategorySchema, updateSubcategorySchema } from "../validators/subcategory.validators";

const router = Router();
const controller = new SubcategoryController();

router.post(
  "/createSubcategory",
  authMiddleware,
  requireRole("Admin", "SuperAdmin"),
  requirePermission("Subcategories", "create"),
  memoryUploader.array("images", 5),
  validate(createSubcategorySchema),
  controller.create.bind(controller)
);
router.put(
  "/updateSubcategory/:id",
  authMiddleware,
  requireRole("Admin", "SuperAdmin"),
  requirePermission("Subcategories", "edit"),
  memoryUploader.array("images", 5),
  validate(updateSubcategorySchema),
  controller.update.bind(controller)
);
router.get(
  "/getList",
  optionalAuthMiddlewares,
  controller.getList.bind(controller)
);

router.get(
  "/getSubcategoryById/:id",
  controller.getById.bind(controller)
);

router.get(
  "/getSubcategoryByCategoryId/:category_id",
  optionalAuthMiddlewares,
  controller.getByCategoryId.bind(controller)
);
router.delete(
  "/deleteSubcategory/:id",
  authMiddleware,
  requireRole("Admin", "SuperAdmin"),
  requirePermission("Subcategories", "delete"),
  controller.delete.bind(controller)
);

export default router;
