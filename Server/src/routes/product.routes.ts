import { Router, Request, Response, NextFunction } from "express";
import { ProductController } from "../controllers/product.controller";
import { memoryUploader } from "../middleware/upload";
import { authMiddleware, requireRole, optionalAuthMiddlewares, requirePermission } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { createProductSchema, updateProductSchema } from "../validators/product.validators";

const productrouter = Router();

const checkProductViewAccess = (req: Request, res: Response, next: NextFunction) => {
  const user = req.user as any;
  if (!user || user.role_name === "Customer") {
    return next();
  }
  return requirePermission("Products", "view")(req, res, next);
};

productrouter.get("/getList", optionalAuthMiddlewares, checkProductViewAccess, ProductController.getList);
productrouter.get("/GetProductById/:id", optionalAuthMiddlewares, checkProductViewAccess, ProductController.getOne);



productrouter.post("/CreateProduct", authMiddleware, requireRole("StoreAdmin", "Employee"), requirePermission('Products', 'create'), memoryUploader.array("images", 10), validate(createProductSchema), ProductController.create);

productrouter.put("/UpdateProductById/:id", authMiddleware, requireRole("StoreAdmin", "Employee"), requirePermission('Products', 'edit'), memoryUploader.array("images", 10), validate(updateProductSchema), ProductController.update);

productrouter.delete("/DeleteProduct/:id", authMiddleware, requireRole("StoreAdmin", "Employee"), requirePermission('Products', 'delete'), ProductController.delete);




productrouter.put("/ApproveProductById/approve/:id", authMiddleware, requireRole("SubAdmin"), requirePermission('Products', 'approve'), ProductController.approve);

productrouter.put("/RejectProductById/reject/:id", authMiddleware, requireRole("SubAdmin"), requirePermission('Products', 'approve'), ProductController.reject);

export default productrouter;
