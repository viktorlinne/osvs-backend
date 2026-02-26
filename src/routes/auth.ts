import { Router } from "express";
import rateLimit from "express-rate-limit";
import { sendError } from "../utils/response";
// validators removed; controllers perform necessary checks
import authMiddleware from "../middleware/auth";
import * as authController from "../controllers/authController";
import { wrapAsync } from "../middleware/asyncHandler";
import { requireRole } from "../middleware/authorize";
import { uploadProfilePicture } from "../utils/fileUpload";

const router = Router();

// Limit login attempts to prevent brute-force attacks
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) =>
    sendError(res, 429, "För många inloggningsförsök, försök igen senare."),
});

// Limit registration attempts to prevent abuse
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) =>
    sendError(
      res,
      429,
      "För många konton skapade från denna IP, försök igen senare.",
    ),
});

// Auth schemas are imported from ./schemas/auth

// Register a user (admin/editor only)
/**
 * @openapi
 * /auth/register:
 *   post:
 *     tags:
 *       - Auth
 *     summary: Register a new user (Admin/Editor only)
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *               firstname:
 *                 type: string
 *               lastname:
 *                 type: string
 *               dateOfBirth:
 *                 type: string
 *               mobile:
 *                 type: string
 *               city:
 *                 type: string
 *               address:
 *                 type: string
 *               zipcode:
 *                 type: string
 *               lodgeId:
 *                 type: integer
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       201:
 *         description: User created
 *       400:
 *         description: Validation error
 */
router.post(
  "/register",
  registerLimiter,
  authMiddleware,
  requireRole("Admin", "Editor"),
  uploadProfilePicture,
  wrapAsync(authController.register),
);

// Request login with email and password
/**
 * @openapi
 * /auth/login:
 *   post:
 *     tags:
 *       - Auth
 *     summary: Login with email and password
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 *       401:
 *         description: Invalid credentials
 */
router.post("/login", loginLimiter, wrapAsync(authController.login));

router.post("/refresh", wrapAsync(authController.refresh));
/**
 * @openapi
 * /auth/refresh:
 *   post:
 *     tags:
 *       - Auth
 *     summary: Refresh access token using refresh cookie
 *     responses:
 *       200:
 *         description: New access token issued
 *       401:
 *         description: Missing or invalid refresh token
 */

/**
 * @openapi
 * /auth/me:
 *   get:
 *     tags:
 *       - Auth
 *     summary: Get current authenticated user
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Current user object
 *       401:
 *         description: Unauthorized
 */
router.get("/me", authMiddleware, wrapAsync(authController.me));
/**
 * @openapi
 * /auth/logout:
 *   post:
 *     tags:
 *       - Auth
 *     summary: Logout from this device
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Logged out
 */
router.post("/logout", authMiddleware, wrapAsync(authController.logout));

/**
 * @openapi
 * /auth/revoke-all:
 *   post:
 *     tags:
 *       - Auth
 *     summary: Revoke all sessions for current user
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: All sessions revoked
 */
router.post("/revoke-all", authMiddleware, wrapAsync(authController.revokeAll));

export default router;
