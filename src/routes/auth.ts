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

router.post(
  "/register",
  registerLimiter,
  authMiddleware,
  requireRole("Admin", "Editor"),
  uploadProfilePicture,
  wrapAsync(authController.register),
);

router.post("/login", loginLimiter, wrapAsync(authController.login));

router.post("/refresh", wrapAsync(authController.refresh));
router.post("/heartbeat", wrapAsync(authController.heartbeat));
router.get("/me", authMiddleware, wrapAsync(authController.me));
router.post("/logout", authMiddleware, wrapAsync(authController.logout));

router.post("/revoke-all", authMiddleware, wrapAsync(authController.revokeAll));

export default router;
