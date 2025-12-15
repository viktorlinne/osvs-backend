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
  rsvpHandler,
  getUserRsvpHandler,
} from "../controllers/eventsController";
import { wrapAsync } from "../middleware/asyncHandler";
import { validateParams } from "../middleware/validate";
import { idParamSchema } from "../validators/params";
import { validateBody } from "../middleware/validate";
import {
  createEventSchema,
  updateEventSchema,
  linkLodgeSchema,
  linkEstablishmentSchema,
  rsvpSchema,
} from "../validators/events";

const router = express.Router();

// Public listing (authenticated)
router.get("/", authMiddleware, wrapAsync(listEventsHandler));

// Events visible to current user (by lodge membership)
router.get("/mine", authMiddleware, wrapAsync(listForUserHandler));

// Get single event
router.get(
  "/:id",
  authMiddleware,
  validateParams(idParamSchema),
  wrapAsync(getEventHandler)
);

// Create (Admin/Editor)
router.post(
  "/",
  authMiddleware,
  requireRole(UserRole.Admin, UserRole.Editor),
  validateBody(createEventSchema),
  wrapAsync(createEventHandler)
);

// Update (Admin/Editor)
router.put(
  "/:id",
  authMiddleware,
  requireRole(UserRole.Admin, UserRole.Editor),
  validateBody(updateEventSchema),
  validateParams(idParamSchema),
  wrapAsync(updateEventHandler)
);

// Delete (Admin)
router.delete(
  "/:id",
  authMiddleware,
  requireRole(UserRole.Admin),
  validateParams(idParamSchema),
  wrapAsync(deleteEventHandler)
);

// Link/unlink lodges
router.post(
  "/:id/lodges",
  authMiddleware,
  requireRole(UserRole.Admin, UserRole.Editor),
  validateBody(linkLodgeSchema),
  validateParams(idParamSchema),
  wrapAsync(linkLodgeHandler)
);
router.delete(
  "/:id/lodges",
  authMiddleware,
  requireRole(UserRole.Admin, UserRole.Editor),
  validateBody(linkLodgeSchema),
  validateParams(idParamSchema),
  wrapAsync(unlinkLodgeHandler)
);

// Link/unlink establishments
router.post(
  "/:id/establishments",
  authMiddleware,
  requireRole(UserRole.Admin, UserRole.Editor),
  validateBody(linkEstablishmentSchema),
  validateParams(idParamSchema),
  wrapAsync(linkEstablishmentHandler)
);
router.delete(
  "/:id/establishments",
  authMiddleware,
  requireRole(UserRole.Admin, UserRole.Editor),
  validateBody(linkEstablishmentSchema),
  validateParams(idParamSchema),
  wrapAsync(unlinkEstablishmentHandler)
);

// RSVP: set current user's RSVP for event (going / not-going)
router.post(
  "/:id/rsvp",
  authMiddleware,
  validateBody(rsvpSchema),
  validateParams(idParamSchema),
  wrapAsync(rsvpHandler)
);

// Get current user's RSVP for an event
router.get(
  "/:id/rsvp",
  authMiddleware,
  validateParams(idParamSchema),
  wrapAsync(getUserRsvpHandler)
);

export default router;
