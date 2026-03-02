import { Router } from "express";
import authMiddleware from "../middleware/auth";
import { requireRole } from "../middleware/authorize";
import adminController from "../controllers/adminController";
import { wrapAsync } from "../middleware/asyncHandler";

const router = Router();

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
