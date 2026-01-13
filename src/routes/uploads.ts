import { Router } from "express";
import { claimUploadHandler } from "../controllers/uploadsController";
import { authMiddleware } from "../middleware/auth";
import wrapAsync from "../middleware/asyncHandler";

const router = Router();

// Claim an already-uploaded object (client-side direct uploads to Supabase)
router.post("/claim", authMiddleware, wrapAsync(claimUploadHandler));

export default router;
