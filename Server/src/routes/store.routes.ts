import { Router } from "express";
import { StoreController } from "../controllers/store.controller";
import { authMiddleware, requireRole, requirePermission, optionalAuthMiddlewares } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { createStoreSchema, updateStoreSchema } from "../validators/store.validators";

const StoreRouter = Router();

StoreRouter.post("/createStore", authMiddleware, requireRole("Admin", "SuperAdmin"), requirePermission('Store', 'create'), validate(createStoreSchema), StoreController.create);

StoreRouter.get("/getList", optionalAuthMiddlewares, StoreController.getList);
StoreRouter.get("/getStoreById/:id", authMiddleware, requirePermission('Store', 'view'), StoreController.getById);
StoreRouter.put("/updateStore/:id", authMiddleware, requireRole("Admin", "SuperAdmin"), requirePermission('Store', 'edit'), validate(updateStoreSchema), StoreController.update);
StoreRouter.delete("/deleteStore/:id", authMiddleware, requireRole("Admin", "SuperAdmin"), requirePermission('Store', 'delete'), StoreController.remove);
StoreRouter.get("/getStoresByRegion/:regionId", StoreController.getByRegion);
StoreRouter.get("/nearestByCoords", StoreController.getNearestByCoords);
StoreRouter.get("/getStoresByStoreAdminId/:adminId", authMiddleware, requirePermission('Store', 'view'), StoreController.getByAdmin);

export default StoreRouter;
