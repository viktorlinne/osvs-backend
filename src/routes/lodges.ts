import express from "express";
import {
  listLodgesHandler,
  getLodgeHandler,
  createLodgeHandler,
  updateLodgeHandler,
} from "../controllers/lodgesController";
import { wrapAsync } from "../middleware/asyncHandler";
import authMiddleware from "../middleware/auth";
import { requireRole } from "../middleware/authorize";

// body validators removed

const router = express.Router();

router.get("/", wrapAsync(listLodgesHandler));

router.get("/:id", wrapAsync(getLodgeHandler));

router.post(
  "/",
  authMiddleware,
  requireRole("Admin"),
  wrapAsync(createLodgeHandler),
);

// Admin: update lodge
router.put(
  "/:id",
  authMiddleware,
  requireRole("Admin"),
  wrapAsync(updateLodgeHandler),
);

export default router;
