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
import { wrapAsync } from "../middleware/asyncHandler";
import { validateParams, validateBody } from "../middleware/validate";
import { idParamSchema } from "../validators/params";
import {
  createEstablishmentSchema,
  updateEstablishmentSchema,
  linkLodgeSchema,
} from "../validators/establishments";
const router = express.Router();

// List/get
router.get("/", authMiddleware, wrapAsync(listEstablishmentsHandler));
router.get(
  "/:id",
  authMiddleware,
  validateParams(idParamSchema),
  wrapAsync(getEstablishmentHandler)
);

// Admin CRUD
router.post(
  "/",
  authMiddleware,
  requireRole(UserRole.Admin),
  validateBody(createEstablishmentSchema),
  wrapAsync(createEstablishmentHandler)
);
router.put(
  "/:id",
  authMiddleware,
  requireRole(UserRole.Admin),
  validateBody(updateEstablishmentSchema),
  wrapAsync(updateEstablishmentHandler)
);
router.delete(
  "/:id",
  authMiddleware,
  requireRole(UserRole.Admin),
  wrapAsync(deleteEstablishmentHandler)
);

// Link/unlink lodges to establishments
router.post(
  "/:id/lodges",
  authMiddleware,
  requireRole(UserRole.Admin),
  validateBody(linkLodgeSchema),
  wrapAsync(linkLodgeHandler)
);
router.delete(
  "/:id/lodges",
  authMiddleware,
  requireRole(UserRole.Admin),
  validateBody(linkLodgeSchema),
  wrapAsync(unlinkLodgeHandler)
);

export default router;
