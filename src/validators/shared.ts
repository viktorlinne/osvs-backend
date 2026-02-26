export type ValidationResult<T> =
  | { ok: true; data: T }
  | { ok: false; errors: string[] };

export function fail<T>(errors: string | string[]): ValidationResult<T> {
  return { ok: false, errors: Array.isArray(errors) ? errors : [errors] };
}

export function ok<T>(data: T): ValidationResult<T> {
  return { ok: true, data };
}

export function asObject(input: unknown): Record<string, unknown> | null {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return null;
  }
  return input as Record<string, unknown>;
}

export function toNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

export function toNullableString(value: unknown): string | null | undefined {
  if (typeof value === "undefined") return undefined;
  if (value === null) return null;
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  return normalized.length === 0 ? null : normalized;
}

export function parseNumericIds(input: unknown): number[] {
  if (input == null) return [];
  const rawValues = Array.isArray(input) ? input : [input];
  const flattened = rawValues.flatMap((value) => {
    if (typeof value === "string") {
      return value
        .split(",")
        .map((part) => part.trim())
        .filter((part) => part.length > 0);
    }
    return [value];
  });
  const normalized = flattened
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value) && value > 0)
    .map((value) => Math.floor(value));
  return Array.from(new Set(normalized));
}

