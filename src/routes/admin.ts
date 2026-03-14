import { Router } from "express";
import authMiddleware from "../middleware/auth";
import { requireRole } from "../middleware/authorize";
import adminController from "../controllers/adminController";
import { wrapAsync } from "../middleware/asyncHandler";

const router = Router();

router.get(
  "/roles",
  authMiddleware,
  requireRole("Admin"),
  wrapAsync(adminController.getRoles)
);

export default router;
