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

import { sendError } from "../utils/response";
import { parseNumericParam, parsePositiveQueryNumber, unwrapValidation } from "./helpers/request";
import { uploadImageAndPersist } from "./helpers/storage";

const DEFAULT_POSTS_PAGE = 1;
const DEFAULT_POSTS_PAGE_SIZE = 24;
const MAX_POSTS_PAGE_SIZE = 100;

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

  const page = parsePositiveQueryNumber(query.page, DEFAULT_POSTS_PAGE);
  const pageSize = parsePositiveQueryNumber(
    query.pageSize,
    DEFAULT_POSTS_PAGE_SIZE,
    MAX_POSTS_PAGE_SIZE,
  );

  const result = await postsService.listPosts(normalizedLodgeIds, title, { page, pageSize });
  const withUrls = await Promise.all(
    result.posts.map(async (r) => ({
      id: r.id,
      title: r.title,
      pictureUrl: await getPublicUrl(r.picture ?? STORAGE_KEYS.POST_PLACEHOLDER),
      description: r.description ? String(r.description).slice(0, 200) : "",
    })),
  );

  return res.status(200).json({
    posts: withUrls,
    page: result.page,
    pageSize: result.pageSize,
    total: result.total,
    totalPages: result.totalPages,
  });
}

export async function listPublicumPostsPublicHandler(
  _req: AuthenticatedRequest,
  res: Response,
  _next: NextFunction,
) {
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
  const parsed = unwrapValidation(res, validateCreatePostBody(req.body));
  if (!parsed) return;

  const { title, description, lodgeIds = [], publicum } = parsed;

  const id = req.file
    ? await uploadImageAndPersist(req.file, {
        folder: STORAGE_BUCKETS.POSTS,
        prefix: STORAGE_PREFIXES.POST,
        size: { width: 800, height: 600 },
      }, (pictureKey) =>
        postsService.createPost(title, description, publicum, pictureKey, lodgeIds),
      )
    : await postsService.createPost(title, description, publicum, STORAGE_KEYS.POST_PLACEHOLDER, lodgeIds);

  return res.status(201).json({ success: true, id });
}

export async function updatePostHandler(
  req: AuthenticatedRequest & { file?: Request["file"] },
  res: Response,
  _next: NextFunction,
) {
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



  return res.status(200).json({ success: true });
}

export async function deletePostHandler(
  req: AuthenticatedRequest,
  res: Response,
  _next: NextFunction,
) {
  const postId = parseNumericParam(res, req.params.id, "Ogiltigt inläggs-ID");
  if (postId === null) return;

  await postsService.deletePostAtomic(postId);

  return res.status(200).json({ success: true });
}
