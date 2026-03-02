import type { NextFunction, Request, Response } from "express";
import type { AuthenticatedRequest } from "../types/auth";
import type { ListRevisionsQuery } from "../types";
import * as revisionsService from "../services/revisionsService";
import {
  deleteFromStorage,
  getPublicUrl,
  uploadRawToStorage,
} from "../utils/fileUpload";
import logger from "../utils/logger";
import { sendError } from "../utils/response";

function parseOptionalYear(value: unknown): number | null {
  if (value === undefined || value === null || String(value).trim().length === 0) {
    return null;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1900 || parsed > 3000) {
    return Number.NaN;
  }
  return parsed;
}

function parseOptionalLodgeId(value: unknown): number | null {
  if (value === undefined || value === null || String(value).trim().length === 0) {
    return null;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return Number.NaN;
  }
  return parsed;
}

export async function listRevisionsHandler(
  req: AuthenticatedRequest,
  res: Response,
  _next: NextFunction,
) {
  const query = req.query as ListRevisionsQuery;
  const year = parseOptionalYear(query.year);
  if (Number.isNaN(year)) {
    return sendError(res, 400, "Invalid year filter");
  }

  const lodgeId = parseOptionalLodgeId(query.lodgeId);
  if (Number.isNaN(lodgeId)) {
    return sendError(res, 400, "Invalid lodge filter");
  }

  const rows = await revisionsService.listRevisions({
    year: year ?? undefined,
    lodgeId: lodgeId ?? undefined,
  });

  const withUrls = await Promise.all(
    rows.map(async (row) => ({
      ...row,
      pictureUrl: await getPublicUrl(row.picture ?? "revisions/revisionPlaceholder.pdf"),
    })),
  );

  return res.status(200).json({ revisions: withUrls });
}

export async function createRevisionHandler(
  req: AuthenticatedRequest & { file?: Request["file"] },
  res: Response,
  _next: NextFunction,
) {
  const body = req.body as Record<string, unknown>;
  const title = String(body.title ?? "").trim();
  const year = Number(body.year);
  const lodgeId = Number(body.lodgeId);

  if (!title) return sendError(res, 400, "Title is required");
  if (!Number.isInteger(year) || year < 1900 || year > 3000) {
    return sendError(res, 400, "Year must be a valid year");
  }
  if (!Number.isInteger(lodgeId) || lodgeId <= 0) {
    return sendError(res, 400, "Lodge is required");
  }
  if (!req.file) return sendError(res, 400, "File is required");

  let storageKey: string | null = null;
  try {
    storageKey = await uploadRawToStorage(req.file, {
      bucket: "revisions",
      prefix: "revision_",
      fallbackExtension: ".pdf",
      allowedExtensions: [".pdf"],
    });
    if (!storageKey) {
      return sendError(res, 500, "Failed to upload file");
    }

    const id = await revisionsService.createRevision(lodgeId, title, year, storageKey);
    return res.status(201).json({ success: true, id });
  } catch (err) {
    if (storageKey) {
      try {
        await deleteFromStorage(storageKey);
      } catch {
        // ignore cleanup failure
      }
    }
    logger.error("Failed to create revision", err);
    return sendError(res, 500, "Failed to create revision");
  }
}

export default {
  listRevisionsHandler,
  createRevisionHandler,
};
