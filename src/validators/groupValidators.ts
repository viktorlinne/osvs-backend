import {
  ValidationResult,
  asObject,
  fail,
  failFields,
  ok,
  toNonEmptyString,
  toNullableString,
} from "./shared";

export const GROUP_NAME_MAX_LENGTH = 255;
export const GROUP_DESCRIPTION_MAX_LENGTH = 2000;
export const GROUP_MEMBERS_MAX_PER_REQUEST = 500;

export type ValidCreateGroupBody = {
  name: string;
  description: string | null;
};

export type ValidUpdateGroupBody = {
  name?: string;
  description?: string | null;
};

export type ValidAddGroupMembersBody = {
  userIds: number[];
};

function hasOwn(body: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(body, key);
}

function validateName(value: unknown): { value?: string; error?: string } {
  const name = toNonEmptyString(value);
  if (!name) return { error: "Namn är obligatoriskt" };
  if (name.length > GROUP_NAME_MAX_LENGTH) {
    return { error: `Namnet får vara högst ${GROUP_NAME_MAX_LENGTH} tecken` };
  }
  return { value: name };
}

function validateDescription(
  value: unknown,
): { value?: string | null; error?: string } {
  const description = toNullableString(value);
  if (typeof description === "undefined") return { error: "Ogiltig beskrivning" };
  if (description && description.length > GROUP_DESCRIPTION_MAX_LENGTH) {
    return {
      error: `Beskrivningen får vara högst ${GROUP_DESCRIPTION_MAX_LENGTH} tecken`,
    };
  }
  return { value: description };
}

export function validateCreateGroupBody(
  input: unknown,
): ValidationResult<ValidCreateGroupBody> {
  const body = asObject(input);
  if (!body) return fail("Ogiltig begäran");

  const fields: Record<string, string> = {};
  const name = validateName(body.name);
  if (name.error) fields.name = name.error;

  let description: string | null = null;
  if (hasOwn(body, "description") && typeof body.description !== "undefined") {
    const parsed = validateDescription(body.description);
    if (parsed.error) fields.description = parsed.error;
    else description = parsed.value ?? null;
  }

  if (Object.keys(fields).length > 0) return failFields(fields);
  return ok({ name: name.value as string, description });
}

export function validateUpdateGroupBody(
  input: unknown,
): ValidationResult<ValidUpdateGroupBody> {
  const body = asObject(input);
  if (!body) return fail("Ogiltig begäran");

  const out: ValidUpdateGroupBody = {};
  const fields: Record<string, string> = {};

  if (hasOwn(body, "name")) {
    const name = validateName(body.name);
    if (name.error) fields.name = name.error;
    else out.name = name.value;
  }

  if (hasOwn(body, "description")) {
    const description = validateDescription(body.description);
    if (description.error) fields.description = description.error;
    else out.description = description.value ?? null;
  }

  if (Object.keys(fields).length > 0) return failFields(fields);
  if (!hasOwn(out, "name") && !hasOwn(out, "description")) {
    return fail("Inget att uppdatera");
  }
  return ok(out);
}

function toPositiveInteger(value: unknown): number | null {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim().length > 0
        ? Number(value)
        : NaN;
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export function validateAddGroupMembersBody(
  input: unknown,
): ValidationResult<ValidAddGroupMembersBody> {
  const body = asObject(input);
  if (!body) return fail("Ogiltig begäran");

  const raw = body.userIds;
  if (!Array.isArray(raw) || raw.length === 0) {
    return failFields({ userIds: "Välj minst en medlem" });
  }
  if (raw.length > GROUP_MEMBERS_MAX_PER_REQUEST) {
    return failFields({
      userIds: `Högst ${GROUP_MEMBERS_MAX_PER_REQUEST} medlemmar kan läggas till åt gången`,
    });
  }

  const userIds: number[] = [];
  for (const value of raw) {
    const id = toPositiveInteger(value);
    if (id === null) return failFields({ userIds: "Ogiltigt matrikelnummer" });
    if (!userIds.includes(id)) userIds.push(id);
  }

  return ok({ userIds });
}
