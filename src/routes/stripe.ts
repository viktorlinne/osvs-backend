import express from "express";
import authMiddleware from "../middleware/auth";
import {
  createMembershipHandler,
  getPaymentHandler,
  getByTokenHandler,
  getMyMembershipsHandler,
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
/**
 * @openapi
 * /stripe/membership:
 *   post:
 *     tags:
 *       - Stripe
 *     summary: Create or return a membership invoice and a Stripe client_secret
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               year:
 *                 type: integer
 *               amount:
 *                 type: number
 *     responses:
 *       200:
 *         description: Payment object with client_secret
 *       400:
 *         description: Validation error
 */
router.post("/membership", authMiddleware, wrapAsync(createMembershipHandler));

// List membership payments for current user
/**
 * @openapi
 * /stripe/membership:
 *   get:
 *     tags:
 *       - Stripe
 *     summary: List membership payments for current user
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: year
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Array of membership payments
 */
router.get(
  "/membership",
  authMiddleware,
  wrapAsync(getMyMembershipsHandler)
);

// Get a membership payment by id (owner or admin)
/**
 * @openapi
 * /stripe/membership/{id}:
 *   get:
 *     tags:
 *       - Stripe
 *     summary: Get membership payment by id
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Membership payment object
 *       404:
 *         description: Not found
 */
router.get(
  "/membership/:id",
  authMiddleware,
  validateParams,
  wrapAsync(getPaymentHandler)
);

// Get payment status by invoice token (public)
/**
 * @openapi
 * /stripe/membership/status/{token}:
 *   get:
 *     tags:
 *       - Stripe
 *     summary: Get membership payment status by token (public)
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Membership payment object
 *       404:
 *         description: Not found
 */
router.get(
  "/membership/status/:token",
  validateParams,
  wrapAsync(getByTokenHandler)
);

// Checkout session endpoints for embedded checkout
/**
 * @openapi
 * /stripe/create-checkout-session:
 *   post:
 *     tags:
 *       - Stripe
 *     summary: Create an embedded Stripe Checkout session
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               price_id:
 *                 type: string
 *               quantity:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Checkout session created
 */
router.post(
  "/create-checkout-session",
  authMiddleware,
  wrapAsync(createCheckoutSessionHandler)
);
router.get("/session-status", wrapAsync(sessionStatusHandler));

/**
 * @openapi
 * /stripe/session-status:
 *   get:
 *     tags:
 *       - Stripe
 *     summary: Retrieve checkout session status by session_id
 *     parameters:
 *       - in: query
 *         name: session_id
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Session status
 */

// Event payment endpoints
/**
 * @openapi
 * /stripe/event/{eventId}:
 *   post:
 *     tags:
 *       - Stripe
 *     summary: Create or return an event payment and a Stripe client_secret
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: eventId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Payment object with client_secret
 */
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

/**
 * @openapi
 * /stripe/event/status/{token}:
 *   get:
 *     tags:
 *       - Stripe
 *     summary: Get event payment by token (public)
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Event payment object
 */

router.get(
  "/event/status/:token",
  validateParams,
  wrapAsync(getEventByTokenHandler)
);

export default router;
