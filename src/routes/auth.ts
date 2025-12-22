import { Router } from "express";
import rateLimit from "express-rate-limit";
import { validateBody } from "../middleware/validate";
import {
  registerSchema,
  loginSchema,
  forgotSchema,
  resetSchema,
} from "../validators/auth";
import authMiddleware from "../middleware/auth";
import * as authController from "../controllers/authController";
import { wrapAsync } from "../middleware/asyncHandler";
import { requireRole } from "../middleware/authorize";
import { UserRole } from "@osvs/types";
import { uploadProfilePicture } from "../utils/fileUpload";

const router = Router();

// Limit login attempts to prevent brute-force attacks
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "För många inloggningsförsök, försök igen senare." },
});

// Limit registration attempts to prevent abuse
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "För många konton skapade från denna IP, försök igen senare.",
  },
});

// Auth schemas are imported from ./schemas/auth

// Register a user (admin/editor only)
router.post(
  "/register",
  registerLimiter,
  authMiddleware,
  requireRole("Admin", "Editor"),
  uploadProfilePicture,
  validateBody(registerSchema),
  wrapAsync(authController.register)
);

// Request login with email and password
router.post(
  "/login",
  loginLimiter,
  validateBody(loginSchema),
  wrapAsync(authController.login)
);

// Request a password reset: returns a one-time token in tmp/ (for Postman/dev).
router.post(
  "/forgot-password",
  validateBody(forgotSchema),
  wrapAsync(authController.forgotPassword)
);

// Perform password reset using token
router.post(
  "/reset-password",
  validateBody(resetSchema),
  wrapAsync(authController.resetPassword)
);

router.post("/refresh", wrapAsync(authController.refresh));
router.get("/me", authMiddleware, wrapAsync(authController.me));
router.post("/logout", authMiddleware, wrapAsync(authController.logout));
router.post("/revoke-all", authMiddleware, wrapAsync(authController.revokeAll));

export default router;
