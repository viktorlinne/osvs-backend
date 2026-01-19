import type { RequestHandler, Request, Response, NextFunction } from "express";
import logger from "../utils/logger";

// Wrapper for async route handlers to forward errors to Express error handler
export function wrapAsync(
  handler: (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    logger.info(
      { path: req.path, method: req.method },
      "asyncHandler: invoking handler",
    );
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

export default wrapAsync;
