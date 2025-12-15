import express from "express";
import {
  listPostsHandler,
  getPostHandler,
  createPostHandler,
  updatePostHandler,
} from "../controllers/postsController";
import { wrapAsync } from "../middleware/asyncHandler";
import { validateParams } from "../middleware/validate";
import { idParamSchema } from "../validators/params";
import authMiddleware from "../middleware/auth";
import { requireRole } from "../middleware/authorize";
import { UserRole } from "../types/auth";
import { uploadProfilePicture } from "../utils/fileUpload";
import { validateBody } from "../middleware/validate";
import { createPostSchema, updatePostSchema } from "../validators/posts";

const router = express.Router();

// Authenticated list posts
router.get("/", authMiddleware, wrapAsync(listPostsHandler));

// Authenticated get post by id
router.get(
  "/:id",
  authMiddleware,
  validateParams(idParamSchema),
  wrapAsync(getPostHandler)
);

// Editor/Admin create post
router.post(
  "/",
  authMiddleware,
  requireRole(UserRole.Admin, UserRole.Editor),
  uploadProfilePicture,
  validateBody(createPostSchema),
  wrapAsync(createPostHandler)
);

// Editor/Admin update post (atomic)
router.put(
  "/:id",
  authMiddleware,
  requireRole(UserRole.Admin, UserRole.Editor),
  uploadProfilePicture,
  validateBody(updatePostSchema),
  wrapAsync(updatePostHandler)
);

export default router;
