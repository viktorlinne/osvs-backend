import express from "express";
import authMiddleware from "../middleware/auth";
import {
  createMembershipHandler,
  getPaymentHandler,
  getByTokenHandler,
} from "../controllers/stripeController";
import { wrapAsync } from "../middleware/asyncHandler";
import { validateParams } from "../middleware/validate";
import { idParamSchema, tokenParamSchema } from "./schemas/params";

const router = express.Router();

// Create a membership invoice for current user
router.post("/membership", authMiddleware, wrapAsync(createMembershipHandler));

// Get a membership payment by id (owner or admin)
router.get(
  "/membership/:id",
  authMiddleware,
  validateParams(idParamSchema),
  wrapAsync(getPaymentHandler)
);

// Get payment status by invoice token (public)
router.get(
  "/membership/status/:token",
  validateParams(tokenParamSchema),
  wrapAsync(getByTokenHandler)
);

export default router;
