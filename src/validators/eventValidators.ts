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

export type ValidRegistrationBody = {
  rsvp: boolean;
  bookFood: boolean;
};

export type ValidPatchAttendanceBody = Partial<{
  rsvp: boolean;
  bookFood: boolean;
  attended: boolean;
  paymentPaid: boolean;
  /** Optional when marking paid, required when reverting to unpaid. */
  paymentNote: string;
}>;

export const PAYMENT_NOTE_MAX_LENGTH = 500;

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

export function validateRegistrationBody(
  input: unknown,
): ValidationResult<ValidRegistrationBody> {
  const body = asObject(input);
  if (!body) return fail("Ogiltig begäran");

  const fields: Record<string, string> = {};
  if (!Object.prototype.hasOwnProperty.call(body, "rsvp")) {
    fields.rsvp = "Välj om du kommer eller inte";
  } else if (typeof body.rsvp !== "boolean") {
    fields.rsvp = "Ogiltigt svarsalternativ";
  }

  const hasBookFood =
    Object.prototype.hasOwnProperty.call(body, "bookFood") &&
    body.bookFood !== undefined;
  if (hasBookFood && typeof body.bookFood !== "boolean") {
    fields.bookFood = "Ogiltigt värde för matbokning";
  }

  if (Object.keys(fields).length > 0) return failFields(fields);

  return ok({
    rsvp: body.rsvp as boolean,
    bookFood: hasBookFood ? (body.bookFood as boolean) : false,
  });
}

export function validatePatchAttendanceBody(
  input: unknown,
): ValidationResult<ValidPatchAttendanceBody> {
  const body = asObject(input);
  if (!body) return fail("Ogiltig begäran");

  const out: ValidPatchAttendanceBody = {};
  const keys: Array<"rsvp" | "bookFood" | "attended" | "paymentPaid"> = [
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

  if (Object.prototype.hasOwnProperty.call(body, "paymentNote")) {
    const raw = body.paymentNote;
    if (raw !== null && typeof raw !== "string") {
      return failFields({ paymentNote: "Ogiltig anteckning" });
    }
    const note = typeof raw === "string" ? raw.trim() : "";
    if (note.length > PAYMENT_NOTE_MAX_LENGTH) {
      return failFields({
        paymentNote: `Anteckningen får vara högst ${PAYMENT_NOTE_MAX_LENGTH} tecken`,
      });
    }
    if (typeof out.paymentPaid !== "boolean") {
      return failFields({
        paymentNote: "En anteckning kan bara skickas tillsammans med betalstatus",
      });
    }
    if (note.length > 0) out.paymentNote = note;
  }

  // Reverting a payment is a correction: the reason must be recorded.
  if (out.paymentPaid === false && !out.paymentNote) {
    return failFields({
      paymentNote: "Ange varför betalningen ångras",
    });
  }

  if (Object.keys(out).length === 0) {
    return fail("Minst ett närvarofält måste skickas");
  }

  return ok(out);
}
