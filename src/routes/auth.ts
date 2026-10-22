import { Router } from "express";
import rateLimit from "express-rate-limit";
import { sendError } from "../utils/response";
// validators removed; controllers perform necessary checks
import authMiddleware from "../middleware/auth";
import * as authController from "../controllers/authController";
import { wrapAsync } from "../middleware/asyncHandler";
import { requireRole } from "../middleware/authorize";
import { uploadProfilePicture } from "../utils/fileUpload";
import { getAuthRateLimitConfig } from "../config/env";
import {
  createIpRateLimiter,
  createLoginAccountRateLimiter,
  createSessionRateLimiter,
} from "../middleware/authRateLimit";

const router = Router();

const authLimits = getAuthRateLimitConfig();
const LOGIN_LIMIT_MESSAGE = "För många inloggningsförsök, försök igen senare.";
const REFRESH_LIMIT_MESSAGE = "För många sessionförnyelser, försök igen senare.";
const HEARTBEAT_LIMIT_MESSAGE =
  "För många heartbeat-förfrågningar, försök igen senare.";

// Login: per IP + e-mail against brute force on one account, plus a per-IP
// ceiling against credential stuffing. A single per-IP limit would lock out a
// whole lodge sharing one Wi-Fi after a handful of logins.
const loginAccountLimiter = createLoginAccountRateLimiter({
  windowMs: authLimits.windowMs,
  max: authLimits.loginPerAccount,
  message: LOGIN_LIMIT_MESSAGE,
});
const loginIpLimiter = createIpRateLimiter({
  windowMs: authLimits.windowMs,
  max: authLimits.loginPerIp,
  message: LOGIN_LIMIT_MESSAGE,
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

const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) =>
    sendError(
      res,
      429,
      "För många försök att skicka återställningsmejl, försök igen senare.",
    ),
});

const passwordActionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) =>
    sendError(
      res,
      429,
      "För många försök, försök igen senare.",
    ),
});

// Session renewal (refresh + heartbeat): per session (hash of the refresh
// cookie) so members on a shared network have independent budgets, plus a much
// higher per-IP ceiling as abuse protection. Order matters: the IP ceiling
// counts every request, including ones the per-session limiter rejects.
const refreshIpLimiter = createIpRateLimiter({
  windowMs: authLimits.windowMs,
  max: authLimits.refreshPerIp,
  message: REFRESH_LIMIT_MESSAGE,
});
const refreshSessionLimiter = createSessionRateLimiter({
  windowMs: authLimits.windowMs,
  max: authLimits.refreshPerSession,
  message: REFRESH_LIMIT_MESSAGE,
});

const heartbeatIpLimiter = createIpRateLimiter({
  windowMs: authLimits.windowMs,
  max: authLimits.heartbeatPerIp,
  message: HEARTBEAT_LIMIT_MESSAGE,
});
const heartbeatSessionLimiter = createSessionRateLimiter({
  windowMs: authLimits.windowMs,
  max: authLimits.heartbeatPerSession,
  message: HEARTBEAT_LIMIT_MESSAGE,
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

router.post(
  "/login",
  loginIpLimiter,
  loginAccountLimiter,
  wrapAsync(authController.login),
);
router.post(
  "/forgot-password",
  forgotPasswordLimiter,
  wrapAsync(authController.forgotPassword),
);
router.post(
  "/password-actions/verify",
  passwordActionLimiter,
  wrapAsync(authController.verifyPasswordAction),
);
router.post(
  "/password-actions/complete",
  passwordActionLimiter,
  wrapAsync(authController.completePasswordAction),
);

router.post(
  "/refresh",
  refreshIpLimiter,
  refreshSessionLimiter,
  wrapAsync(authController.refresh),
);
router.post(
  "/heartbeat",
  heartbeatIpLimiter,
  heartbeatSessionLimiter,
  wrapAsync(authController.heartbeat),
);
router.get("/me", authMiddleware, wrapAsync(authController.me));
// No authMiddleware: an expired access token must not prevent revoking the
// refresh session; logoutFromRequest works from whichever cookies are present.
router.post("/logout", refreshIpLimiter, wrapAsync(authController.logout));

router.post("/revoke-all", authMiddleware, wrapAsync(authController.revokeAll));

export default router;
