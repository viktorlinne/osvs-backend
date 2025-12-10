import express from "express";
import usersController from "../controllers/usersController";
import authMiddleware from "../middleware/auth";
import { uploadProfilePicture } from "../utils/fileUpload";
import { requireRole } from "../middleware/authorize";
import { UserRole } from "../types/auth";

const router = express.Router();

// Minimal placeholder routes used in tests. Expand as needed.
router.get("/me", authMiddleware, usersController.placeholderMe);

// Update current user's profile picture
router.post(
  "/me/picture",
  authMiddleware,
  uploadProfilePicture,
  usersController.updatePictureHandler
);

// Update another user's profile picture (editor/admin only)
router.post(
  "/:id/picture",
  authMiddleware,
  requireRole(UserRole.Editor, UserRole.Admin),
  uploadProfilePicture,
  usersController.updateOtherPictureHandler
);

// Award an achievement to a user (admin/editor only)
router.post(
  "/:id/achievements",
  authMiddleware,
  requireRole(UserRole.Admin, UserRole.Editor),
  usersController.addAchievementHandler
);

// Get a user's achievement history (admin/editor only)
router.get(
  "/:id/achievements",
  authMiddleware,
  requireRole(UserRole.Admin, UserRole.Editor),
  usersController.getAchievementsHandler
);

// Get a user's roles (admin only)
router.get(
  "/:id/roles",
  authMiddleware,
  requireRole(UserRole.Admin),
  usersController.getRolesHandler
);

// Set roles for a user (admin only)
router.post(
  "/:id/roles",
  authMiddleware,
  requireRole(UserRole.Admin),
  usersController.setRolesHandler
);

export default router;
