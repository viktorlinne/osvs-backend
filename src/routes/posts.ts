import express from "express";
import {
  listPostsHandler,
  getPostHandler,
  createPostHandler,
  updatePostHandler,
} from "../controllers/postsController";
import authMiddleware from "../middleware/auth";
import { requireRole } from "../middleware/authorize";
import { UserRole } from "../types/auth";
import { uploadProfilePicture } from "../utils/fileUpload";
import { validateBody } from "../middleware/validate";
import { createPostSchema, updatePostSchema } from "./schemas/posts";

const router = express.Router();

// Authenticated list posts
router.get("/", authMiddleware, listPostsHandler);

// Authenticated get post by id
router.get("/:id", authMiddleware, getPostHandler);

// Editor/Admin create post
router.post(
  "/",
  authMiddleware,
  requireRole(UserRole.Admin, UserRole.Editor),
  uploadProfilePicture,
  validateBody(createPostSchema),
  createPostHandler
);

// Editor/Admin update post (atomic)
router.put(
  "/:id",
  authMiddleware,
  requireRole(UserRole.Admin, UserRole.Editor),
  uploadProfilePicture,
  validateBody(updatePostSchema),
  updatePostHandler
);

export default router;
