import { Router } from "express";
import { RegionController } from "../controllers/region.controller";
import { authMiddleware } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { createRegionSchema, updateRegionSchema } from "../validators/region.validators";

const Regionrouter = Router();

Regionrouter.post("/createRegion", authMiddleware, validate(createRegionSchema), RegionController.create);
Regionrouter.get("/getList", RegionController.getList);
Regionrouter.get(
  "/getRegionById/:id",
  authMiddleware,
  RegionController.getById
);
Regionrouter.put("/updateRegion/:id", authMiddleware, validate(updateRegionSchema), RegionController.update);
Regionrouter.delete(
  "/deleteRegion/:id",
  authMiddleware,
  RegionController.delete
);

export default Regionrouter;
