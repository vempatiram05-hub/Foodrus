import { Router } from "express";
import { auditLogController } from "../controllers/auditLog.controller";
import { validate } from "../middleware/validate";
import { createAuditLogSchema, updateAuditLogSchema } from "../validators/auditLog.validators";
import { authMiddleware, requireRole } from "../middleware/auth";

const router = Router();

// RESTful and clear audit log routes
router.post("/create", authMiddleware, requireRole("Admin", "SuperAdmin", "SubAdmin"), validate(createAuditLogSchema), auditLogController.create);
router.get("/getList", authMiddleware, auditLogController.getList.bind(auditLogController));
router.get("/entity/:entity_type/:entity_id", authMiddleware, auditLogController.getByEntity);
router.get("/user/:user_id", authMiddleware, auditLogController.getByUser);
router.get("/getById/:id", authMiddleware, auditLogController.getById);
router.put("/update/:id", authMiddleware, requireRole("Admin", "SuperAdmin", "SubAdmin"), validate(updateAuditLogSchema), auditLogController.update);
router.delete("/delete/:id", authMiddleware, requireRole("Admin", "SuperAdmin", "SubAdmin"), auditLogController.delete);

export default router;
