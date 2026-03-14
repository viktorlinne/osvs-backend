import express from "express";
import authMiddleware from "../middleware/auth";
import { requireRole } from "../middleware/authorize";
import {
  listEventsHandler,
  listUpcomingEventsPublicHandler,
  getEventHandler,
  createEventHandler,
  updateEventHandler,
  deleteEventHandler,
  linkLodgeHandler,
  unlinkLodgeHandler,
  listForUserHandler,
  listEventLodgesHandler,
  rsvpHandler,
  getUserRsvpHandler,
  getUserFoodHandler,
  bookFoodHandler,
  listEventAttendancesHandler,
  patchEventAttendanceHandler,
} from "../controllers/eventsController";
import { wrapAsync } from "../middleware/asyncHandler";

const router = express.Router();

router.get("/", authMiddleware, wrapAsync(listEventsHandler));

// Public upcoming events for homepage calendar
router.get("/upcoming", wrapAsync(listUpcomingEventsPublicHandler));

router.get("/mine", authMiddleware, wrapAsync(listForUserHandler));

router.get("/:id", authMiddleware, wrapAsync(getEventHandler));

router.get("/:id/lodges", authMiddleware, wrapAsync(listEventLodgesHandler));

router.post(
  "/",
  authMiddleware,
  requireRole("Admin", "Editor"),
  wrapAsync(createEventHandler),
);

// Update (Admin/Editor)
router.put(
  "/:id",
  authMiddleware,
  requireRole("Admin", "Editor"),
  wrapAsync(updateEventHandler),
);

// Delete (Admin)
router.delete(
  "/:id",
  authMiddleware,
  requireRole("Admin"),
  wrapAsync(deleteEventHandler),
);

// Link/unlink lodges
router.post(
  "/:id/lodges",
  authMiddleware,
  requireRole("Admin", "Editor"),
  wrapAsync(linkLodgeHandler),
);
router.delete(
  "/:id/lodges",
  authMiddleware,
  requireRole("Admin", "Editor"),
  wrapAsync(unlinkLodgeHandler),
);

router.post("/:id/rsvp", authMiddleware, wrapAsync(rsvpHandler));

// Get current user's RSVP for an event
router.get("/:id/rsvp", authMiddleware, wrapAsync(getUserRsvpHandler));

// Food booking for current user
router.get("/:id/food", authMiddleware, wrapAsync(getUserFoodHandler));
router.post("/:id/food", authMiddleware, wrapAsync(bookFoodHandler));

// Attendances table for invited users + admin patch endpoint
router.get("/:id/attendances", authMiddleware, wrapAsync(listEventAttendancesHandler));
router.patch(
  "/:id/attendances/:uid",
  authMiddleware,
  requireRole("Admin"),
  wrapAsync(patchEventAttendanceHandler),
);

export default router;
