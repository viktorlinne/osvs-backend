import {
  type ValidationFieldMap,
  type ValidationResult,
  asObject,
  fail,
  failFields,
  ok,
} from "./shared";

// Validators for editable member history (OSVS-25 / OSVS-26).
// Dates are calendar dates (YYYY-MM-DD). Notes are required for every change
// or deletion of a date-stamped value and optional on creation.

export const NOTE_MAX_LENGTH = 1000;

export const NOTE_REQUIRED_MESSAGE =
  "Ange en anteckning som förklarar ändringen";
export const NOTE_TOO_LONG_MESSAGE = `Anteckningen får vara högst ${NOTE_MAX_LENGTH} tecken`;
export const DATES_CONFIRMED_MESSAGE =
  "Bekräfta både startdatum och slutdatum innan du sparar";

export type ValidOfficialEntryBody = {
  officialId: number;
  appointedAt: string;
  unappointedAt: string | null;
  note: string | null;
};

export type ValidAchievementEntryBody = {
  achievementId: number;
  awardedAt: string;
  note: string | null;
};

export type ValidDeleteEntryBody = {
  note: string;
};

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Strict calendar date check for YYYY-MM-DD (rejects e.g. 2024-02-30). */
export function isValidCalendarDate(value: string): boolean {
  const m = DATE_RE.exec(value);
  if (!m) return false;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (y < 1000 || mo < 1 || mo > 12 || d < 1) return false;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === mo - 1 &&
    dt.getUTCDate() === d
  );
}

function readPositiveInt(value: unknown): number | null {
  if (typeof value !== "number" && typeof value !== "string") return null;
  if (typeof value === "string" && value.trim() === "") return null;
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/**
 * Parses the optional/required note. Returns `undefined` when absent/blank,
 * the trimmed string when valid, or an error message.
 */
function readNote(
  value: unknown,
): { ok: true; value: string | null } | { ok: false; message: string } {
  if (value === null || typeof value === "undefined") {
    return { ok: true, value: null };
  }
  if (typeof value !== "string") {
    return { ok: false, message: "Ogiltig anteckning" };
  }
  const trimmed = value.trim();
  if (trimmed.length > NOTE_MAX_LENGTH) {
    return { ok: false, message: NOTE_TOO_LONG_MESSAGE };
  }
  return { ok: true, value: trimmed.length > 0 ? trimmed : null };
}

function applyNote(
  raw: unknown,
  required: boolean,
  fields: ValidationFieldMap,
): string | null {
  const parsed = readNote(raw);
  if (!parsed.ok) {
    fields.note = parsed.message;
    return null;
  }
  if (required && parsed.value === null) {
    fields.note = NOTE_REQUIRED_MESSAGE;
  }
  return parsed.value;
}

/**
 * Body for creating (`mode: "create"`) or updating (`mode: "update"`) a
 * tjänst entry. Both modes require `datesConfirmed: true`; update also
 * requires a note.
 */
export function validateOfficialEntryBody(
  input: unknown,
  mode: "create" | "update",
): ValidationResult<ValidOfficialEntryBody> {
  const body = asObject(input);
  if (!body) return fail("Ogiltig begäran");

  const fields: ValidationFieldMap = {};

  const officialId = readPositiveInt(body.officialId);
  if (officialId === null) fields.officialId = "Välj en giltig tjänst";

  let appointedAt = "";
  if (typeof body.appointedAt !== "string" || body.appointedAt.trim() === "") {
    fields.appointedAt = "Ange startdatum";
  } else if (!isValidCalendarDate(body.appointedAt.trim())) {
    fields.appointedAt = "Ogiltigt startdatum (ÅÅÅÅ-MM-DD)";
  } else {
    appointedAt = body.appointedAt.trim();
  }

  let unappointedAt: string | null = null;
  const rawEnd = body.unappointedAt;
  if (rawEnd === null || typeof rawEnd === "undefined" || rawEnd === "") {
    unappointedAt = null;
  } else if (typeof rawEnd !== "string" || !isValidCalendarDate(rawEnd.trim())) {
    fields.unappointedAt = "Ogiltigt slutdatum (ÅÅÅÅ-MM-DD)";
  } else {
    unappointedAt = rawEnd.trim();
  }

  if (
    appointedAt &&
    unappointedAt &&
    !fields.unappointedAt &&
    unappointedAt < appointedAt
  ) {
    fields.unappointedAt = "Slutdatum kan inte vara före startdatum";
  }

  if (body.datesConfirmed !== true) {
    fields.datesConfirmed = DATES_CONFIRMED_MESSAGE;
  }

  const note = applyNote(body.note, mode === "update", fields);

  if (Object.keys(fields).length > 0) return failFields(fields);

  return ok({
    officialId: officialId as number,
    appointedAt,
    unappointedAt,
    note,
  });
}

/** Body for creating or updating an achievement entry. */
export function validateAchievementEntryBody(
  input: unknown,
  mode: "create" | "update",
): ValidationResult<ValidAchievementEntryBody> {
  const body = asObject(input);
  if (!body) return fail("Ogiltig begäran");

  const fields: ValidationFieldMap = {};

  const achievementId = readPositiveInt(body.achievementId);
  if (achievementId === null) fields.achievementId = "Välj en giltig utmärkelse";

  let awardedAt = "";
  if (typeof body.awardedAt !== "string" || body.awardedAt.trim() === "") {
    fields.awardedAt = "Ange datum";
  } else if (!isValidCalendarDate(body.awardedAt.trim())) {
    fields.awardedAt = "Ogiltigt datum (ÅÅÅÅ-MM-DD)";
  } else {
    awardedAt = body.awardedAt.trim();
  }

  const note = applyNote(body.note, mode === "update", fields);

  if (Object.keys(fields).length > 0) return failFields(fields);

  return ok({ achievementId: achievementId as number, awardedAt, note });
}

/** Body for deleting a tjänst or achievement entry; the note is required. */
export function validateDeleteEntryBody(
  input: unknown,
): ValidationResult<ValidDeleteEntryBody> {
  const body = asObject(input) ?? {};
  const fields: ValidationFieldMap = {};
  const note = applyNote(body.note, true, fields);
  if (Object.keys(fields).length > 0) return failFields(fields);
  return ok({ note: note as string });
}

/** Optional note accepted by the legacy create endpoints. */
export function validateOptionalNote(
  input: unknown,
): ValidationResult<string | null> {
  const body = asObject(input) ?? {};
  const fields: ValidationFieldMap = {};
  const note = applyNote(body.note, false, fields);
  if (Object.keys(fields).length > 0) return failFields(fields);
  return ok(note);
}
