import express from "express";
import authMiddleware from "../middleware/auth";
import {
  createMembershipHandler,
  getPaymentHandler,
  getByTokenHandler,
  createCheckoutSessionHandler,
  sessionStatusHandler,
} from "../controllers/stripeController";
import {
  createEventPaymentHandler,
  getEventPaymentHandler,
  getEventByTokenHandler,
} from "../controllers/stripeController";
import { wrapAsync } from "../middleware/asyncHandler";
import { validateParams } from "../middleware/validate";
// params validators removed

const router = express.Router();

// Create a membership invoice for current user
router.post("/membership", authMiddleware, wrapAsync(createMembershipHandler));

// Get a membership payment by id (owner or admin)
router.get(
  "/membership/:id",
  authMiddleware,
  validateParams,
  wrapAsync(getPaymentHandler)
);

// Get payment status by invoice token (public)
router.get(
  "/membership/status/:token",
  validateParams,
  wrapAsync(getByTokenHandler)
);

// Checkout session endpoints for embedded checkout
router.post(
  "/create-checkout-session",
  authMiddleware,
  wrapAsync(createCheckoutSessionHandler)
);
router.get("/session-status", wrapAsync(sessionStatusHandler));

// Event payment endpoints
router.post(
  "/event/:eventId",
  authMiddleware,
  validateParams,
  wrapAsync(createEventPaymentHandler)
);

router.get(
  "/event/:id",
  authMiddleware,
  validateParams,
  wrapAsync(getEventPaymentHandler)
);

router.get(
  "/event/status/:token",
  validateParams,
  wrapAsync(getEventByTokenHandler)
);

export default router;
