import express from "express";
import usersController from "../controllers/usersController";
import authMiddleware from "../middleware/auth";
import { uploadProfilePicture } from "../utils/fileUpload";

const router = express.Router();

// Minimal placeholder routes used in tests. Expand as needed.
router.get("/me", authMiddleware, usersController.placeholderMe);

// Update current user's profile picture
router.post(
  "/me/picture",
  authMiddleware,
  uploadProfilePicture,
  usersController.updatePictureHandler
);

export default router;
