import express from "express";
import { listAchievementsHandler } from "../controllers/achievementsController";

const router = express.Router();

router.get("/", listAchievementsHandler);

export default router;
