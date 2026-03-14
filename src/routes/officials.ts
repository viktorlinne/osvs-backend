import express from "express";
import {
  listOfficialsHandler,
  setMemberOfficialsHandler,
} from "../controllers/officialsController";
import { wrapAsync } from "../middleware/asyncHandler";
import authMiddleware from "../middleware/auth";
import { requireRole } from "../middleware/authorize";

const router = express.Router();

router.get("/", listOfficialsHandler);

// Set another member's officials (Admin/Editor required)
router.put(
  "/member/:matrikelnummer",
  authMiddleware,
  requireRole("Admin", "Editor"),
  wrapAsync(setMemberOfficialsHandler)
);

export default router;
