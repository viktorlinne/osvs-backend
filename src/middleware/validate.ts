import type { RequestHandler } from "express";

// Zod removed: provide no-op validators preserving the same API surface
export function validateBody<_T>(_schema: unknown): RequestHandler {
  return (_req, _res, next) => next();
}

export function validateQuery<_T>(_schema: unknown): RequestHandler {
  return (_req, _res, next) => next();
}

export function validateParams<_T>(_schema: unknown): RequestHandler {
  return (_req, _res, next) => next();
}
