import type { UpdateLodgeBody } from "../types";
import {
  ValidationResult,
  asObject,
  fail,
  ok,
  toNonEmptyString,
  toNullableString,
} from "./shared";

export type ValidCreateLodgeBody = {
  name: string;
  city: string;
  description?: string | null;
  email?: string | null;
  picture?: string | null;
};

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
    (typeof body.description !== "undefined" &&
      typeof description === "undefined") ||
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

