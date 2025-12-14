import express from "express";
import authMiddleware from "../middleware/auth";
import {
  createMembershipHandler,
  getPaymentHandler,
  getByTokenHandler,
  // (wait until later to implement) webhookHandler,
} from "../controllers/stripeController";

const router = express.Router();

// Create a membership invoice for current user
router.post("/membership", authMiddleware, createMembershipHandler);

// Get a membership payment by id (owner or admin)
router.get("/membership/:id", authMiddleware, getPaymentHandler);

// Get payment status by invoice token (public)
router.get("/membership/status/:token", getByTokenHandler);

// Payment provider webhook (provider posts updates here) — use raw body for signature verification
// NOTE: webhook route is mounted directly in app.ts before body parsing middleware

export default router;
