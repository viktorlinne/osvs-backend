import type { RequestHandler } from "express";
import type { ZodSchema } from "zod";
import { ValidationError } from "../utils/errors";

export function validateBody<T>(schema: ZodSchema<T>): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const missing = result.error.errors.map((e) =>
        e.path && e.path.length > 0 ? e.path.join(".") : e.message
      );
      throw new ValidationError(missing);
    }
    // replace body with parsed/validated data
    req.body = result.data as unknown as typeof req.body;
    next();
  };
}

export function validateQuery<T>(schema: ZodSchema<T>): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      const missing = result.error.errors.map((e) =>
        e.path && e.path.length > 0 ? e.path.join(".") : e.message
      );
      throw new ValidationError(missing);
    }
    req.query = result.data as unknown as typeof req.query;
    next();
  };
}

export function validateParams<T>(schema: ZodSchema<T>): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse(req.params);
    if (!result.success) {
      const missing = result.error.errors.map((e) =>
        e.path && e.path.length > 0 ? e.path.join(".") : e.message
      );
      throw new ValidationError(missing);
    }
    req.params = result.data as unknown as typeof req.params;
    next();
  };
}
