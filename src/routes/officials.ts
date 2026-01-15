import express from "express";
import {
  listOfficialsHandler,
  getMyOfficialsHandler,
  getMemberOfficialsHandler,
  setMemberOfficialsHandler,
} from "../controllers/officialsController";
import { wrapAsync } from "../middleware/asyncHandler";
import authMiddleware from "../middleware/auth";
import { requireRole } from "../middleware/authorize";

const router = express.Router();

// Public list of officials
/**
 * @openapi
 * /officials:
 *   get:
 *     tags:
 *       - Officials
 *     summary: List official types
 *     responses:
 *       200:
 *         description: Array of official types
 */
router.get("/", listOfficialsHandler);

// Get current user's officials (auth required)
router.get("/me", authMiddleware, wrapAsync(getMyOfficialsHandler));

// Get another member's officials (auth required)
router.get("/member/:id", authMiddleware, wrapAsync(getMemberOfficialsHandler));

// Set another member's officials (Admin/Editor required)
router.put(
  "/member/:id",
  authMiddleware,
  requireRole("Admin", "Editor"),
  wrapAsync(setMemberOfficialsHandler)
);

export default router;
