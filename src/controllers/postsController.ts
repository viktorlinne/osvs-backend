import type { NextFunction, Response } from "express";
import type { Express } from "express";
import type { AuthenticatedRequest } from "../types/auth";
import type { ListPostsQuery, CreatePostBody, UpdatePostBody } from "../schemas/postsSchema";
import * as postsService from "../services";
import {
  uploadToStorage,
  getPublicUrl,
  deleteProfilePicture,
} from "../utils/fileUpload";
import logger from "../utils/logger";
import { getCached, setCached, delPattern } from "../infra/cache";

export async function listPostsHandler(
  _req: AuthenticatedRequest,
  res: Response,
  _next: NextFunction
) {
  const query = _req.query as ListPostsQuery;
  const rawLimit = Number(query.limit ?? 20);
  const rawOffset = Number(query.offset ?? 0);
  const limit = Number.isFinite(rawLimit)
    ? Math.min(Math.max(1, rawLimit), 100)
    : 20;
  const offset =
    Number.isFinite(rawOffset) && rawOffset >= 0 ? Math.floor(rawOffset) : 0;
  try {
    const rows = await postsService.listPosts(limit, offset);
    // Cache key includes pagination so front-end can page deterministically
    const cacheKey = `posts:limit:${limit}:offset:${offset}`;
    const cached = await getCached(cacheKey);
    if (cached && Array.isArray(cached as unknown[])) {
      return res.status(200).json({ posts: cached });
    }
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

    // store cache (best-effort)
    void setCached(cacheKey, withUrls);
    return res.status(200).json({ posts: withUrls });
  } catch (err) {
    const requestId =
      res.locals.requestId ?? (_req as unknown as { requestId?: string }).requestId;
    logger.error({ msg: "Failed to list posts", err, requestId });
    return res.status(500).json({ error: "InternalError", message: "Misslyckades att lista inlägg", requestId });
  }
  
}

export async function getPostHandler(
  req: AuthenticatedRequest,
  res: Response,
  _next: NextFunction
) {
  const postId = Number(req.params.id);
  if (!Number.isFinite(postId))
    return res.status(400).json({ error: "Ogiltigt inläggs-ID" });

  const post = await postsService.getPostById(postId);
  if (!post) return res.status(404).json({ error: "Inlägg hittades inte" });

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
  const { title, description } = req.body as CreatePostBody;
  if (!title || !description)
    return res.status(400).json({ error: "Saknar titel eller beskrivning" });

  // Upload image (optional) and process it as a post image (resized + webp)
  const file = req.file;
  let pictureKey: string | null = null;
  if (file) {
    const key = await uploadToStorage(file, {
      folder: "posts",
      prefix: "post_",
      size: { width: 800, height: 600 },
    });
    if (!key) return res.status(500).json({ error: "Misslyckades att lagra bilden" });
    pictureKey = key;
  }

  const id = await postsService.createPost(title, description, pictureKey);
  // invalidate list caches
  void delPattern("posts:*");
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
      return res.status(400).json({ error: "Ogiltigt inläggs-ID" });

    const { title, description } = req.body as UpdatePostBody;
    if (!title && !description && !req.file) {
      return res.status(400).json({ error: "Inget att uppdatera" });
    }

    // If new file uploaded, process it as post image
    if (req.file) {
      const key = await uploadToStorage(req.file, {
        folder: "posts",
        prefix: "post_",
        size: { width: 800, height: 600 },
      });
      if (!key) return res.status(500).json({ error: "Misslyckades att lagra bilden" });
      newKey = key;
    }

    await postsService.updatePostAtomic(
      postId,
      title ?? null,
      description ?? null,
      newKey
    );

    // Invalidate list caches after an update
    void delPattern("posts:*");

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
