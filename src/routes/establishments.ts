import express from "express";
import authMiddleware from "../middleware/auth";
import { requireRole } from "../middleware/authorize";

import {
  listEstablishmentsHandler,
  getEstablishmentHandler,
  createEstablishmentHandler,
  updateEstablishmentHandler,
  deleteEstablishmentHandler,
  linkLodgeHandler,
  unlinkLodgeHandler,
} from "../controllers/establishmentsController";
import { wrapAsync } from "../middleware/asyncHandler";
// validators removed; controllers will validate inputs
const router = express.Router();

// List/get
router.get("/", authMiddleware, wrapAsync(listEstablishmentsHandler));
router.get("/:id", authMiddleware, wrapAsync(getEstablishmentHandler));

// Admin CRUD
router.post(
  "/",
  authMiddleware,
  requireRole("Admin"),
  wrapAsync(createEstablishmentHandler)
);
router.put(
  "/:id",
  authMiddleware,
  requireRole("Admin"),
  wrapAsync(updateEstablishmentHandler)
);
router.delete(
  "/:id",
  authMiddleware,
  requireRole("Admin"),
  wrapAsync(deleteEstablishmentHandler)
);

// Link/unlink lodges to establishments
router.post(
  "/:id/lodges",
  authMiddleware,
  requireRole("Admin"),
  wrapAsync(linkLodgeHandler)
);
router.delete(
  "/:id/lodges",
  authMiddleware,
  requireRole("Admin"),
  wrapAsync(unlinkLodgeHandler)
);

export default router;
