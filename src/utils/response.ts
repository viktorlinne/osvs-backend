import { Response } from "express";
import type { ErrorDetails, ErrorFieldMap } from "./errors";

export function sendSuccess(res: Response, payload: unknown) {
  return res.status(200).json(payload);
}

export function sendCreated(res: Response, payload: unknown) {
  return res.status(201).json(payload);
}

function fallbackMessageByStatus(status: number): string {
  if (status === 400) return "Ogiltig begäran";
  if (status === 401) return "Obehörig";
  if (status === 403) return "Åtkomst nekad";
  if (status === 404) return "Resursen hittades inte";
  if (status === 409) return "Konflikt";
  if (status === 429) return "För många förfrågningar";
  if (status >= 500) return "Ett internt serverfel uppstod";
  return "Ett oväntat fel inträffade";
}

function normalizeOneMessage(status: number, value: string): string {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallbackMessageByStatus(status);
}

function normalizeErrorMessage(status: number, message?: string | string[]): string {
  if (Array.isArray(message)) {
    const normalized = message
      .map((item) => normalizeOneMessage(status, String(item)))
      .filter((item) => item.length > 0);
    if (normalized.length > 0) {
      return Array.from(new Set(normalized)).join(", ");
    }
    return fallbackMessageByStatus(status);
  }

  if (typeof message === "string") return normalizeOneMessage(status, message);

  return fallbackMessageByStatus(status);
}

function normalizeErrorDetails(
  status: number,
  details?: ErrorDetails,
): ErrorDetails | undefined {
  if (!details || typeof details !== "object") return undefined;

  const normalized: ErrorDetails = {};

  if (details.fields && typeof details.fields === "object") {
    const fields = Object.entries(details.fields).reduce<ErrorFieldMap>(
      (acc, [field, value]) => {
        if (typeof field !== "string" || typeof value !== "string") return acc;
        const key = field.trim();
        if (!key) return acc;
        acc[key] = normalizeOneMessage(status, value);
        return acc;
      },
      {},
    );

    if (Object.keys(fields).length > 0) {
      normalized.fields = fields;
    }
  }

  for (const [key, value] of Object.entries(details)) {
    if (key === "fields" || typeof value === "undefined") continue;
    normalized[key] = value;
  }

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

export function sendError(
  res: Response,
  status = 400,
  message?: string | string[],
  details?: ErrorDetails,
) {
  const payload: { message: string; details?: ErrorDetails } = {
    message: normalizeErrorMessage(status, message),
  };
  const normalizedDetails = normalizeErrorDetails(status, details);
  if (normalizedDetails) {
    payload.details = normalizedDetails;
  }
  return res.status(status).json(payload);
}

export default { sendSuccess, sendCreated, sendError };
