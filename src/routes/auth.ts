import { Router } from "express";
import rateLimit from "express-rate-limit";
import { validateBody } from "../middleware/validate";
import {
  registerSchema,
  loginSchema,
  forgotSchema,
  resetSchema,
} from "./schemas/auth";
import authMiddleware from "../middleware/auth";
import * as authController from "../controllers/authController";
import { requireRole } from "../middleware/authorize";
import { UserRole } from "../types/auth";

const router = Router();

// Limit login attempts to prevent brute-force attacks
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many login attempts, please try again later." },
});

// Limit registration attempts to prevent abuse
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too many accounts created from this IP, please try later.",
  },
});

// Auth schemas are imported from ./schemas/auth

// Register a user (admin/editor only)
router.post(
  "/register",
  registerLimiter,
  validateBody(registerSchema),
  authMiddleware,
  requireRole(UserRole.Admin, UserRole.Editor),
  authController.register
);

// Request login with email and password
router.post(
  "/login",
  loginLimiter,
  validateBody(loginSchema),
  authController.login
);

// Request a password reset: returns a one-time token in tmp/ (for Postman/dev).
router.post(
  "/forgot-password",
  validateBody(forgotSchema),
  authController.forgotPassword
);

// Perform password reset using token
router.post(
  "/reset-password",
  validateBody(resetSchema),
  authController.resetPassword
);

router.post("/refresh", authController.refresh);
router.get("/me", authMiddleware, authController.me);
router.post("/logout", authMiddleware, authController.logout);
router.post("/revoke-all", authMiddleware, authController.revokeAll);

export default router;
