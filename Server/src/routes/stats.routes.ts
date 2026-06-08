import { Router } from "express";
import { authMiddleware } from "../middleware/auth";
import { getStats } from "../controllers/stats.controller";

const statsRouter = Router();

statsRouter.get("/", authMiddleware, getStats);

export default statsRouter;
