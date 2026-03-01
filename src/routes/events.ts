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
  getEventStatsHandler,
  rsvpHandler,
  getUserRsvpHandler,
  getUserFoodHandler,
  bookFoodHandler,
  listEventAttendancesHandler,
  patchEventAttendanceHandler,
} from "../controllers/eventsController";
import { wrapAsync } from "../middleware/asyncHandler";

const router = express.Router();

// Public listing (authenticated)
/**
 * @openapi
 * /events:
 *   get:
 *     tags:
 *       - Events
 *     summary: List events
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Array of events
 */
router.get("/", authMiddleware, wrapAsync(listEventsHandler));

// Public upcoming events for homepage calendar
router.get("/upcoming", wrapAsync(listUpcomingEventsPublicHandler));

// Events visible to current user (by lodge membership)
/**
 * @openapi
 * /events/mine:
 *   get:
 *     tags:
 *       - Events
 *     summary: Events visible to current user
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Array of events for user
 */
router.get("/mine", authMiddleware, wrapAsync(listForUserHandler));

// Get single event
/**
 * @openapi
 * /events/{id}:
 *   get:
 *     tags:
 *       - Events
 *     summary: Get event by id
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Event object
 */
router.get("/:id", authMiddleware, wrapAsync(getEventHandler));

// Get lodges linked to an event
/**
 * @openapi
 * /events/{id}/lodges:
 *   get:
 *     tags:
 *       - Events
 *     summary: Get lodges linked to an event
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Array of lodges
 */
router.get("/:id/lodges", authMiddleware, wrapAsync(listEventLodgesHandler));

// Admin-only: event statistics
router.get(
  "/:id/stats",
  authMiddleware,
  requireRole("Admin"),
  wrapAsync(getEventStatsHandler),
);

// Create (Admin/Editor)
/**
 * @openapi
 * /events:
 *   post:
 *     tags:
 *       - Events
 *     summary: Create an event (Admin/Editor)
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       201:
 *         description: Event created
 */
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

// RSVP: set current user's RSVP for event (going / not-going)
/**
 * @openapi
 * /events/{id}/rsvp:
 *   post:
 *     tags:
 *       - Events
 *     summary: Set current user's RSVP for event
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *     responses:
 *       200:
 *         description: RSVP recorded
 */
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
