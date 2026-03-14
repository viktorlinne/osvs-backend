export type ErrorFieldMap = Record<string, string>;

export type ErrorDetails = {
  fields?: ErrorFieldMap;
  [key: string]: unknown;
};

export class HttpError extends Error {
  public status: number;
  public details?: ErrorDetails;

  constructor(status: number, message: string, details?: ErrorDetails) {
    super(message);
    this.status = status;
    this.details = details;
    this.name = "HttpError";
  }
}

export function badRequest(message = "Ogiltig begäran", details?: ErrorDetails) {
  return new HttpError(400, message, details);
}

export function forbidden(message = "Åtkomst nekad", details?: ErrorDetails) {
  return new HttpError(403, message, details);
}

export function notFound(message = "Hittades inte", details?: ErrorDetails) {
  return new HttpError(404, message, details);
}

export class StorageUploadError extends HttpError {
  constructor(message = "Kunde inte ladda upp filen", details?: ErrorDetails) {
    super(500, message, details);
    this.name = "StorageUploadError";
  }
}

export function requiredFieldErrors(fields: string[]): ErrorFieldMap {
  return Object.fromEntries(
    fields.map((field) => [field, "Det här fältet är obligatoriskt"]),
  );
}

export function singleFieldError(field: string, message: string): ErrorFieldMap {
  return { [field]: message };
}

export class ValidationError extends HttpError {
  public fields?: ErrorFieldMap;
  public missing: string[];

  constructor(
    fieldsOrMissing: ErrorFieldMap | string[],
    message = "Formuläret innehåller fel",
    details?: Omit<ErrorDetails, "fields">,
  ) {
    const fields = Array.isArray(fieldsOrMissing)
      ? requiredFieldErrors(fieldsOrMissing)
      : fieldsOrMissing;
    super(
      400,
      message,
      Object.keys(fields).length > 0 ? { ...details, fields } : details,
    );
    this.name = "ValidationError";
    this.fields = Object.keys(fields).length > 0 ? fields : undefined;
    this.missing = Object.keys(fields);
  }
}

export class ConflictError extends HttpError {
  public field?: string;

  constructor(
    field?: string,
    message = "Konflikt",
    details?: Omit<ErrorDetails, "fields">,
  ) {
    super(
      409,
      message,
      field ? { ...details, fields: { [field]: message } } : details,
    );
    this.name = "ConflictError";
    this.field = field;
  }
}

export { HttpError as _HttpError };
