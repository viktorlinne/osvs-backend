import express from "express";
import authMiddleware from "../middleware/auth";
import { requireRole } from "../middleware/authorize";
import { UserRole } from "../types/auth";
import { validateBody } from "../middleware/validate";
import { createMailSchema } from "./schemas/mails";
import {
  createMailHandler,
  sendMailHandler,
  inboxHandler,
} from "../controllers/mailsController";

const router = express.Router();

// Create a mail (admin/editor)
router.post(
  "/",
  authMiddleware,
  requireRole(UserRole.Admin, UserRole.Editor),
  validateBody(createMailSchema),
  createMailHandler
);

// Send a mail to the lodge members (admin/editor)
router.post(
  "/:id/send",
  authMiddleware,
  requireRole(UserRole.Admin, UserRole.Editor),
  sendMailHandler
);

// Get current user's inbox
router.get("/inbox", authMiddleware, inboxHandler);

export default router;
