import { Router } from "express";
import { PartyController } from "../controllers/party.controller";
import { authMiddleware, optionalAuthMiddlewares, requirePermission } from "../middleware/auth";

const router = Router();

// Public reads — optionally authenticated for role-based scoping
router.get("/getList", optionalAuthMiddlewares, PartyController.getList);
router.get("/getById/:id", PartyController.getById);

// Protected writes
router.post(
  "/createParty",
  authMiddleware,
  requirePermission("Party", "create"),
  PartyController.create
);

router.put(
  "/updateParty/:id",
  authMiddleware,
  requirePermission("Party", "edit"),
  PartyController.update
);

router.delete(
  "/deleteParty/:id",
  authMiddleware,
  requirePermission("Party", "delete"),
  PartyController.delete
);

router.put(
  "/submitParty/:id",
  authMiddleware,
  PartyController.submit
);

router.put(
  "/approveParty/:id",
  authMiddleware,
  requirePermission("Party", "approve"),
  PartyController.approve
);

router.put(
  "/rejectParty/:id",
  authMiddleware,
  requirePermission("Party", "approve"),
  PartyController.reject
);

router.patch(
  "/toggleItemAvailability/:id",
  authMiddleware,
  PartyController.toggleItemAvailability
);

export default router;
