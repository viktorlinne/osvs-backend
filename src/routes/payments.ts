import express from "express";
import authMiddleware from "../middleware/auth";
import { wrapAsync } from "../middleware/asyncHandler";
import * as paymentsController from "../controllers/paymentsController";
import { validateParams } from "../middleware/validate";

const router = express.Router();

router.post("/membership", authMiddleware);

router.get(
  "/membership",
  authMiddleware,
  wrapAsync(paymentsController.getMyMembershipsHandler),
);

router.get("/membership/:id", authMiddleware, validateParams);

router.get("/membership/status/:token", validateParams);

router.post("/event/:eventId", authMiddleware, validateParams);

router.get("/event/:id", authMiddleware, validateParams);

router.get("/event/status/:token", validateParams);

export default router;
