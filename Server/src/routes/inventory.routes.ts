import { Router } from "express";
import { InventoryController } from "../controllers/inventory.controller";
import { validate } from "../middleware/validate";
import { authMiddleware ,requireRole} from "../middleware/auth";
import { createInventorySchema, updateStockSchema } from "../validators/inventory.validators";

const router = Router();

router.post("/createInventory",authMiddleware,requireRole("Admin","SuperAdmin","SubAdmin","StoreAdmin","Employee"), validate(createInventorySchema), InventoryController.create);
router.get("/getList",authMiddleware, InventoryController.getList);
router.get("/getLowStock",authMiddleware, InventoryController.getLowStock);
router.get("/getById/:id",authMiddleware, InventoryController.getById);
router.delete("/deleteById/:id",authMiddleware,requireRole("Admin","SuperAdmin","SubAdmin","StoreAdmin","Employee"),InventoryController.delete);
router.get("/productByProductId/:product_id",authMiddleware, InventoryController.getByProduct);
router.patch(
  "/productByProductId/UpdateStock/:product_id",authMiddleware,requireRole("Admin","SuperAdmin","SubAdmin","StoreAdmin","Employee"),
  validate(updateStockSchema),
  InventoryController.updateStock
);

export default router;
