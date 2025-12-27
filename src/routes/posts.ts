import express from "express";
import {
  listPostsHandler,
  getPostHandler,
  createPostHandler,
  updatePostHandler,
} from "../controllers/postsController";
import { wrapAsync } from "../middleware/asyncHandler";
// params validation removed; controllers will handle ID parsing
import authMiddleware from "../middleware/auth";
import { requireRole } from "../middleware/authorize";

import { uploadProfilePicture } from "../utils/fileUpload";
// body validators removed; controllers expect typed DTOs

const router = express.Router();

// Authenticated list posts
router.get("/", authMiddleware, wrapAsync(listPostsHandler));

// Authenticated get post by id
router.get("/:id", authMiddleware, wrapAsync(getPostHandler));

// Editor/Admin create post
router.post(
  "/",
  authMiddleware,
  requireRole("Admin", "Editor"),
  uploadProfilePicture,
  wrapAsync(createPostHandler)
);

// Editor/Admin update post (atomic)
router.put(
  "/:id",
  authMiddleware,
  requireRole("Admin", "Editor"),
  uploadProfilePicture,
  wrapAsync(updatePostHandler)
);

export default router;
