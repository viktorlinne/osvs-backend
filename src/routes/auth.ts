import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { validateBody } from "../middleware/validate";
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

// Schema for user reigstration
const registerSchema = z.object({
  username: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  firstname: z.string().min(1),
  lastname: z.string().min(1),
  dateOfBirth: z.string().min(1),
  official: z.string().optional(),
  mobile: z.string().min(1),
  city: z.string().min(1),
  address: z.string().min(1),
  zipcode: z.string().min(1),
  counter: z.preprocess((val) => {
    if (val === undefined || val === null || val === "") return undefined;
    if (typeof val === "string") {
      const n = Number(val);
      return Number.isFinite(n) ? n : undefined;
    }
    return typeof val === "number" ? val : undefined;
  }, z.number().optional()),
});

// Schema for login request
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// Schema for password reset request
const forgotSchema = z.object({
  email: z.string().email(),
});

// Schema for password reset
const resetSchema = z.object({
  token: z.string().min(8),
  password: z.string().min(8),
});

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
