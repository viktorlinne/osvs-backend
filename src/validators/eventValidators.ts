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

