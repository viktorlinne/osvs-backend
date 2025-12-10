import { Router } from "express";
import authMiddleware from "../middleware/auth";
import { requireRole } from "../middleware/authorize";
import { UserRole } from "../types/auth";
import adminController from "../controllers/adminController";

const router = Router();

// Protected endpoint for admins to trigger token cleanup on-demand.
router.post(
  "/cleanup-tokens",
  authMiddleware,
  requireRole(UserRole.Admin),
  adminController.cleanupTokens
);

export default router;
