import { Router } from "express";
import { getStoreReport } from "../controllers/reports.controller";
import { authMiddleware, requirePermission } from "../middleware/auth";

const router = Router();

router.get("/stores", authMiddleware, requirePermission("Reports", "view"), getStoreReport);

export default router;
