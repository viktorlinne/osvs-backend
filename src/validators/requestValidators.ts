import type {
  AddAchievementBody,
  LinkLodgeBody,
  UpdateLodgeBody,
  UpdateUserProfileBody,
} from "../types";

export type ValidationResult<T> =
  | { ok: true; data: T }
  | { ok: false; errors: string[] };

export type ValidCreateLodgeBody = {
  name: string;
  city: string;
  description?: string | null;
  email?: string | null;
  picture?: string | null;
};

export type ValidCreateMailBody = {
  lid: number;
  title: string;
  content: string;
};

export type ValidRsvpBody = {
  status: "going" | "not-going";
};

export type ValidSetRolesBody = {
  roleIds: number[];
};

export type ValidSetLodgeBody = {
  lodgeId: number | null;
};

export type ValidCreatePostBody = {
  title: string;
  description: string;
  lodgeIds: number[];
};

function fail<T>(errors: string | string[]): ValidationResult<T> {
  return { ok: false, errors: Array.isArray(errors) ? errors : [errors] };
}

function ok<T>(data: T): ValidationResult<T> {
  return { ok: true, data };
}

function asObject(input: unknown): Record<string, unknown> | null {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return null;
  }
  return input as Record<string, unknown>;
}

function toNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function toNullableString(value: unknown): string | null | undefined {
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

export function validateCreateLodgeBody(
  input: unknown,
): ValidationResult<ValidCreateLodgeBody> {
  const body = asObject(input);
  if (!body) return fail("Body must be an object");

  const name = toNonEmptyString(body.name);
  const city = toNonEmptyString(body.city);
  if (!name || !city) {
    return fail(["name: required", "city: required"]);
  }

  const description = toNullableString(body.description);
  const email = toNullableString(body.email);
  const picture = toNullableString(body.picture);

  if (
    (typeof body.description !== "undefined" && typeof description === "undefined") ||
    (typeof body.email !== "undefined" && typeof email === "undefined") ||
    (typeof body.picture !== "undefined" && typeof picture === "undefined")
  ) {
    return fail("description/email/picture must be string or null");
  }

  return ok({ name, city, description, email, picture });
}

export function validateUpdateLodgeBody(
  input: unknown,
): ValidationResult<UpdateLodgeBody> {
  const body = asObject(input);
  if (!body) return fail("Body must be an object");

  const out: UpdateLodgeBody = {};
  const errors: string[] = [];

  if (Object.prototype.hasOwnProperty.call(body, "name")) {
    const name = toNonEmptyString(body.name);
    if (!name) errors.push("name must be a non-empty string");
    else out.name = name;
  }

  if (Object.prototype.hasOwnProperty.call(body, "city")) {
    const city = toNonEmptyString(body.city);
    if (!city) errors.push("city must be a non-empty string");
    else out.city = city;
  }

  if (Object.prototype.hasOwnProperty.call(body, "description")) {
    const description = toNullableString(body.description);
    if (typeof description === "undefined") {
      errors.push("description must be string or null");
    } else {
      out.description = description;
    }
  }

  if (Object.prototype.hasOwnProperty.call(body, "email")) {
    const email = toNullableString(body.email);
    if (typeof email === "undefined") {
      errors.push("email must be string or null");
    } else {
      out.email = email;
    }
  }

  if (Object.prototype.hasOwnProperty.call(body, "picture")) {
    const picture = toNullableString(body.picture);
    if (typeof picture === "undefined") {
      errors.push("picture must be string or null");
    } else {
      out.picture = picture;
    }
  }

  if (errors.length > 0) return fail(errors);
  return ok(out);
}

export function validateCreateMailBody(
  input: unknown,
): ValidationResult<ValidCreateMailBody> {
  const body = asObject(input);
  if (!body) return fail("Body must be an object");

  const lid = Number(body.lid);
  const title = toNonEmptyString(body.title);
  const content = toNonEmptyString(body.content);

  const errors: string[] = [];
  if (!Number.isFinite(lid)) errors.push("lid must be a number");
  if (!title) errors.push("title: required");
  if (!content) errors.push("content: required");
  if (errors.length > 0) return fail(errors);

  return ok({ lid, title: title as string, content: content as string });
}

export function validateLinkLodgeBody(
  input: unknown,
): ValidationResult<LinkLodgeBody> {
  const body = asObject(input);
  if (!body) return fail("Body must be an object");

  if (!Object.prototype.hasOwnProperty.call(body, "lodgeId")) {
    return fail("lodgeId: required");
  }

  const lodgeId = body.lodgeId;
  if (
    !(
      typeof lodgeId === "number" ||
      typeof lodgeId === "string"
    )
  ) {
    return fail("lodgeId must be a string or number");
  }

  if (!Number.isFinite(Number(lodgeId))) {
    return fail("lodgeId must be numeric");
  }

  return ok({ lodgeId });
}

export function validateRsvpBody(input: unknown): ValidationResult<ValidRsvpBody> {
  const body = asObject(input);
  if (!body) return fail("Body must be an object");

  const status = toNonEmptyString(body.status);
  if (!status) return fail("status: required");
  if (status !== "going" && status !== "not-going") {
    return fail("status must be 'going' or 'not-going'");
  }

  return ok({ status: status as "going" | "not-going" });
}

export function validateAddAchievementBody(
  input: unknown,
): ValidationResult<AddAchievementBody> {
  const body = asObject(input);
  if (!body) return fail("Body must be an object");

  const achievementId = Number(body.achievementId);
  if (!Number.isFinite(achievementId) || !Number.isInteger(achievementId)) {
    return fail("achievementId must be an integer");
  }

  const awardedAtRaw = body.awardedAt;
  if (typeof awardedAtRaw !== "undefined" && awardedAtRaw !== null) {
    if (typeof awardedAtRaw !== "string") {
      return fail("awardedAt must be string or null");
    }
    const when = new Date(awardedAtRaw);
    if (Number.isNaN(when.getTime())) return fail("Invalid awardedAt date");
  }

  return ok({
    achievementId,
    awardedAt:
      awardedAtRaw === null || typeof awardedAtRaw === "undefined"
        ? null
        : String(awardedAtRaw),
  });
}

export function validateSetRolesBody(
  input: unknown,
): ValidationResult<ValidSetRolesBody> {
  const body = asObject(input);
  if (!body) return fail("Body must be an object");

  if (!Array.isArray(body.roleIds)) {
    return fail("roleIds must be an array of numbers");
  }

  const roleIds = body.roleIds
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value) && Number.isInteger(value));

  if (roleIds.length === 0 || roleIds.length !== body.roleIds.length) {
    return fail("roleIds must contain at least one integer id");
  }

  return ok({ roleIds });
}

export function validateSetLodgeBody(
  input: unknown,
): ValidationResult<ValidSetLodgeBody> {
  const body = asObject(input);
  if (!body) return fail("Body must be an object");

  if (!Object.prototype.hasOwnProperty.call(body, "lodgeId")) {
    return fail("lodgeId: required");
  }

  if (body.lodgeId === null) return ok({ lodgeId: null });

  if (
    typeof body.lodgeId !== "number" &&
    typeof body.lodgeId !== "string"
  ) {
    return fail("lodgeId must be string, number or null");
  }

  const numeric = Number(body.lodgeId);
  if (!Number.isFinite(numeric)) return fail("Invalid lodgeId");

  return ok({ lodgeId: numeric });
}

export function validateCreatePostBody(
  input: unknown,
): ValidationResult<ValidCreatePostBody> {
  const body = asObject(input);
  if (!body) return fail("Body must be an object");

  const title = toNonEmptyString(body.title);
  const description = toNonEmptyString(body.description);
  if (!title || !description) {
    return fail("Saknar titel eller beskrivning");
  }

  const lodgeIds = parseNumericIds(body.lodgeIds);
  return ok({ title, description, lodgeIds });
}

export function validateUpdateUserProfileBody(
  input: unknown,
): ValidationResult<UpdateUserProfileBody> {
  const body = asObject(input);
  if (!body) return fail("Body must be an object");

  const out: UpdateUserProfileBody = {};
  const errors: string[] = [];

  const maybeAssignString = (
    key: keyof UpdateUserProfileBody,
    allowNull = false,
  ) => {
    if (!Object.prototype.hasOwnProperty.call(body, key)) return;
    const value = body[key as string];
    if (value === null && allowNull) {
      out[key] = null as never;
      return;
    }
    if (typeof value !== "string") {
      errors.push(`${String(key)} must be a string${allowNull ? " or null" : ""}`);
      return;
    }
    out[key] = value.trim() as never;
  };

  maybeAssignString("firstname");
  maybeAssignString("lastname");
  maybeAssignString("dateOfBirth");
  maybeAssignString("work", true);
  maybeAssignString("mobile");
  maybeAssignString("city");
  maybeAssignString("address");
  maybeAssignString("zipcode");
  maybeAssignString("notes", true);

  if (Object.prototype.hasOwnProperty.call(body, "accommodationAvailable")) {
    const value = body.accommodationAvailable;
    if (value === null || typeof value === "boolean") {
      out.accommodationAvailable = value;
    } else {
      errors.push("accommodationAvailable must be boolean or null");
    }
  }

  if (errors.length > 0) return fail(errors);
  return ok(out);
}
