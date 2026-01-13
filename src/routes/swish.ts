import express from "express";
import authMiddleware from "../middleware/auth";
import {
  createMembershipHandler,
  getPaymentHandler,
  getByTokenHandler,
  webhookHandler,
} from "../controllers/swishController";
import { wrapAsync } from "../middleware/asyncHandler";
import { validateParams } from "../middleware/validate";
// params validators removed

const router = express.Router();

// Create a membership invoice for current user
/**
 * @openapi
 * /swish/membership:
 *   post:
 *     tags:
 *       - Swish
 *     summary: Create membership invoice via Swish
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
 *         description: Payment created
 */
router.post("/membership", authMiddleware, wrapAsync(createMembershipHandler));

// Get a membership payment by id (owner or admin)
/**
 * @openapi
 * /swish/membership/{id}:
 *   get:
 *     tags:
 *       - Swish
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
 *         description: Payment object
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
 * /swish/membership/status/{token}:
 *   get:
 *     tags:
 *       - Swish
 *     summary: Get membership payment status by token (public)
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Payment object
 */
router.get(
  "/membership/status/:token",
  validateParams,
  wrapAsync(getByTokenHandler)
);

// Payment provider webhook (provider posts updates here)
/**
 * @openapi
 * /swish/webhook:
 *   post:
 *     tags:
 *       - Swish
 *     summary: Swish webhook endpoint
 *     responses:
 *       200:
 *         description: ok
 */
router.post("/webhook", wrapAsync(webhookHandler));

export default router;
