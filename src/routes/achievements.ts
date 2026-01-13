import express from "express";
import { listAchievementsHandler } from "../controllers/achievementsController";

const router = express.Router();

// Public list of achievement types
/**
 * @openapi
 * /achievements:
 *   get:
 *     tags:
 *       - Achievements
 *     summary: List achievement types
 *     responses:
 *       200:
 *         description: Array of achievement types
 */
router.get("/", listAchievementsHandler);

export default router;
