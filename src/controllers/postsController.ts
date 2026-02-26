import type { NextFunction, Request, Response } from "express";
import type { AuthenticatedRequest } from "../types/auth";
import type { ListPostsQuery, UpdatePostBody } from "../types";
import { parseNumericIds, validateCreatePostBody } from "../validators";
import * as postsService from "../services/postsService";
import {
  uploadToStorage,
  getPublicUrl,
  deleteProfilePicture,
} from "../utils/fileUpload";
import logger from "../utils/logger";
import { getCached, setCached, delPattern } from "../infra/cache";
import { sendError } from "../utils/response";
import { parseNumericParam, unwrapValidation } from "./helpers/request";

export async function listPostsHandler(
  _req: AuthenticatedRequest,
  res: Response,
  _next: NextFunction,
) {
  const query = _req.query as ListPostsQuery;

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
  const title =
    typeof query.title === "string" && query.title.trim().length > 0
      ? query.title.trim()
      : undefined;

  const cacheKey = `posts:lodges:${normalizedLodgeIds?.join("_") ?? "all"}:title:${
    title ? encodeURIComponent(title.toLowerCase()) : "all"
  }`;

  try {
    const cached = await getCached(cacheKey);
    if (cached && Array.isArray(cached as unknown[])) {
      return res.status(200).json({ posts: cached });
    }

    const rows = await postsService.listPosts(normalizedLodgeIds, title);
    const withUrls = await Promise.all(
      rows.map(async (r) => ({
        id: r.id,
        title: r.title,
        pictureUrl: await getPublicUrl(r.picture ?? "posts/postPlaceholder.png"),
        description: r.description ? String(r.description).slice(0, 200) : "",
      })),
    );

    void setCached(cacheKey, withUrls);
    return res.status(200).json({ posts: withUrls });
  } catch (err) {
    const requestId = res.locals.requestId ?? _req.requestId;
    logger.error({ msg: "Failed to list posts", err, requestId });
    return res.status(500).json({
      error: "InternalError",
      message: "Misslyckades att lista inlagg",
      requestId,
    });
  }
}

export async function getPostHandler(
  req: AuthenticatedRequest,
  res: Response,
  _next: NextFunction,
) {
  const postId = parseNumericParam(res, req.params.id, "Ogiltigt inlaggs-ID");
  if (postId === null) return;

  const post = await postsService.getPostById(postId);
  if (!post) return sendError(res, 404, "Inlagg hittades inte");

  const pictureUrl = await getPublicUrl(post.picture ?? "posts/postPlaceholder.png");
  return res.status(200).json({ post: { ...post, pictureUrl } });
}

export async function createPostHandler(
  req: AuthenticatedRequest & { file?: Request["file"] },
  res: Response,
  _next: NextFunction,
) {
  const parsed = unwrapValidation(res, validateCreatePostBody(req.body));
  if (!parsed) return;

  const { title, description, lodgeIds = [] } = parsed;

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

  const id = await postsService.createPost(title, description, pictureKey, lodgeIds);
  void delPattern("posts:*");
  return res.status(201).json({ success: true, id });
}

export async function updatePostHandler(
  req: AuthenticatedRequest & { file?: Request["file"] },
  res: Response,
  _next: NextFunction,
) {
  let newKey: string | null = null;
  try {
    const postId = parseNumericParam(res, req.params.id, "Ogiltigt inlaggs-ID");
    if (postId === null) return;

    const body = req.body as UpdatePostBody & Record<string, unknown>;
    const titleRaw = body.title;
    const descriptionRaw = body.description;

    if (
      Object.prototype.hasOwnProperty.call(body, "title") &&
      typeof titleRaw !== "string"
    ) {
      return sendError(res, 400, "title must be a string");
    }

    if (
      Object.prototype.hasOwnProperty.call(body, "description") &&
      typeof descriptionRaw !== "string"
    ) {
      return sendError(res, 400, "description must be a string");
    }

    const title = typeof titleRaw === "string" ? titleRaw : undefined;
    const description = typeof descriptionRaw === "string" ? descriptionRaw : undefined;

    const hasLodgeInput = Object.prototype.hasOwnProperty.call(body, "lodgeIds");
    const lodgeIds = hasLodgeInput ? parseNumericIds(body.lodgeIds) : undefined;

    if (!title && !description && !req.file && !hasLodgeInput) {
      return sendError(res, 400, "Inget att uppdatera");
    }

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
      lodgeIds,
      hasLodgeInput,
    );

    void delPattern("posts:*");

    return res.status(200).json({ success: true });
  } catch (err) {
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
