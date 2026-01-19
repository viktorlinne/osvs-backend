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

// Authenticated: list lodges
/**
 * @openapi
 * /lodges:
 *   get:
 *     tags:
 *       - Lodges
 *     summary: List lodges
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Array of lodges
 */
router.get("/", wrapAsync(listLodgesHandler));

// Get single lodge
/**
 * @openapi
 * /lodges/{id}:
 *   get:
 *     tags:
 *       - Lodges
 *     summary: Get lodge by id
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
 *         description: Lodge object
 */
router.get("/:id", wrapAsync(getLodgeHandler));

// Admin: create lodge
/**
 * @openapi
 * /lodges:
 *   post:
 *     tags:
 *       - Lodges
 *     summary: Create a lodge (Admin only)
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
 *         description: Lodge created
 */
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
