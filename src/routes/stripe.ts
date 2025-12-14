import express from "express";
import authMiddleware from "../middleware/auth";
import {
  createMembershipHandler,
  getPaymentHandler,
  getByTokenHandler,
} from "../controllers/stripeController";

const router = express.Router();

// Create a membership invoice for current user
router.post("/membership", authMiddleware, createMembershipHandler);

// Get a membership payment by id (owner or admin)
router.get("/membership/:id", authMiddleware, getPaymentHandler);

// Get payment status by invoice token (public)
router.get("/membership/status/:token", getByTokenHandler);


export default router;
