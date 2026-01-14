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
  wrapAsync(getEventStatsHandler)
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
router.post(
  "/:id/rsvp",
  authMiddleware,
  validateParams,
  wrapAsync(rsvpHandler)
);

// Get current user's RSVP for an event
router.get("/:id/rsvp", authMiddleware, wrapAsync(getUserRsvpHandler));

export default router;
