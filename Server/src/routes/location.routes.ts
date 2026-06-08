// src/routes/location.routes.ts
import { Router } from "express";
import { LocationController } from "../controllers/location.controller";
import { validate } from "../middleware/validate";
import {authMiddleware} from "../middleware/auth"
import { createLocationSchema, updateLocationSchema } from "../validators/location.validators";

const router = Router();

router.get("/state/by-country", LocationController.getStatesByCountry);
router.get("/city/by-state", LocationController.getCitiesByState);
router.get("/:table/getList", LocationController.getList);
router.get("/:table/:id", LocationController.getById);
router.post("/create", authMiddleware, validate(createLocationSchema), LocationController.create);
router.put("/:table/:id", authMiddleware, validate(updateLocationSchema), LocationController.update);
router.delete("/:table/:id", authMiddleware, LocationController.delete);

export default router;
