import express from "express";
import {
  listPostsHandler,
  listPublicumPostsPublicHandler,
  getPostHandler,
  createPostHandler,
  updatePostHandler,
  deletePostHandler,
} from "../controllers/postsController";
import { wrapAsync } from "../middleware/asyncHandler";
// params validation removed; controllers will handle ID parsing
import authMiddleware from "../middleware/auth";
import { requireRole } from "../middleware/authorize";

import { uploadProfilePicture } from "../utils/fileUpload";
// body validators removed; controllers expect typed DTOs

const router = express.Router();

router.get("/", authMiddleware, wrapAsync(listPostsHandler));

// Public list of publicum posts
router.get("/publicum", wrapAsync(listPublicumPostsPublicHandler));

router.get("/:id", authMiddleware, wrapAsync(getPostHandler));

router.post(
  "/",
  authMiddleware,
  requireRole("Admin", "Editor"),
  uploadProfilePicture,
  wrapAsync(createPostHandler)
);

router.put(
  "/:id",
  authMiddleware,
  requireRole("Admin", "Editor"),
  uploadProfilePicture,
  wrapAsync(updatePostHandler)
);

router.delete(
  "/:id",
  authMiddleware,
  requireRole("Admin"),
  wrapAsync(deletePostHandler),
);

export default router;
