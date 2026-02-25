import type { NextFunction, Response } from "express";
import type { Express } from "express";
import type { AuthenticatedRequest } from "../types/auth";
import type {
  ListPostsQuery,
  CreatePostBody,
  UpdatePostBody,
} from "@osvs/schemas";
import { createPostSchema } from "@osvs/schemas";
import { formatZodIssues } from "../utils/formatZod";
import * as postsService from "../services";
import {
  uploadToStorage,
  getPublicUrl,
  deleteProfilePicture,
} from "../utils/fileUpload";
import logger from "../utils/logger";
import { getCached, setCached, delPattern } from "../infra/cache";
import { sendError } from "../utils/response";

export async function listPostsHandler(
  _req: AuthenticatedRequest,
  res: Response,
  _next: NextFunction,
) {
  const query = _req.query as ListPostsQuery;
  const rawLimit = Number(query.limit ?? 20);
  const rawOffset = Number(query.offset ?? 0);
  const limit = Number.isFinite(rawLimit)
    ? Math.min(Math.max(1, rawLimit), 100)
    : 20;
  const offset =
    Number.isFinite(rawOffset) && rawOffset >= 0 ? Math.floor(rawOffset) : 0;
  const lodgeFilterInput = query.lodgeId;
  const lodgeIds = (Array.isArray(lodgeFilterInput)
    ? lodgeFilterInput
    : lodgeFilterInput != null
      ? [lodgeFilterInput]
      : []
  )
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value));
  const normalizedLodgeIds = lodgeIds.length ? lodgeIds : undefined;
  const cacheKey = `posts:limit:${limit}:offset:${offset}:lodges:${
    normalizedLodgeIds?.join("_") ?? "all"
  }`;
  try {
    const cached = await getCached(cacheKey);
    if (cached && Array.isArray(cached as unknown[])) {
      return res.status(200).json({ posts: cached });
    }
    const rows = await postsService.listPosts(limit, offset, normalizedLodgeIds);
    // Resolve public URLs for pictures if present
    const withUrls = await Promise.all(
      rows.map(async (r) => ({
        id: r.id,
        title: r.title,
        // Use a shared post placeholder when no picture is set
        pictureUrl: await getPublicUrl(
          r.picture ?? "posts/postPlaceholder.png",
        ),
        // avoid returning large description in list responses
        description: r.description ? String(r.description).slice(0, 200) : "",
      })),
    );

    // store cache (best-effort)
    void setCached(cacheKey, withUrls);
    return res.status(200).json({ posts: withUrls });
  } catch (err) {
    const requestId =
      res.locals.requestId ??
      (_req as unknown as { requestId?: string }).requestId;
    logger.error({ msg: "Failed to list posts", err, requestId });
    return res.status(500).json({
      error: "InternalError",
      message: "Misslyckades att lista inlägg",
      requestId,
    });
  }
}

export async function getPostHandler(
  req: AuthenticatedRequest,
  res: Response,
  _next: NextFunction,
) {
  const postId = Number(req.params.id);
  if (!Number.isFinite(postId))
    return sendError(res, 400, "Ogiltigt inläggs-ID");

  const post = await postsService.getPostById(postId);
  if (!post) return sendError(res, 404, "Inlägg hittades inte");

  const pictureUrl = await getPublicUrl(
    post.picture ?? "posts/postPlaceholder.png",
  );
  return res.status(200).json({ post: { ...post, pictureUrl } });
}

export async function createPostHandler(
  req: AuthenticatedRequest & { file?: Express.Multer.File },
  res: Response,
  _next: NextFunction,
) {
<<<<<<< HEAD
  const parsed = createPostSchema.safeParse(req.body);
  if (!parsed.success)
    return sendError(res, 400, formatZodIssues(parsed.error.issues));
  const { title, description } = parsed.data as CreatePostBody;
=======
  const { title, description, lodgeIds: lodgeInput } = req.body as CreatePostBody;
  const lodgeIds = parseNumericIds(lodgeInput);
  if (!title || !description)
    return res.status(400).json({ error: "Saknar titel eller beskrivning" });
>>>>>>> 1429d2680002376f163fed953673fb42c0e31c5c

  // Upload image (optional) and process it as a post image (resized + webp)
  const file = req.file;
  let pictureKey: string | null = null;
  if (file) {
    const key = await uploadToStorage(file, {
      folder: "posts",
      prefix: "post_",
      size: { width: 800, height: 600 },
    });
    if (!key) return sendError(res, 500, "Misslyckades att lagra bilden");
    pictureKey = key;
  }

  const id = await postsService.createPost(
    title,
    description,
    pictureKey,
    lodgeIds
  );
  // invalidate list caches
  void delPattern("posts:*");
  return res.status(201).json({ success: true, id });
}

export async function updatePostHandler(
  req: AuthenticatedRequest & { file?: Express.Multer.File },
  res: Response,
  _next: NextFunction,
) {
  let newKey: string | null = null;
  try {
    const postId = Number(req.params.id);
    if (!Number.isFinite(postId))
      return sendError(res, 400, "Ogiltigt inläggs-ID");

<<<<<<< HEAD
    const { title, description } = req.body as UpdatePostBody;
    if (!title && !description && !req.file) {
      return sendError(res, 400, "Inget att uppdatera");
=======
    const body = req.body as UpdatePostBody & Record<string, unknown>;
    const { title, description } = body;
    const hasLodgeInput = Object.prototype.hasOwnProperty.call(body, "lodgeIds");
    const lodgeIds = hasLodgeInput ? parseNumericIds(body.lodgeIds) : undefined;
    if (!title && !description && !req.file && !hasLodgeInput) {
      return res.status(400).json({ error: "Inget att uppdatera" });
>>>>>>> 1429d2680002376f163fed953673fb42c0e31c5c
    }

    // If new file uploaded, process it as post image
    if (req.file) {
      const key = await uploadToStorage(req.file, {
        folder: "posts",
        prefix: "post_",
        size: { width: 800, height: 600 },
      });
      if (!key) return sendError(res, 500, "Misslyckades att lagra bilden");
      newKey = key;
    }

    await postsService.updatePostAtomic(
      postId,
      title ?? null,
      description ?? null,
      newKey,
<<<<<<< HEAD
=======
      lodgeIds,
      hasLodgeInput
>>>>>>> 1429d2680002376f163fed953673fb42c0e31c5c
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

function parseNumericIds(input: unknown): number[] {
  if (input == null) return [];
  const rawValues = Array.isArray(input) ? input : [input];
  const flattened = rawValues.flatMap((value) => {
    if (typeof value === "string") {
      return value
        .split(",")
        .map((part) => part.trim())
        .filter((part) => part.length > 0);
    }
    return [value];
  });
  const normalized = flattened
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value) && value > 0)
    .map((value) => Math.floor(value));
  return Array.from(new Set(normalized));
}
