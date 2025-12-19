import type { Request, Response, NextFunction } from "express";

// Middleware to scrub sensitive fields from JSON responses
export default function scrubResponseJson(
  _req: Request,
  res: Response,
  next: NextFunction
) {
  const origJson = res.json.bind(res);
  res.json = (body?: unknown) => {
    try {
      const copy = JSON.parse(JSON.stringify(body));
      if (copy && typeof copy === "object") {
        const rec = copy as Record<string, unknown>;
        // common sensitive fields
        if (rec.user && typeof rec.user === "object") {
          const userRec = rec.user as Record<string, unknown>;
          delete userRec.password;
          delete userRec.passwordHash;
          rec.user = userRec;
        }
        if (typeof rec.password !== "undefined") delete rec.password;
        if (typeof rec.passwordHash !== "undefined") delete rec.passwordHash;
      }
      return origJson(copy);
    } catch {
      return origJson(body);
    }
  };
  next();
}
