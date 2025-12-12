import express from "express";
import authMiddleware from "../middleware/auth";
import { requireRole } from "../middleware/authorize";
import { UserRole } from "../types/auth";
import {
  listEstablishmentsHandler,
  getEstablishmentHandler,
  createEstablishmentHandler,
  updateEstablishmentHandler,
  deleteEstablishmentHandler,
  linkLodgeHandler,
  unlinkLodgeHandler,
} from "../controllers/establishmentsController";
import { validateBody } from "../middleware/validate";
import {
  createEstablishmentSchema,
  updateEstablishmentSchema,
  linkLodgeSchema,
} from "./schemas/establishments";

const router = express.Router();

// List/get
router.get("/", authMiddleware, listEstablishmentsHandler);
router.get("/:id", authMiddleware, getEstablishmentHandler);

// Admin CRUD
router.post(
  "/",
  authMiddleware,
  requireRole(UserRole.Admin),
  validateBody(createEstablishmentSchema),
  createEstablishmentHandler
);
router.put(
  "/:id",
  authMiddleware,
  requireRole(UserRole.Admin),
  validateBody(updateEstablishmentSchema),
  updateEstablishmentHandler
);
router.delete(
  "/:id",
  authMiddleware,
  requireRole(UserRole.Admin),
  deleteEstablishmentHandler
);

// Link/unlink lodges to establishments
router.post(
  "/:id/lodges",
  authMiddleware,
  requireRole(UserRole.Admin),
  validateBody(linkLodgeSchema),
  linkLodgeHandler
);
router.delete(
  "/:id/lodges",
  authMiddleware,
  requireRole(UserRole.Admin),
  validateBody(linkLodgeSchema),
  unlinkLodgeHandler
);

export default router;
