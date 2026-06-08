import { Router } from "express";
import {
  getSummary,
  getRevenueByRegion,
  getMenuComplianceByStore,
  getMenuComplianceByRegion,
  getOrderTrends,
  getRevenueByCategory,
  getDeliveryDistribution,
} from "../controllers/analytics.controller";
import { authMiddleware, requirePermission } from "../middleware/auth";

const router = Router();

router.get("/summary",                   authMiddleware, requirePermission("Analytics", "view"), getSummary);
router.get("/revenue-by-region",         authMiddleware, requirePermission("Analytics", "view"), getRevenueByRegion);
router.get("/menu-compliance-by-store",  authMiddleware, requirePermission("Analytics", "view"), getMenuComplianceByStore);
router.get("/menu-compliance-by-region", authMiddleware, requirePermission("Analytics", "view"), getMenuComplianceByRegion);
router.get("/order-trends",              authMiddleware, requirePermission("Analytics", "view"), getOrderTrends);
router.get("/revenue-by-category",       authMiddleware, requirePermission("Analytics", "view"), getRevenueByCategory);
router.get("/delivery-distribution",     authMiddleware, requirePermission("Analytics", "view"), getDeliveryDistribution);

export default router;
