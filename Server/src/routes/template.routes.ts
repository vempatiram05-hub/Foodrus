import { Router } from "express";
import { TemplateController } from "../controllers/template.controller";
import { validate } from "../middleware/validate";
import { authMiddleware, optionalAuthMiddlewares, requirePermission } from "../middleware/auth";
import { createTemplateSchema, updateTemplateSchema } from "../validators/template.validators";

const router = Router();

// Public reads — optionally authenticated so SubAdmin scoping is applied via token
router.get("/getList", optionalAuthMiddlewares, TemplateController.getList);
router.get("/getTemplateById/:id", TemplateController.getById);

// Protected writes
router.post(
  "/CreateTemplate",
  authMiddleware,
  requirePermission("Templates", "create"),
  validate(createTemplateSchema),
  TemplateController.create
);

router.put(
  "/UpdateTemplate/:id",
  authMiddleware,
  requirePermission("Templates", "edit"),
  validate(updateTemplateSchema),
  TemplateController.update
);

router.delete(
  "/deleteTemplate/:id",
  authMiddleware,
  requirePermission("Templates", "delete"),
  TemplateController.delete
);

export default router;
