import type { RequestHandler, Request, Response, NextFunction } from "express";

// Wrapper for async route handlers to forward errors to Express error handler
export function wrapAsync(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

export default wrapAsync;
