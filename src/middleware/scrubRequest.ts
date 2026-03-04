import type { Request, Response, NextFunction } from "express";

const REDACTED = "[REDACTED]";

const SENSITIVE_KEY_PATTERNS = [
  /password/i,
  /passphrase/i,
  /token/i,
  /secret/i,
  /authorization/i,
  /cookie/i,
  /api[-_]?key/i,
  /session(?:id)?/i,
  /private[-_]?key/i,
];

function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(key));
}

function redactDeep(value: unknown, seen: WeakSet<object>): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => redactDeep(item, seen));
  }

  if (value && typeof value === "object") {
    const objectValue = value as Record<string, unknown>;

    if (seen.has(objectValue)) {
      return REDACTED;
    }
    seen.add(objectValue);

    const copy: Record<string, unknown> = {};
    for (const [key, nestedValue] of Object.entries(objectValue)) {
      copy[key] = isSensitiveKey(key)
        ? REDACTED
        : redactDeep(nestedValue, seen);
    }
    return copy;
  }

  return value;
}

// Middleware to redact sensitive fields from incoming request bodies for logging
export default function scrubRequestBody(
  req: Request,
  _res: Response,
  next: NextFunction
) {
  try {
    if (req && req.body && typeof req.body === "object") {
      // attach redacted copy for loggers to use, do NOT replace req.body
      req.redactedBody = redactDeep(req.body, new WeakSet<object>());
    }
  } catch {
    // ignore
  }
  next();
}
