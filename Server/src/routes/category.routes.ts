import { Router } from "express";
import { CategoryController } from "../controllers/category.controller";
import { memoryUploader } from "../middleware/upload";
import { validate } from "../middleware/validate";
import { authMiddleware, optionalAuthMiddlewares, requirePermission, requireRole } from "../middleware/auth";
import { createCategorySchema, updateCategorySchema } from "../validators/category.validators";

const router = Router();

// Public reads — optionally authenticated so SubAdmin scoping is applied via token
router.get("/getList", optionalAuthMiddlewares, CategoryController.getList);
router.get("/getCategoryById/:id", CategoryController.getById);

// Protected writes
router.post(
  "/CreateCategory",
  authMiddleware,
  requireRole("Admin", "SuperAdmin"),
  requirePermission("Categories", "create"),
  memoryUploader.array("images", 5),
  validate(createCategorySchema),
  CategoryController.create
);

router.put(
  "/UpdateCategory/:id",
  authMiddleware,
  requireRole("Admin", "SuperAdmin"),
  requirePermission("Categories", "edit"),
  memoryUploader.array("images", 5),
  validate(updateCategorySchema),
  CategoryController.update
);

router.delete(
  "/deleteCategory/:id",
  authMiddleware,
  requireRole("Admin", "SuperAdmin"),
  requirePermission("Categories", "delete"),
  CategoryController.delete
);

export default router;
