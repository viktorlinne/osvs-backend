import express from "express";
import authMiddleware from "../middleware/auth";
import { requireRole } from "../middleware/authorize";

// validators removed; controllers will validate request bodies/params
import {
  createMailHandler,
  sendMailHandler,
  inboxHandler,
} from "../controllers/mailsController";
import { wrapAsync } from "../middleware/asyncHandler";

const router = express.Router();

// Create a mail (admin/editor)
router.post(
  "/",
  authMiddleware,
  requireRole("Admin", "Editor"),
  wrapAsync(createMailHandler)
);

// Send a mail to the lodge members (admin/editor)
router.post(
  "/:id/send",
  authMiddleware,
  requireRole("Admin", "Editor"),
  wrapAsync(sendMailHandler)
);

// Get current user's inbox
router.get("/inbox", authMiddleware, wrapAsync(inboxHandler));

export default router;
