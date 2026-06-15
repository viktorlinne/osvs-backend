import express from "express";
import authMiddleware from "../middleware/auth";
import {
  getMediaHandler,
  getMediaPlaceholderHandler,
} from "../controllers/mediaController";
import { wrapAsync } from "../middleware/asyncHandler";

const router = express.Router();

router.get("/placeholders/:type", getMediaPlaceholderHandler);
router.get("/:id", authMiddleware, wrapAsync(getMediaHandler));

export default router;
