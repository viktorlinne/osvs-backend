import express from "express";
import { listAchievementsHandler } from "../controllers/achievementsController";

const router = express.Router();

// Public list of achievement types
router.get("/", listAchievementsHandler);

export default router;
