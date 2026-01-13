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
/**
 * @openapi
 * /posts:
 *   get:
 *     tags:
 *       - Posts
 *     summary: List posts
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Array of posts
 */
router.get("/", authMiddleware, wrapAsync(listPostsHandler));

// Authenticated get post by id
/**
 * @openapi
 * /posts/{id}:
 *   get:
 *     tags:
 *       - Posts
 *     summary: Get post by id
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
 *         description: Post object
 */
router.get("/:id", authMiddleware, wrapAsync(getPostHandler));

// Editor/Admin create post
/**
 * @openapi
 * /posts:
 *   post:
 *     tags:
 *       - Posts
 *     summary: Create a post (Editor/Admin)
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *     responses:
 *       201:
 *         description: Post created
 */
router.post(
  "/",
  authMiddleware,
  requireRole("Admin", "Editor"),
  uploadProfilePicture,
  wrapAsync(createPostHandler)
);

// Editor/Admin update post (atomic)
/**
 * @openapi
 * /posts/{id}:
 *   put:
 *     tags:
 *       - Posts
 *     summary: Update a post (Editor/Admin)
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
 *         multipart/form-data:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Post updated
 */
router.put(
  "/:id",
  authMiddleware,
  requireRole("Admin", "Editor"),
  uploadProfilePicture,
  wrapAsync(updatePostHandler)
);

export default router;
