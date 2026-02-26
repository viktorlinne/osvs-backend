import type { Response } from "express";
import type { AuthenticatedRequest } from "../../types/auth";
import { sendError } from "../../utils/response";
import type { ValidationResult } from "../../validators";

export function requireAuthUserId(
  req: AuthenticatedRequest,
  res: Response,
  message = "Unauthorized",
): number | null {
  const uid = req.user?.userId;
  if (!uid) {
    sendError(res, 401, message);
    return null;
  }
  return uid;
}

export function parseNumericParam(
  res: Response,
  value: unknown,
  message: string,
): number | null {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    sendError(res, 400, message);
    return null;
  }
  return parsed;
}

export function unwrapValidation<T>(
  res: Response,
  parsed: ValidationResult<T>,
): T | null {
  if (!parsed.ok) {
    sendError(res, 400, parsed.errors);
    return null;
  }
  return parsed.data;
}

