import type { NextFunction, Request, Response } from "express";
import multer from "multer";
import { ValidationError, ConflictError, HttpError } from "../utils/errors";
import logger from "../utils/logger";
import * as Sentry from "@sentry/node";
import { sendError } from "../utils/response";

function normalizeUploadFieldName(fieldName?: string | null): string {
  const normalized = typeof fieldName === "string" ? fieldName.trim() : "";
  return normalized.length > 0 ? normalized : "file";
}

function getUploadSizeMessage(fieldName?: string | null): string {
  return normalizeUploadFieldName(fieldName) === "picture"
    ? "Bilden får vara högst 5 MB"
    : "Filen får vara högst 5 MB";
}

function getMulterFieldMessage(err: multer.MulterError): { field: string; message: string } {
  const field = normalizeUploadFieldName(err.field);
  if (err.code === "LIMIT_FILE_SIZE") {
    return { field, message: getUploadSizeMessage(field) };
  }
  if (err.code === "LIMIT_UNEXPECTED_FILE") {
    return { field, message: "Ogiltig filuppladdning" };
  }
  return { field, message: "Ogiltig filuppladdning" };
}

export default function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
) {
  const requestId = res.locals.requestId ?? req.requestId;

  // Handle JSON parse errors from body-parser (Bad Request)
  if (err instanceof SyntaxError) {
    const maybe = err as SyntaxError & { status?: number; body?: unknown };
    if (maybe.status === 400 && "body" in maybe) {
      const parseError = maybe as SyntaxError & {
        status?: number;
        type?: string;
      };
      logger.warn({
        msg: "Invalid JSON body",
        requestId,
        err: {
          name: parseError.name,
          message: parseError.message,
          status: parseError.status,
          type: parseError.type,
        },
      });
      return sendError(res, 400, "Ogiltig JSON i begäran");
    }
  }

  // Known validation error (400)
  if (err instanceof ValidationError) {
    logger.warn({
      msg: "Validation error",
      missing: err.missing,
      fields: err.fields,
      requestId,
    });
    return sendError(res, 400, err.message, err.details);
  }

  if (err instanceof multer.MulterError) {
    const { field, message } = getMulterFieldMessage(err);
    logger.warn({
      msg: "Multer validation error",
      code: err.code,
      field,
      requestId,
    });
    return sendError(res, 400, "Formuläret innehåller fel", {
      fields: { [field]: message },
    });
  }

  // Conflict error (409)
  if (err instanceof ConflictError) {
    logger.warn({ msg: "Conflict error", field: err.field, requestId });
    return sendError(res, 409, err.message, err.details);
  }

  // HttpError with status
  if (err instanceof HttpError) {
    logger.warn({
      msg: "HttpError",
      status: err.status,
      message: err.message,
      details: err.details,
      requestId,
    });
    return sendError(res, err.status, err.message, err.details);
  }

  // Unknown error: capture and return 500
  try {
    Sentry.captureException(err as Error);
  } catch {
    /* ignore */
  }

  // Log with stack when available; include requestId for correlation
  if (err instanceof Error) {
    logger.error({
      msg: "Unhandled error",
      err: { message: err.message, stack: err.stack },
      requestId,
    });
  } else {
    logger.error({ msg: "Unhandled error", err, requestId });
  }

  return sendError(res, 500, "Ett internt serverfel uppstod");
}
