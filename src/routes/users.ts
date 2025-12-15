import express from "express";
import usersController from "../controllers/usersController";
import { wrapAsync } from "../middleware/asyncHandler";
import { validateParams } from "../middleware/validate";
import { idParamSchema } from "../validators/params";
import authMiddleware from "../middleware/auth";
import { uploadProfilePicture } from "../utils/fileUpload";
import { validateBody } from "../middleware/validate";
import {
  addAchievementSchema,
  setRolesSchema,
  setLodgeSchema,
} from "../validators/users";
import { updateUserSchema } from "../validators/users";
import { requireRole } from "../middleware/authorize";
import { UserRole } from "../types/auth";

const router = express.Router();

// Minimal placeholder routes used in tests. Expand as needed.
router.get("/me", authMiddleware, wrapAsync(usersController.placeholderMe));

// Update current user's profile
router.put(
  "/me",
  authMiddleware,
  validateBody(updateUserSchema),
  wrapAsync(usersController.updateMeHandler)
);

// Update current user's profile picture
router.post(
  "/me/picture",
  authMiddleware,
  uploadProfilePicture,
  wrapAsync(usersController.updatePictureHandler)
);
// Admin: update another user's profile (partial)
router.put(
  "/:id",
  authMiddleware,
  requireRole(UserRole.Admin),
  validateBody(updateUserSchema),
  wrapAsync(usersController.updateUserHandler)
);

// Update another user's profile picture (editor/admin only)
router.post(
  "/:id/picture",
  authMiddleware,
  requireRole(UserRole.Editor, UserRole.Admin),
  uploadProfilePicture,
  wrapAsync(usersController.updateOtherPictureHandler)
);

// Award an achievement to a user (admin/editor only)
router.post(
  "/:id/achievements",
  authMiddleware,
  requireRole(UserRole.Admin, UserRole.Editor),
  validateBody(addAchievementSchema),
  wrapAsync(usersController.addAchievementHandler)
);

// Get a user's achievement history (admin/editor only)
router.get(
  "/:id/achievements",
  authMiddleware,
  requireRole(UserRole.Admin, UserRole.Editor),
  wrapAsync(usersController.getAchievementsHandler)
);

// Get a user's roles (admin only)
router.get(
  "/:id/roles",
  authMiddleware,
  requireRole(UserRole.Admin),
  wrapAsync(usersController.getRolesHandler)
);

// Set roles for a user (admin only)
router.post(
  "/:id/roles",
  authMiddleware,
  requireRole(UserRole.Admin),
  validateBody(setRolesSchema),
  wrapAsync(usersController.setRolesHandler)
);

// Get a user's lodge (admin only)
router.get(
  "/:id/lodges",
  authMiddleware,
  requireRole(UserRole.Admin),
  wrapAsync(usersController.getLodgeHandler)
);

// Set (replace) a user's lodge (admin only). Send `{ "lodgeId": <id> }` or `{ "lodgeId": null }` to remove.
router.post(
  "/:id/lodges",
  authMiddleware,
  requireRole(UserRole.Admin),
  validateBody(setLodgeSchema),
  wrapAsync(usersController.setLodgeHandler)
);

export default router;
