import express from "express";
import authMiddleware from "../middleware/auth";
import { requireRole } from "../middleware/authorize";
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
  listEventLodgesHandler,
  getEventStatsHandler,
  rsvpHandler,
  getUserRsvpHandler,
} from "../controllers/eventsController";
import { wrapAsync } from "../middleware/asyncHandler";
import { validateParams } from "../middleware/validate";
// validators removed; controllers handle request validation/typing

const router = express.Router();

// Public listing (authenticated)
router.get("/", authMiddleware, wrapAsync(listEventsHandler));

// Events visible to current user (by lodge membership)
router.get("/mine", authMiddleware, wrapAsync(listForUserHandler));

// Get single event
router.get("/:id", authMiddleware, wrapAsync(getEventHandler));

// Get lodges linked to an event
router.get("/:id/lodges", authMiddleware, wrapAsync(listEventLodgesHandler));

// Admin-only: event statistics
router.get(
  "/:id/stats",
  authMiddleware,
  requireRole("Admin"),
  wrapAsync(getEventStatsHandler)
);

// Create (Admin/Editor)
router.post(
  "/",
  authMiddleware,
  requireRole("Admin", "Editor"),
  wrapAsync(createEventHandler)
);

// Update (Admin/Editor)
router.put(
  "/:id",
  authMiddleware,
  requireRole("Admin", "Editor"),
  validateParams,
  wrapAsync(updateEventHandler)
);

// Delete (Admin)
router.delete(
  "/:id",
  authMiddleware,
  requireRole("Admin"),
  wrapAsync(deleteEventHandler)
);

// Link/unlink lodges
router.post(
  "/:id/lodges",
  authMiddleware,
  requireRole("Admin", "Editor"),
  validateParams,
  wrapAsync(linkLodgeHandler)
);
router.delete(
  "/:id/lodges",
  authMiddleware,
  requireRole("Admin", "Editor"),
  validateParams,
  wrapAsync(unlinkLodgeHandler)
);

// Link/unlink establishments
router.post(
  "/:id/establishments",
  authMiddleware,
  requireRole("Admin", "Editor"),
  validateParams,
  wrapAsync(linkEstablishmentHandler)
);
router.delete(
  "/:id/establishments",
  authMiddleware,
  requireRole("Admin", "Editor"),
  validateParams,
  wrapAsync(unlinkEstablishmentHandler)
);

// RSVP: set current user's RSVP for event (going / not-going)
router.post(
  "/:id/rsvp",
  authMiddleware,
  validateParams,
  wrapAsync(rsvpHandler)
);

// Get current user's RSVP for an event
router.get("/:id/rsvp", authMiddleware, wrapAsync(getUserRsvpHandler));

export default router;
