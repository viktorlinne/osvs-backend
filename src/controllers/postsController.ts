import type { NextFunction, Response } from "express";
import type { Express } from "express";
import type { AuthenticatedRequest } from "../types/auth";
import * as postsService from "../services/postsService";
import {
  uploadToStorage,
  getPublicUrl,
  deleteProfilePicture,
} from "../utils/fileUpload";

export async function listPostsHandler(
  _req: AuthenticatedRequest,
  res: Response,
  _next: NextFunction
) {
  const query = _req.query as Record<string, unknown>;
  const rawLimit = Number(query.limit ?? 20);
  const rawOffset = Number(query.offset ?? 0);
  const limit = Number.isFinite(rawLimit)
    ? Math.min(Math.max(1, rawLimit), 100)
    : 20;
  const offset =
    Number.isFinite(rawOffset) && rawOffset >= 0 ? Math.floor(rawOffset) : 0;
  const rows = await postsService.listPosts(limit, offset);
  // Resolve public URLs for pictures if present
  const withUrls = await Promise.all(
    rows.map(async (r) => ({
      id: r.id,
      title: r.title,
      // Use a shared post placeholder when no picture is set
      pictureUrl: await getPublicUrl(r.picture ?? "posts/postPlaceholder.png"),
      // avoid returning large description in list responses
      description: r.description ? String(r.description).slice(0, 200) : "",
    }))
  );
  res.status(200).json({ posts: withUrls });
}

export async function getPostHandler(
  req: AuthenticatedRequest,
  res: Response,
  _next: NextFunction
) {
  const postId = Number(req.params.id);
  if (!Number.isFinite(postId))
    return res.status(400).json({ error: "Invalid post id" });

  const post = await postsService.getPostById(postId);
  if (!post) return res.status(404).json({ error: "Post not found" });

  const pictureUrl = await getPublicUrl(
    post.picture ?? "posts/postPlaceholder.png"
  );
  return res.status(200).json({ post: { ...post, pictureUrl } });
}

export async function createPostHandler(
  req: AuthenticatedRequest & { file?: Express.Multer.File },
  res: Response,
  _next: NextFunction
) {
  const { title, description } = req.body as {
    title?: string;
    description?: string;
  };
  if (!title || !description)
    return res.status(400).json({ error: "Missing title or description" });

  // Upload image (optional) and process it as a post image (resized + webp)
  const file = req.file;
  let pictureKey: string | null = null;
  if (file) {
    const key = await uploadToStorage(file, {
      folder: "posts",
      prefix: "post_",
      size: { width: 800, height: 600 },
    });
    if (!key) return res.status(500).json({ error: "Failed to store image" });
    pictureKey = key;
  }

  const id = await postsService.createPost(title, description, pictureKey);
  return res.status(201).json({ success: true, id });
}

export async function updatePostHandler(
  req: AuthenticatedRequest & { file?: Express.Multer.File },
  res: Response,
  _next: NextFunction
) {
  let newKey: string | null = null;
  try {
    const postId = Number(req.params.id);
    if (!Number.isFinite(postId))
      return res.status(400).json({ error: "Invalid post id" });

    const { title, description } = req.body as {
      title?: string;
      description?: string;
    };
    if (!title && !description && !req.file) {
      return res.status(400).json({ error: "Nothing to update" });
    }

    // If new file uploaded, process it as post image
    if (req.file) {
      const key = await uploadToStorage(req.file, {
        folder: "posts",
        prefix: "post_",
        size: { width: 800, height: 600 },
      });
      if (!key) return res.status(500).json({ error: "Failed to store image" });
      newKey = key;
    }

    await postsService.updatePostAtomic(
      postId,
      title ?? null,
      description ?? null,
      newKey
    );

    return res.status(200).json({ success: true });
  } catch (err) {
    // If upload occurred but DB update failed, try to cleanup newKey
    if (newKey) {
      try {
        await deleteProfilePicture(newKey);
      } catch {
        // ignore
      }
    }
    throw err;
  }
}
