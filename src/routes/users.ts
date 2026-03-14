import express from "express";
import usersController from "../controllers/usersController";
import { wrapAsync } from "../middleware/asyncHandler";
import authMiddleware from "../middleware/auth";
import { uploadProfilePicture } from "../utils/fileUpload";
// validators removed: runtime validation replaced by local DTOs/types
import { allowSelfOrRoles, requireRole } from "../middleware/authorize";

const router = express.Router();

router.get("/me", authMiddleware, wrapAsync(usersController.meHandler));

router.get(
  "/me/attended",
  authMiddleware,
  wrapAsync(usersController.getMyAttendedEventsHandler),
);

router.put("/me", authMiddleware, wrapAsync(usersController.updateMeHandler));

router.post(
  "/me/picture",
  authMiddleware,
  uploadProfilePicture,
  wrapAsync(usersController.updatePictureHandler)
);

router.get("/", authMiddleware, wrapAsync(usersController.listUsersHandler));
router.get("/map", authMiddleware, wrapAsync(usersController.listUsersMapHandler));

router.get(
  "/:matrikelnummer",
  authMiddleware,
  wrapAsync(usersController.getPublicUserHandler)
);

router.get(
  "/:matrikelnummer/attended",
  authMiddleware,
  wrapAsync(usersController.getUserAttendedEventsHandler),
);

// Update another user's profile
router.put(
  "/:matrikelnummer",
  authMiddleware,
  requireRole("Admin", "Editor"),
  wrapAsync(usersController.updateUserHandler)
);

router.put(
  "/:matrikelnummer/location",
  authMiddleware,
  allowSelfOrRoles("Admin", "Editor"),
  wrapAsync(usersController.setUserLocationHandler)
);

router.delete(
  "/:matrikelnummer/location-override",
  authMiddleware,
  allowSelfOrRoles("Admin", "Editor"),
  wrapAsync(usersController.clearUserLocationOverrideHandler)
);

// Update another user's profile picture
router.post(
  "/:matrikelnummer/picture",
  authMiddleware,
  requireRole("Editor", "Admin"),
  uploadProfilePicture,
  wrapAsync(usersController.updateOtherPictureHandler)
);

// Award an achievement to a user
router.post(
  "/:matrikelnummer/achievements",
  authMiddleware,
  requireRole("Admin", "Editor"),
  wrapAsync(usersController.addAchievementHandler)
);

// Get a user's achievement history
router.get(
  "/:matrikelnummer/achievements",
  authMiddleware,
  wrapAsync(usersController.getAchievementsHandler)
);

// Get a user's roles
router.get(
  "/:matrikelnummer/roles",
  authMiddleware,
  requireRole("Admin", "Editor"),
  wrapAsync(usersController.getRolesHandler)
);

// Set roles for a user (admin only)
router.post(
  "/:matrikelnummer/roles",
  authMiddleware,
  requireRole("Admin"),
  wrapAsync(usersController.setRolesHandler)
);

// Get a user's lodge
router.get(
  "/:matrikelnummer/lodges",
  authMiddleware,
  wrapAsync(usersController.getLodgeHandler)
);

// Atomic post a user's lodge. Send `{ "lodgeId": <id> }` or `{ "lodgeId": null }` to remove.
router.post(
  "/:matrikelnummer/lodges",
  authMiddleware,
  requireRole("Admin", "Editor"),
  wrapAsync(usersController.setLodgeHandler)
);

export default router;
