import express from "express";
import {
  getMediaHandler,
  getMediaPlaceholderHandler,
} from "../controllers/mediaController";
import { wrapAsync } from "../middleware/asyncHandler";

const router = express.Router();

router.get("/placeholders/:type", getMediaPlaceholderHandler);
router.get("/:id", wrapAsync(getMediaHandler));

export default router;
