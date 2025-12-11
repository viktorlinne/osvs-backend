import express from "express";
import {
  listLodgesHandler,
  createLodgeHandler,
  updateLodgeHandler,
} from "../controllers/lodgesController";
import authMiddleware from "../middleware/auth";
import { requireRole } from "../middleware/authorize";
import { UserRole } from "../types/auth";

const router = express.Router();

// Authenticated: list lodges
router.get("/", authMiddleware, listLodgesHandler);

// Admin: create lodge
router.post(
  "/",
  authMiddleware,
  requireRole(UserRole.Admin),
  createLodgeHandler
);

// Admin: update lodge
router.put(
  "/:id",
  authMiddleware,
  requireRole(UserRole.Admin),
  updateLodgeHandler
);

export default router;
