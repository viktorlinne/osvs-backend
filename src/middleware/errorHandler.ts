import type { NextFunction, Request, Response } from "express";
import { ValidationError, ConflictError, HttpError } from "../utils/errors";
import logger from "../utils/logger";
import * as Sentry from "@sentry/node";
import { sendError } from "../utils/response";

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
      return sendError(res, 400, "Invalid JSON in request body");
    }
  }

  // Known validation error (400)
  if (err instanceof ValidationError) {
    logger.warn({ msg: "Validation error", missing: err.missing, requestId });
    const detail =
      err.missing.length > 0 ? `: ${err.missing.join(", ")}` : "";
    return sendError(res, 400, `Validation failed${detail}`);
  }

  // Conflict error (409)
  if (err instanceof ConflictError) {
    logger.warn({ msg: "Conflict error", field: err.field, requestId });
    return sendError(res, 409, "Conflict error");
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
    return sendError(res, err.status, err.message);
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

  return sendError(res, 500, "Internal server error");
}
