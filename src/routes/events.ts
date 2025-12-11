import express from "express";
import authMiddleware from "../middleware/auth";
import { requireRole } from "../middleware/authorize";
import { UserRole } from "../types/auth";
import {
  listEventsHandler,
  getEventHandler,
  createEventHandler,
  updateEventHandler,
  deleteEventHandler,
  linkLodgeHandler,
  unlinkLodgeHandler,
  linkEstablishmentHandler,
  unlinkEstablishmentHandler,
  listForUserHandler,
} from "../controllers/eventsController";
import { validateBody } from "../middleware/validate";
import {
  createEventSchema,
  updateEventSchema,
  linkLodgeSchema,
  linkEstablishmentSchema,
} from "./schemas/events";

const router = express.Router();

// Public listing (authenticated)
router.get("/", authMiddleware, listEventsHandler);

// Events visible to current user (by lodge membership)
router.get("/mine", authMiddleware, listForUserHandler);

// Get single event
router.get("/:id", authMiddleware, getEventHandler);

// Create (Admin/Editor)
router.post(
  "/",
  authMiddleware,
  requireRole(UserRole.Admin, UserRole.Editor),
  validateBody(createEventSchema),
  createEventHandler
);

// Update (Admin/Editor)
router.put(
  "/:id",
  authMiddleware,
  requireRole(UserRole.Admin, UserRole.Editor),
  validateBody(updateEventSchema),
  updateEventHandler
);

// Delete (Admin)
router.delete(
  "/:id",
  authMiddleware,
  requireRole(UserRole.Admin),
  deleteEventHandler
);

// Link/unlink lodges
router.post(
  "/:id/lodges",
  authMiddleware,
  requireRole(UserRole.Admin, UserRole.Editor),
  validateBody(linkLodgeSchema),
  linkLodgeHandler
);
router.delete(
  "/:id/lodges",
  authMiddleware,
  requireRole(UserRole.Admin, UserRole.Editor),
  validateBody(linkLodgeSchema),
  unlinkLodgeHandler
);

// Link/unlink establishments
router.post(
  "/:id/establishments",
  authMiddleware,
  requireRole(UserRole.Admin, UserRole.Editor),
  validateBody(linkEstablishmentSchema),
  linkEstablishmentHandler
);
router.delete(
  "/:id/establishments",
  authMiddleware,
  requireRole(UserRole.Admin, UserRole.Editor),
  validateBody(linkEstablishmentSchema),
  unlinkEstablishmentHandler
);

export default router;
