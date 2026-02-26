import type {
  AddAchievementBody,
  UpdateUserProfileBody,
} from "../types";
import {
  ValidationResult,
  asObject,
  fail,
  ok,
} from "./shared";

export type ValidSetRolesBody = {
  roleIds: number[];
};

export type ValidSetLodgeBody = {
  lodgeId: number | null;
};

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

  if (typeof body.lodgeId !== "number" && typeof body.lodgeId !== "string") {
    return fail("lodgeId must be string, number or null");
  }

  const numeric = Number(body.lodgeId);
  if (!Number.isFinite(numeric)) return fail("Invalid lodgeId");

  return ok({ lodgeId: numeric });
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
      errors.push(
        `${String(key)} must be a string${allowNull ? " or null" : ""}`,
      );
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

