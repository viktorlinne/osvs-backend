import express from "express";
import {
  listLodgesHandler,
  getLodgeHandler,
  createLodgeHandler,
  updateLodgeHandler,
} from "../controllers/lodgesController";
import { wrapAsync } from "../middleware/asyncHandler";
import { validateParams } from "../middleware/validate";
// params/body validators removed
import authMiddleware from "../middleware/auth";
import { requireRole } from "../middleware/authorize";

// body validators removed

const router = express.Router();

// Authenticated: list lodges
router.get("/", authMiddleware, wrapAsync(listLodgesHandler));

// Get single lodge
router.get("/:id", authMiddleware, wrapAsync(getLodgeHandler));

// Admin: create lodge
router.post(
  "/",
  authMiddleware,
  requireRole("Admin"),
  wrapAsync(createLodgeHandler)
);

// Admin: update lodge
router.put(
  "/:id",
  authMiddleware,
  requireRole("Admin"),
  validateParams, // leave params middleware but without Zod schema
  wrapAsync(updateLodgeHandler)
);

export default router;
