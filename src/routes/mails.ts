import express from "express";
import authMiddleware from "../middleware/auth";
import { requireRole } from "../middleware/authorize";
import { UserRole } from "../types/auth";
import { validateBody, validateParams } from "../middleware/validate";
import { createMailSchema } from "../validators/mails";
import {
  createMailHandler,
  sendMailHandler,
  inboxHandler,
} from "../controllers/mailsController";
import { wrapAsync } from "../middleware/asyncHandler";
import { idParamSchema } from "../validators/params";

const router = express.Router();

// Create a mail (admin/editor)
router.post(
  "/",
  authMiddleware,
  requireRole(UserRole.Admin, UserRole.Editor),
  validateBody(createMailSchema),
  wrapAsync(createMailHandler)
);

// Send a mail to the lodge members (admin/editor)
router.post(
  "/:id/send",
  authMiddleware,
  requireRole(UserRole.Admin, UserRole.Editor),
  validateParams(idParamSchema),
  wrapAsync(sendMailHandler)
);

// Get current user's inbox
router.get("/inbox", authMiddleware, wrapAsync(inboxHandler));

export default router;
