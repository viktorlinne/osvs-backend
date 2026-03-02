import express from "express";
import authMiddleware from "../middleware/auth";
import { wrapAsync } from "../middleware/asyncHandler";
import * as paymentsController from "../controllers/paymentsController";

const router = express.Router();

router.get(
  "/membership",
  authMiddleware,
  wrapAsync(paymentsController.getMyMembershipsHandler),
);

export default router;
