import { Router } from "express";
import { claimUploadHandler } from "../controllers/uploadsController";
import { authMiddleware } from "../middleware/auth";
import wrapAsync from "../middleware/asyncHandler";

const router = Router();

// Claim an already-uploaded object (client-side direct uploads to Supabase)
/**
 * @openapi
 * /uploads/claim:
 *   post:
 *     tags:
 *       - Uploads
 *     summary: Claim an uploaded object (associate with a model)
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Claimed
 */
router.post("/claim", authMiddleware, wrapAsync(claimUploadHandler));

export default router;
