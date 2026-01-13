import { Router } from "express";
import authMiddleware from "../middleware/auth";
import { requireRole } from "../middleware/authorize";
import adminController from "../controllers/adminController";
import { wrapAsync } from "../middleware/asyncHandler";

const router = Router();

// Protected endpoint for admins to trigger token cleanup on-demand.
/**
 * @openapi
 * /admin/cleanup-tokens:
 *   post:
 *     tags:
 *       - Admin
 *     summary: Trigger token cleanup (Admin only)
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Cleanup started
 */
router.post(
  "/cleanup-tokens",
  authMiddleware,
  requireRole("Admin"),
  wrapAsync(adminController.cleanupTokens)
);

// List available roles
/**
 * @openapi
 * /admin/roles:
 *   get:
 *     tags:
 *       - Admin
 *     summary: List available roles (Admin only)
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Array of roles
 */
router.get(
  "/roles",
  authMiddleware,
  requireRole("Admin"),
  wrapAsync(adminController.getRoles)
);

export default router;
