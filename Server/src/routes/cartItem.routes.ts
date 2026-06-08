import { Router } from "express";
import { cartItemController } from "../controllers/cartItem.controller";
import { validate } from "../middleware/validate";
import { addCartItemSchema, updateCartItemSchema } from "../validators/cartItem.validators";
import { authMiddleware } from "../middleware/auth";

const router = Router();

router.post("/AddCartItem", authMiddleware, validate(addCartItemSchema), cartItemController.addItem);
router.get("/getByCart/:cart_id", authMiddleware, cartItemController.getByCart);
// GET LIST (SEARCH + PAGINATION)
router.get("/getList", authMiddleware, cartItemController.getList.bind(cartItemController));
router.get("/GetCartItemById/:id", authMiddleware, cartItemController.getById);
router.put("/UpdateQuantity/:id", authMiddleware, validate(updateCartItemSchema), cartItemController.updateQuantity);
router.delete("/Remove/:id", authMiddleware, cartItemController.deleteById);
router.delete("/Clear/:cart_id", authMiddleware, cartItemController.clearCart);
export default router;
