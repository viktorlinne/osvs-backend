import type { NextFunction, Request, Response } from "express";
import { ValidationError, ConflictError, HttpError } from "../utils/errors";
import logger from "../utils/logger";
import * as Sentry from "@sentry/node";

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
      logger.warn({ msg: "Invalid JSON body", err, requestId });
      return res.status(400).json({
        error: "InvalidJson",
        message: "Invalid JSON in request body",
        status: 400,
        requestId,
      });
    }
  }

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

  const includeStack = process.env.NODE_ENV !== "production";
  return res.status(500).json({
    error: "InternalError",
    message: "Internal server error",
    status: 500,
    requestId,
    ...(includeStack && err instanceof Error ? { stack: err.stack } : {}),
  });
}
