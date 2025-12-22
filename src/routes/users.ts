import express from "express";
import usersController from "../controllers/usersController";
import { wrapAsync } from "../middleware/asyncHandler";
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
import { UserRole } from "@osvs/types";

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

// List public users (authenticated)
router.get("/", authMiddleware, wrapAsync(usersController.listUsersHandler));

router.get(
  "/:id",
  authMiddleware,
  wrapAsync(usersController.getPublicUserHandler)
);

// Update another user's profile
router.put(
  "/:id",
  authMiddleware,
  requireRole("Admin", "Editor"),
  validateBody(updateUserSchema),
  wrapAsync(usersController.updateUserHandler)
);

// Update another user's profile picture
router.post(
  "/:id/picture",
  authMiddleware,
  requireRole("Editor", "Admin"),
  uploadProfilePicture,
  wrapAsync(usersController.updateOtherPictureHandler)
);

// Award an achievement to a user
router.post(
  "/:id/achievements",
  authMiddleware,
  requireRole("Admin", "Editor"),
  validateBody(addAchievementSchema),
  wrapAsync(usersController.addAchievementHandler)
);

// Get a user's achievement history
router.get(
  "/:id/achievements",
  authMiddleware,
  wrapAsync(usersController.getAchievementsHandler)
);

// Get a user's roles
router.get(
  "/:id/roles",
  authMiddleware,
  requireRole("Admin", "Editor"),
  wrapAsync(usersController.getRolesHandler)
);

// Set roles for a user (admin only)
router.post(
  "/:id/roles",
  authMiddleware,
  requireRole("Admin"),
  validateBody(setRolesSchema),
  wrapAsync(usersController.setRolesHandler)
);

// Get a user's lodge
router.get(
  "/:id/lodges",
  authMiddleware,
  wrapAsync(usersController.getLodgeHandler)
);

// Atomic post a user's lodge. Send `{ "lodgeId": <id> }` or `{ "lodgeId": null }` to remove.
router.post(
  "/:id/lodges",
  authMiddleware,
  requireRole("Admin", "Editor"),
  validateBody(setLodgeSchema),
  wrapAsync(usersController.setLodgeHandler)
);

export default router;
