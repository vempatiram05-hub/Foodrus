import { Router } from "express";
import { productChangeLogsController } from "../controllers/productChangeLogs.controller";
import { validate } from "../middleware/validate";
import { authMiddleware } from "../middleware/auth";
import { createProductChangeLogSchema } from "../validators/productChangeLogs.validators";

const router = Router();

router.post("/createLog",authMiddleware, validate(createProductChangeLogSchema), productChangeLogsController.create.bind(productChangeLogsController));
router.get("/productByProductId/:product_id",authMiddleware, productChangeLogsController.getByProduct.bind(productChangeLogsController));
router.get("/userByUserId/:user_id",authMiddleware, productChangeLogsController.getByUser.bind(productChangeLogsController));
router.get("/recent",authMiddleware, productChangeLogsController.getRecent.bind(productChangeLogsController));

export default router;
