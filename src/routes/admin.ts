import { Router } from "express";
import authMiddleware from "../middleware/auth";
import { requireRole } from "../middleware/authorize";
import adminController from "../controllers/adminController";
import { wrapAsync } from "../middleware/asyncHandler";

const router = Router();

// Protected endpoint for admins to trigger token cleanup on-demand.
router.post(
  "/cleanup-tokens",
  authMiddleware,
  requireRole("Admin"),
  wrapAsync(adminController.cleanupTokens)
);

// List available roles
router.get(
  "/roles",
  authMiddleware,
  requireRole("Admin"),
  wrapAsync(adminController.getRoles)
);

export default router;
