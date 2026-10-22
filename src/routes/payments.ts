import express from "express";
import authMiddleware from "../middleware/auth";
import { requireRole } from "../middleware/authorize";
import { wrapAsync } from "../middleware/asyncHandler";
import * as paymentsController from "../controllers/paymentsController";

const router = express.Router();

router.get(
  "/membership",
  authMiddleware,
  wrapAsync(paymentsController.getMyMembershipsHandler),
);

router.get(
  "/membership/admin",
  authMiddleware,
  requireRole("Admin"),
  wrapAsync(paymentsController.getAllMembershipsHandler),
);

router.patch(
  "/membership/:id/status",
  authMiddleware,
  requireRole("Admin"),
  wrapAsync(paymentsController.updateMembershipStatusHandler),
);

// Event payments overview for the treasurer (Admin/Editor). Marking a payment
// paid/unpaid uses PATCH /api/events/:id/attendances/:uid.
router.get(
  "/events/outstanding",
  authMiddleware,
  requireRole("Admin", "Editor"),
  wrapAsync(paymentsController.getOutstandingEventPaymentsHandler),
);

export default router;
