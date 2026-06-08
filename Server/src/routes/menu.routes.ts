import { Router, Request, Response, NextFunction } from "express";
import { authMiddleware, requireRole, optionalAuthMiddlewares, requirePermission } from "../middleware/auth";
import { MenuController } from "../controllers/menu.controller";
import { validate } from "../middleware/validate";
import { createMenuSchema, updateMenuSchema, addPendingProductsSchema } from "../validators/menu.validators";

const menuRouter = Router();

const checkMenuAccess = (req: Request, res: Response, next: NextFunction) => {
    const user = req.user as any;
    if (!user || user.role_name === "Customer") {
        return next();
    }
    return requirePermission("Menus", "view")(req, res, next);
};

menuRouter.post("/CreateMenus", authMiddleware, requireRole("Admin", "SuperAdmin", "SubAdmin", "StoreAdmin", "Employee"), requirePermission('Menus', 'create'), validate(createMenuSchema), MenuController.create);
menuRouter.get("/getList", optionalAuthMiddlewares, checkMenuAccess, MenuController.getList);
menuRouter.get("/GetMenuById/:id", optionalAuthMiddlewares, checkMenuAccess, MenuController.getMenuById);
menuRouter.put("/UpdateMenu/:id", authMiddleware, requireRole("Admin", "SuperAdmin", "SubAdmin", "StoreAdmin", "Employee"), requirePermission('Menus', 'edit'), validate(updateMenuSchema), MenuController.update);
menuRouter.patch("/UpdateMenuStatus/:id", authMiddleware, requireRole("Admin", "SuperAdmin", "SubAdmin", "StoreAdmin", "Employee"), requirePermission('Menus', 'edit'), MenuController.updateStatus);
menuRouter.delete("/DeleteMenu/:id", authMiddleware, requireRole("Admin", "SuperAdmin", "SubAdmin", "StoreAdmin", "Employee"), requirePermission('Menus', 'delete'), MenuController.delete);
menuRouter.put("/ApproveMenuById/approve/:id", authMiddleware, requireRole("Admin", "SuperAdmin", "SubAdmin"), requirePermission('Menus', 'approve'), MenuController.approveMenu);
menuRouter.put("/RejectMenuById/reject/:id", authMiddleware, requireRole("Admin", "SuperAdmin", "SubAdmin"), requirePermission('Menus', 'approve'), MenuController.rejectMenu);

menuRouter.patch("/ToggleItemAvailability/:id", authMiddleware, requireRole("StoreAdmin", "Employee"), requirePermission('Menus', 'edit'), MenuController.toggleItemAvailability);

menuRouter.post("/AddPendingProducts/:id", authMiddleware, requireRole("Admin", "SuperAdmin", "SubAdmin", "StoreAdmin", "Employee"), requirePermission('Menus', 'edit'), validate(addPendingProductsSchema), MenuController.addPendingProducts);
menuRouter.put("/RejectPendingProducts/:id", authMiddleware, requireRole("Admin", "SuperAdmin", "SubAdmin"), requirePermission('Menus', 'approve'), MenuController.rejectPendingProducts);

export default menuRouter;
