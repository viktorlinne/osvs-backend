import type { NextFunction, Request, Response } from "express";
import { ValidationError, ConflictError, HttpError } from "../utils/errors";
import logger from "../utils/logger";
import * as Sentry from "@sentry/node";

// Express error-handling middleware
export default function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
) {
  const requestId =
    res.locals.requestId ??
    (req as unknown as { requestId?: string }).requestId;

  // Known validation error (400)
  if (err instanceof ValidationError) {
    logger.warn({ msg: "Validation error", missing: err.missing, requestId });
    return res.status(400).json({
      error: "ValidationFailed",
      message: "Validation failed",
      status: 400,
      details: { missing: err.missing },
      requestId,
    });
  }

  // Conflict error (409)
  if (err instanceof ConflictError) {
    logger.warn({ msg: "Conflict error", field: err.field, requestId });
    return res.status(409).json({
      error: "Conflict",
      message: "Conflict error",
      status: 409,
      details: { field: err.field ?? null },
      requestId,
    });
  }

  // HttpError with status
  if (err instanceof HttpError) {
    logger.warn({
      msg: "HttpError",
      status: err.status,
      message: err.message,
      requestId,
    });
    return res.status(err.status).json({
      error: err.message,
      message: err.message,
      status: err.status,
      details: err.details,
      requestId,
    });
  }

  // Unknown error: log and return 500
  // capture in Sentry (if configured) with request scope
  try {
    Sentry.captureException(err as Error);
  } catch {
    /* ignore */
  }

  logger.error({ msg: "Unhandled error", err, requestId });
  return res.status(500).json({
    error: "InternalError",
    message: "Internal server error",
    status: 500,
    requestId,
  });
}
