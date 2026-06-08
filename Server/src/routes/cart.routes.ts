import { Router } from "express";
import { cartController } from "../controllers/cart.controller";
import { validate } from "../middleware/validate";
import { createCartSchema } from "../validators/cart.validators";
import { authMiddleware } from "../middleware/auth";

const router = Router();

router.post("/CreateCart", authMiddleware, validate(createCartSchema), cartController.create);
// GET LIST (SEARCH + PAGINATION)
router.get("/getList", authMiddleware, cartController.getList.bind(cartController));
router.get("/:id", authMiddleware, cartController.findById);

router.get("/", authMiddleware, cartController.findByUserAndStore);
// ?user_id=xxx&store_id=yyy
router.delete("/delete/:id", authMiddleware, cartController.delete);

export default router;
