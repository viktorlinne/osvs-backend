import type { NextFunction, Request, Response } from "express";
import type { AuthenticatedRequest } from "../types/auth";
import type { ListPostsQuery, UpdatePostBody } from "../types";
import {
  parseNumericIds,
  parsePublicumBoolean,
  validateCreatePostBody,
} from "../validators";
import * as postsService from "../services/postsService";
import {
  getPublicUrl,
} from "../utils/fileUpload";
import { STORAGE_BUCKETS, STORAGE_KEYS, STORAGE_PREFIXES } from "../config/storage";
import { getCached, setCached, delPattern } from "../infra/cache";
import { sendError } from "../utils/response";
import { parseNumericParam, unwrapValidation } from "./helpers/request";
import { uploadImageAndPersist } from "./helpers/storage";

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

  const cached = await getCached(cacheKey);
  if (cached && Array.isArray(cached as unknown[])) {
    return res.status(200).json({ posts: cached });
  }

  const rows = await postsService.listPosts(normalizedLodgeIds, title);
  const withUrls = await Promise.all(
    rows.map(async (r) => ({
      id: r.id,
      title: r.title,
      pictureUrl: await getPublicUrl(r.picture ?? STORAGE_KEYS.POST_PLACEHOLDER),
      description: r.description ? String(r.description).slice(0, 200) : "",
    })),
  );

  void setCached(cacheKey, withUrls);
  return res.status(200).json({ posts: withUrls });
}

export async function listPublicumPostsPublicHandler(
  _req: AuthenticatedRequest,
  res: Response,
  _next: NextFunction,
) {
  const cacheKey = "posts:publicum";
  const cached = await getCached(cacheKey);
  if (cached && Array.isArray(cached as unknown[])) {
    return res.status(200).json({ posts: cached });
  }

  const rows = await postsService.listPublicumPosts();
  const dto = await Promise.all(
    rows.map(async (r) => ({
      id: r.id,
      title: r.title,
      createdAt: r.createdAt,
      description: r.description,
      pictureUrl: await getPublicUrl(r.picture ?? STORAGE_KEYS.POST_PLACEHOLDER),
    })),
  );
  void setCached(cacheKey, dto);
  return res.status(200).json({ posts: dto });
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

  const pictureUrl = await getPublicUrl(post.picture ?? STORAGE_KEYS.POST_PLACEHOLDER);
  return res.status(200).json({ post: { ...post, pictureUrl } });
}

export async function createPostHandler(
  req: AuthenticatedRequest & { file?: Request["file"] },
  res: Response,
  _next: NextFunction,
) {
  try {
    const parsed = unwrapValidation(res, validateCreatePostBody(req.body));
    if (!parsed) return;

    const { title, description, lodgeIds = [], publicum } = parsed;
    if (!req.file) {
      return sendError(res, 400, "Formuläret innehåller fel", {
        fields: { picture: "Bild är obligatorisk" },
      });
    }

    const id = await uploadImageAndPersist(req.file, {
      folder: STORAGE_BUCKETS.POSTS,
      prefix: STORAGE_PREFIXES.POST,
      size: { width: 800, height: 600 },
    }, async (pictureKey) =>
      postsService.createPost(
        title,
        description,
        publicum,
        pictureKey,
        lodgeIds,
      ),
    );

    void delPattern("posts:*");
    return res.status(201).json({ success: true, id });
  } catch (err) {
    throw err;
  }
}

export async function updatePostHandler(
  req: AuthenticatedRequest & { file?: Request["file"] },
  res: Response,
  _next: NextFunction,
) {
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
      return sendError(res, 400, "Formuläret innehåller fel", {
        fields: { title: "Ogiltig titel" },
      });
    }

    if (
      Object.prototype.hasOwnProperty.call(body, "description") &&
      typeof descriptionRaw !== "string"
    ) {
      return sendError(res, 400, "Formuläret innehåller fel", {
        fields: { description: "Ogiltig beskrivning" },
      });
    }

    const title = typeof titleRaw === "string" ? titleRaw : undefined;
    const description = typeof descriptionRaw === "string" ? descriptionRaw : undefined;

    const hasLodgeInput = Object.prototype.hasOwnProperty.call(body, "lodgeIds");
    const lodgeIds = hasLodgeInput ? parseNumericIds(body.lodgeIds) : undefined;
    const hasPublicumInput = Object.prototype.hasOwnProperty.call(body, "publicum");

    let publicum: boolean | undefined = undefined;
    if (hasPublicumInput) {
      const parsedPublicum = parsePublicumBoolean(
        (body as Record<string, unknown>).publicum,
      );
      if (!parsedPublicum.ok) {
        return sendError(
          res,
          400,
          parsedPublicum.message ?? parsedPublicum.errors,
          parsedPublicum.fields ? { fields: parsedPublicum.fields } : undefined,
        );
      }
      publicum = parsedPublicum.data;
    }

    if (!title && !description && !req.file && !hasLodgeInput && !hasPublicumInput) {
      return sendError(res, 400, "Det finns inga ändringar att spara");
    }

    if (req.file) {
      await uploadImageAndPersist(req.file, {
        folder: STORAGE_BUCKETS.POSTS,
        prefix: STORAGE_PREFIXES.POST,
        size: { width: 800, height: 600 },
      }, async (pictureKey) => {
        await postsService.updatePostAtomic(
          postId,
          title ?? null,
          description ?? null,
          pictureKey,
          publicum,
          lodgeIds,
          hasLodgeInput,
        );
        return true;
      });
    } else {
      await postsService.updatePostAtomic(
        postId,
        title ?? null,
        description ?? null,
        null,
        publicum,
        lodgeIds,
        hasLodgeInput,
      );
    }

    void delPattern("posts:*");

    return res.status(200).json({ success: true });
  } catch (err) {
    throw err;
  }
}

export async function deletePostHandler(
  req: AuthenticatedRequest,
  res: Response,
  _next: NextFunction,
) {
  const postId = parseNumericParam(res, req.params.id, "Ogiltigt inläggs-ID");
  if (postId === null) return;

  await postsService.deletePostAtomic(postId);
  void delPattern("posts:*");
  return res.status(200).json({ success: true });
}
