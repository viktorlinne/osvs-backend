import type { LinkLodgeBody } from "../types";
import {
  ValidationResult,
  asObject,
  fail,
  failFields,
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
  if (!body) return fail("Ogiltig begäran");

  if (!Object.prototype.hasOwnProperty.call(body, "lodgeId")) {
    return failFields({ lodgeId: "Välj en loge" });
  }

  const lodgeId = body.lodgeId;
  if (!(typeof lodgeId === "number" || typeof lodgeId === "string")) {
    return failFields({ lodgeId: "Ogiltig loge" });
  }

  if (!Number.isFinite(Number(lodgeId))) {
    return failFields({ lodgeId: "Ogiltig loge" });
  }

  return ok({ lodgeId });
}

export function validateRsvpBody(
  input: unknown,
): ValidationResult<ValidRsvpBody> {
  const body = asObject(input);
  if (!body) return fail("Ogiltig begäran");

  const status = toNonEmptyString(body.status);
  if (!status) return failFields({ status: "Välj ett svarsalternativ" });
  if (status !== "going" && status !== "not-going") {
    return failFields({ status: "Ogiltigt svarsalternativ" });
  }

  return ok({ status: status as "going" | "not-going" });
}

export function validateFoodBookingBody(
  input: unknown,
): ValidationResult<ValidFoodBookingBody> {
  const body = asObject(input);
  if (!body) return fail("Ogiltig begäran");

  if (!Object.prototype.hasOwnProperty.call(body, "bookFood")) {
    return failFields({ bookFood: "Välj om mat ska bokas" });
  }
  if (typeof body.bookFood !== "boolean") {
    return failFields({ bookFood: "Ogiltigt värde för matbokning" });
  }

  return ok({ bookFood: body.bookFood });
}

export function validatePatchAttendanceBody(
  input: unknown,
): ValidationResult<ValidPatchAttendanceBody> {
  const body = asObject(input);
  if (!body) return fail("Ogiltig begäran");

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
      return failFields({ [key]: "Ogiltigt värde" });
    }
    out[key] = value;
  }

  if (Object.keys(out).length === 0) {
    return fail("Minst ett närvarofält måste skickas");
  }

  return ok(out);
}
