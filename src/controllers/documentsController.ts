import type { NextFunction, Request, Response } from "express";
import type { AuthenticatedRequest } from "../types/auth";
import * as documentsService from "../services/documentsService";
import { getPublicUrl } from "../utils/fileUpload";
import { STORAGE_BUCKETS, STORAGE_KEYS, STORAGE_PREFIXES } from "../config/storage";
import logger from "../utils/logger";
import { sendError } from "../utils/response";
import { uploadRawAndPersist } from "./helpers/storage";

export async function listDocumentsHandler(
  _req: AuthenticatedRequest,
  res: Response,
  _next: NextFunction,
) {
  const rows = await documentsService.listDocuments();
  const withUrls = await Promise.all(
    rows.map(async (row) => ({
      ...row,
      pictureUrl: await getPublicUrl(
        row.picture ?? STORAGE_KEYS.DOCUMENT_PLACEHOLDER,
      ),
    })),
  );
  return res.status(200).json({ documents: withUrls });
}

export async function createDocumentHandler(
  req: AuthenticatedRequest & { file?: Request["file"] },
  res: Response,
  _next: NextFunction,
) {
  const body = req.body as Record<string, unknown>;
  const title = String(body.title ?? "").trim();

  if (!title) return sendError(res, 400, "Title is required");
  if (!req.file) return sendError(res, 400, "File is required");

  try {
    const id = await uploadRawAndPersist(
      req.file,
      {
        bucket: STORAGE_BUCKETS.DOCUMENTS,
        prefix: STORAGE_PREFIXES.DOCUMENT,
        fallbackExtension: ".pdf",
        allowedExtensions: [".pdf"],
      },
      async (storageKey) => documentsService.createDocument(title, storageKey),
    );
    if (id === null) {
      return sendError(res, 500, "Failed to upload file");
    }

    return res.status(201).json({ success: true, id });
  } catch (err) {
    logger.error("Failed to create document", err);
    return sendError(res, 500, "Failed to create document");
  }
}

export default {
  listDocumentsHandler,
  createDocumentHandler,
};
