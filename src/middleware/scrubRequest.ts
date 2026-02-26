import type { Request, Response, NextFunction } from "express";

// Middleware to redact sensitive fields from incoming request bodies for logging
export default function scrubRequestBody(
  req: Request,
  _res: Response,
  next: NextFunction
) {
  try {
    if (req && req.body && typeof req.body === "object") {
      const body = req.body as Record<string, unknown>;
      const copy: Record<string, unknown> = { ...body };
      if (typeof copy.password === "string") copy.password = "[REDACTED]";
      if (typeof copy.passwordHash === "string")
        copy.passwordHash = "[REDACTED]";
      // attach redacted copy for loggers to use, do NOT replace req.body
      req.redactedBody = copy;
    }
  } catch {
    // ignore
  }
  next();
}
