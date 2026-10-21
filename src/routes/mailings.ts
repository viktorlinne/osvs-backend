import express from "express";
import authMiddleware from "../middleware/auth";
import { requireRole } from "../middleware/authorize";
import { wrapAsync } from "../middleware/asyncHandler";
import { getMailingHandler } from "../controllers/mailingsController";

const router = express.Router();

router.get(
  "/:id",
  authMiddleware,
  requireRole("Admin", "Editor"),
  wrapAsync(getMailingHandler),
);

export default router;
