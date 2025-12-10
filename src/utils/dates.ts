// Utilities to normalize incoming date inputs to SQL DATE (YYYY-MM-DD)

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function toLocalDateString(d: Date) {
  const y = d.getFullYear();
  const m = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  return `${y}-${m}-${day}`;
}

export function normalizeToSqlDate(input: unknown): string {
  if (typeof input !== "string") {
    throw new Error("date must be a string in YYYY-MM-DD or ISO format");
  }

  const s = input.trim();

  // Exact YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const d = new Date(s);
    if (isNaN(d.getTime())) throw new Error("invalid date");
    return s;
  }

  // Year-month only YYYY-MM -> treat as first day of month
  if (/^\d{4}-\d{2}$/.test(s)) {
    const candidate = `${s}-01`;
    const d = new Date(candidate);
    if (isNaN(d.getTime())) throw new Error("invalid month");
    return candidate;
  }

  // Try full ISO / datetime parse
  const parsed = new Date(s);
  if (!isNaN(parsed.getTime())) {
    // Convert to local YYYY-MM-DD to match previous behavior
    return toLocalDateString(parsed);
  }

  throw new Error("unrecognized date format");
}
