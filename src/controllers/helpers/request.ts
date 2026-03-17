import type { Response } from "express";
import type { AuthenticatedRequest } from "../../types/auth";
import { sendError } from "../../utils/response";
import type { ValidationResult } from "../../validators";

export function requireAuthMatrikelnummer(
  req: AuthenticatedRequest,
  res: Response,
  message = "Obehörig",
): number | null {
  const uid = req.user?.matrikelnummer;
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

export function parsePositiveQueryNumber(
  value: unknown,
  fallback: number,
  max?: number,
) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;

  const normalized = Math.floor(parsed);
  if (normalized < 1) return fallback;
  return typeof max === "number" ? Math.min(normalized, max) : normalized;
}

export function unwrapValidation<T>(
  res: Response,
  parsed: ValidationResult<T>,
): T | null {
  if (!parsed.ok) {
    sendError(
      res,
      400,
      parsed.message ?? parsed.errors,
      parsed.fields ? { fields: parsed.fields } : undefined,
    );
    return null;
  }
  return parsed.data;
}
