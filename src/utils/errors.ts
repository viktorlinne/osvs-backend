export class HttpError extends Error {
  public status: number;
  public details?: unknown;
  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
    this.name = "HttpError";
  }
}

export function badRequest(message = "Bad Request", details?: unknown) {
  return new HttpError(400, message, details);
}

export function forbidden(message = "Forbidden", details?: unknown) {
  return new HttpError(403, message, details);
}

export function notFound(message = "Not Found", details?: unknown) {
  return new HttpError(404, message, details);
}

// Validation and Conflict error classes used across services
export class ValidationError extends Error {
  public missing: string[];
  constructor(missing: string[]) {
    super(`Missing required user fields: ${missing.join(", ")}`);
    this.name = "ValidationError";
    this.missing = missing;
  }
}

export class ConflictError extends Error {
  public field?: string;
  constructor(field?: string, message?: string) {
    super(message ?? `Conflicting values on field: ${field ?? "unknown"}`);
    this.name = "ConflictError";
    this.field = field;
  }
}

export { HttpError as _HttpError };
