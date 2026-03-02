import type { NextFunction, Request, Response } from "express";
import type { AuthenticatedRequest } from "../types/auth";
import * as documentsService from "../services/documentsService";
import {
  deleteFromStorage,
  getPublicUrl,
  uploadRawToStorage,
} from "../utils/fileUpload";
import logger from "../utils/logger";
import { sendError } from "../utils/response";

export async function listDocumentsHandler(
  _req: AuthenticatedRequest,
  res: Response,
  _next: NextFunction,
) {
  const rows = await documentsService.listDocuments();
  const withUrls = await Promise.all(
    rows.map(async (row) => ({
      ...row,
      pictureUrl: await getPublicUrl(row.picture ?? "documents/documentPlaceholder.pdf"),
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

  let storageKey: string | null = null;
  try {
    storageKey = await uploadRawToStorage(req.file, {
      bucket: "documents",
      prefix: "document_",
      fallbackExtension: ".pdf",
      allowedExtensions: [".pdf"],
    });
    if (!storageKey) {
      return sendError(res, 500, "Failed to upload file");
    }

    const id = await documentsService.createDocument(title, storageKey);
    return res.status(201).json({ success: true, id });
  } catch (err) {
    if (storageKey) {
      try {
        await deleteFromStorage(storageKey);
      } catch {
        // ignore cleanup failure
      }
    }
    logger.error("Failed to create document", err);
    return sendError(res, 500, "Failed to create document");
  }
}

export default {
  listDocumentsHandler,
  createDocumentHandler,
};
