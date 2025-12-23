import express from "express";
import {
  listLodgesHandler,
  getLodgeHandler,
  createLodgeHandler,
  updateLodgeHandler,
} from "../controllers/lodgesController";
import { wrapAsync } from "../middleware/asyncHandler";
import { validateParams } from "../middleware/validate";
import { idParamSchema } from "../validators/params";
import authMiddleware from "../middleware/auth";
import { requireRole } from "../middleware/authorize";
import { UserRole } from "@osvs/types";
import { validateBody } from "../middleware/validate";
import { createLodgeSchema, updateLodgeSchema } from "../validators/lodges";

const router = express.Router();

// Authenticated: list lodges
router.get("/", authMiddleware, wrapAsync(listLodgesHandler));

// Get single lodge
router.get(
  "/:id",
  authMiddleware,
  validateParams(idParamSchema),
  wrapAsync(getLodgeHandler)
);

// Admin: create lodge
router.post(
  "/",
  authMiddleware,
  requireRole("Admin"),
  validateBody(createLodgeSchema),
  wrapAsync(createLodgeHandler)
);

// Admin: update lodge
router.put(
  "/:id",
  authMiddleware,
  requireRole("Admin"),
  validateBody(updateLodgeSchema),
  validateParams(idParamSchema),
  wrapAsync(updateLodgeHandler)
);

export default router;
