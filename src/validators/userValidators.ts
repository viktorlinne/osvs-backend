import type {
  AddAchievementBody,
  UpdateUserProfileBody,
} from "../types";
import {
  ValidationResult,
  asObject,
  fail,
  failFields,
  ok,
} from "./shared";

export type ValidSetRolesBody = {
  roleIds: number[];
};

export type ValidSetLodgeBody = {
  lodgeId: number | null;
};

export type ValidSetUserLocationBody = {
  lat: number;
  lng: number;
};

export function validateAddAchievementBody(
  input: unknown,
): ValidationResult<AddAchievementBody> {
  const body = asObject(input);
  if (!body) return fail("Ogiltig begäran");

  const achievementId = Number(body.achievementId);
  if (!Number.isFinite(achievementId) || !Number.isInteger(achievementId)) {
    return failFields({ achievementId: "Välj en giltig utmärkelse" });
  }

  const awardedAtRaw = body.awardedAt;
  if (typeof awardedAtRaw !== "undefined" && awardedAtRaw !== null) {
    if (typeof awardedAtRaw !== "string") {
      return failFields({ awardedAt: "Ogiltigt datum" });
    }
    const when = new Date(awardedAtRaw);
    if (Number.isNaN(when.getTime())) {
      return failFields({ awardedAt: "Ogiltigt datum" });
    }
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
  if (!body) return fail("Ogiltig begäran");

  if (!Array.isArray(body.roleIds)) {
    return failFields({ roleIds: "Välj minst en roll" });
  }

  const roleIds = body.roleIds
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value) && Number.isInteger(value));

  if (roleIds.length === 0 || roleIds.length !== body.roleIds.length) {
    return failFields({ roleIds: "Välj minst en giltig roll" });
  }

  return ok({ roleIds });
}

export function validateSetLodgeBody(
  input: unknown,
): ValidationResult<ValidSetLodgeBody> {
  const body = asObject(input);
  if (!body) return fail("Ogiltig begäran");

  if (!Object.prototype.hasOwnProperty.call(body, "lodgeId")) {
    return failFields({ lodgeId: "Välj en loge" });
  }

  if (body.lodgeId === null) return ok({ lodgeId: null });

  if (typeof body.lodgeId !== "number" && typeof body.lodgeId !== "string") {
    return failFields({ lodgeId: "Ogiltig loge" });
  }

  const numeric = Number(body.lodgeId);
  if (!Number.isFinite(numeric)) {
    return failFields({ lodgeId: "Ogiltig loge" });
  }

  return ok({ lodgeId: numeric });
}

export function validateSetUserLocationBody(
  input: unknown,
): ValidationResult<ValidSetUserLocationBody> {
  const body = asObject(input);
  if (!body) return fail("Ogiltig begäran");

  const lat = Number(body.lat);
  const lng = Number(body.lng);

  if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
    return failFields({ lat: "Latitud måste vara mellan -90 och 90" });
  }
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
    return failFields({ lng: "Longitud måste vara mellan -180 och 180" });
  }

  return ok({ lat, lng });
}

export function validateUpdateUserProfileBody(
  input: unknown,
): ValidationResult<UpdateUserProfileBody> {
  const body = asObject(input);
  if (!body) return fail("Ogiltig begäran");

  const out: UpdateUserProfileBody = {};
  const fields: Record<string, string> = {};

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
      fields[String(key)] = "Ogiltigt värde";
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
      fields.accommodationAvailable = "Ogiltigt värde";
    }
  }

  if (Object.keys(fields).length > 0) {
    return failFields(fields);
  }
  return ok(out);
}
