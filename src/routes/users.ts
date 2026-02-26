import express from "express";
import usersController from "../controllers/usersController";
import { wrapAsync } from "../middleware/asyncHandler";
import authMiddleware from "../middleware/auth";
import { uploadProfilePicture } from "../utils/fileUpload";
// validators removed: runtime validation replaced by local DTOs/types
import { requireRole } from "../middleware/authorize";

const router = express.Router();

// Minimal placeholder routes used in tests. Expand as needed.
/**
 * @openapi
 * /users/me:
 *   get:
 *     tags:
 *       - Users
 *     summary: Get current user's public info
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Current user
 */
router.get("/me", authMiddleware, wrapAsync(usersController.placeholderMe));

// Update current user's profile
/**
 * @openapi
 * /users/me:
 *   put:
 *     tags:
 *       - Users
 *     summary: Update current user's profile
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Profile updated
 */
router.put("/me", authMiddleware, wrapAsync(usersController.updateMeHandler));

// Update current user's profile picture
/**
 * @openapi
 * /users/me/picture:
 *   post:
 *     tags:
 *       - Users
 *     summary: Update current user's profile picture
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Picture updated
 */
router.post(
  "/me/picture",
  authMiddleware,
  uploadProfilePicture,
  wrapAsync(usersController.updatePictureHandler)
);

// List public users (authenticated)
/**
 * @openapi
 * /users:
 *   get:
 *     tags:
 *       - Users
 *     summary: List public users
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Array of public users
 */
router.get("/", authMiddleware, wrapAsync(usersController.listUsersHandler));

router.get(
  "/:matrikelnummer",
  authMiddleware,
  wrapAsync(usersController.getPublicUserHandler)
);

/**
 * @openapi
 * /users/{matrikelnummer}:
 *   put:
 *     tags:
 *       - Users
 *     summary: Update another user's profile (Admin/Editor)
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: matrikelnummer
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: User updated
 */

// Update another user's profile
router.put(
  "/:matrikelnummer",
  authMiddleware,
  requireRole("Admin", "Editor"),
  wrapAsync(usersController.updateUserHandler)
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
