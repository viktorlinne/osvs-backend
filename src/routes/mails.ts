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
/**
 * @openapi
 * /mails:
 *   post:
 *     tags:
 *       - Mails
 *     summary: Create a mail (Admin/Editor)
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       201:
 *         description: Mail created
 */
router.post(
  "/",
  authMiddleware,
  requireRole("Admin", "Editor"),
  wrapAsync(createMailHandler)
);

// Send a mail to the lodge members (admin/editor)
/**
 * @openapi
 * /mails/{id}/send:
 *   post:
 *     tags:
 *       - Mails
 *     summary: Send a mail to lodge members
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Mail sent
 */
router.post(
  "/:id/send",
  authMiddleware,
  requireRole("Admin", "Editor"),
  wrapAsync(sendMailHandler)
);

// Get current user's inbox
/**
 * @openapi
 * /mails/inbox:
 *   get:
 *     tags:
 *       - Mails
 *     summary: Get current user's inbox
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Array of inbox messages
 */
router.get("/inbox", authMiddleware, wrapAsync(inboxHandler));

export default router;
