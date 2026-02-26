import type { LinkLodgeBody } from "../types";
import {
  ValidationResult,
  asObject,
  fail,
  ok,
  toNonEmptyString,
} from "./shared";

export type ValidRsvpBody = {
  status: "going" | "not-going";
};

export type ValidFoodBookingBody = {
  bookFood: boolean;
};

export type ValidPatchAttendanceBody = Partial<{
  rsvp: boolean;
  bookFood: boolean;
  attended: boolean;
  paymentPaid: boolean;
}>;

export function validateLinkLodgeBody(
  input: unknown,
): ValidationResult<LinkLodgeBody> {
  const body = asObject(input);
  if (!body) return fail("Body must be an object");

  if (!Object.prototype.hasOwnProperty.call(body, "lodgeId")) {
    return fail("lodgeId: required");
  }

  const lodgeId = body.lodgeId;
  if (!(typeof lodgeId === "number" || typeof lodgeId === "string")) {
    return fail("lodgeId must be a string or number");
  }

  if (!Number.isFinite(Number(lodgeId))) {
    return fail("lodgeId must be numeric");
  }

  return ok({ lodgeId });
}

export function validateRsvpBody(
  input: unknown,
): ValidationResult<ValidRsvpBody> {
  const body = asObject(input);
  if (!body) return fail("Body must be an object");

  const status = toNonEmptyString(body.status);
  if (!status) return fail("status: required");
  if (status !== "going" && status !== "not-going") {
    return fail("status must be 'going' or 'not-going'");
  }

  return ok({ status: status as "going" | "not-going" });
}

export function validateFoodBookingBody(
  input: unknown,
): ValidationResult<ValidFoodBookingBody> {
  const body = asObject(input);
  if (!body) return fail("Body must be an object");

  if (!Object.prototype.hasOwnProperty.call(body, "bookFood")) {
    return fail("bookFood: required");
  }
  if (typeof body.bookFood !== "boolean") {
    return fail("bookFood must be a boolean");
  }

  return ok({ bookFood: body.bookFood });
}

export function validatePatchAttendanceBody(
  input: unknown,
): ValidationResult<ValidPatchAttendanceBody> {
  const body = asObject(input);
  if (!body) return fail("Body must be an object");

  const out: ValidPatchAttendanceBody = {};
  const keys: Array<keyof ValidPatchAttendanceBody> = [
    "rsvp",
    "bookFood",
    "attended",
    "paymentPaid",
  ];

  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(body, key)) continue;
    const value = body[key];
    if (typeof value !== "boolean") {
      return fail(`${key} must be a boolean`);
    }
    out[key] = value;
  }

  if (Object.keys(out).length === 0) {
    return fail("At least one of rsvp, bookFood, attended, paymentPaid is required");
  }

  return ok(out);
}
