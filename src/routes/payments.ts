import express from "express";
import authMiddleware from "../middleware/auth";
import { wrapAsync } from "../middleware/asyncHandler";
import * as paymentsController from "../controllers/paymentsController";

const router = express.Router();

router.post(
  "/membership",
  authMiddleware,
  wrapAsync(paymentsController.createMembershipHandler),
);

router.get(
  "/membership",
  authMiddleware,
  wrapAsync(paymentsController.getMyMembershipsHandler),
);

router.get(
  "/membership/:id",
  authMiddleware,
  wrapAsync(paymentsController.getPaymentHandler),
);

router.get(
  "/membership/status/:token",
  wrapAsync(paymentsController.getByTokenHandler),
);

router.post(
  "/event/:eventId",
  authMiddleware,
  wrapAsync(paymentsController.createEventPaymentHandler),
);

router.get(
  "/event/:id",
  authMiddleware,
  wrapAsync(paymentsController.getEventPaymentHandler),
);

router.get(
  "/event/status/:token",
  wrapAsync(paymentsController.getEventByTokenHandler),
);

export default router;
