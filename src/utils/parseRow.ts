import type { ZodSchema } from "zod";

export function parseRow<T>(
  schema: ZodSchema<T>,
  row: unknown,
  opts?: { id?: unknown; log?: boolean },
): T | null {
  const parsed = schema.safeParse(row as unknown);
  if (parsed.success) return parsed.data;
  if (opts?.log) {
    // Minimal contextual logging — keep payload small
    try {
      // eslint-disable-next-line no-console
      console.warn(
        "Row validation failed for id=",
        opts.id ?? "<unknown>",
        parsed.error.issues,
      );
    } catch {
      // ignore logging errors
    }
  }
  return null;
}

export default parseRow;
