import type { UpdateLodgeBody } from "../types";
import {
  ValidationResult,
  asObject,
  fail,
  failFields,
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

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateCreateLodgeBody(
  input: unknown,
): ValidationResult<ValidCreateLodgeBody> {
  const body = asObject(input);
  if (!body) return fail("Ogiltig begäran");

  const name = toNonEmptyString(body.name);
  const city = toNonEmptyString(body.city);
  if (!name || !city) {
    return failFields({
      ...(name ? {} : { name: "Namn är obligatoriskt" }),
      ...(city ? {} : { city: "Stad är obligatorisk" }),
    });
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
    return fail("Ogiltig begäran");
  }

  if (email && !EMAIL_PATTERN.test(email)) {
    return failFields({ email: "Ogiltig e-postadress" });
  }

  return ok({ name, city, description, email, picture });
}

export function validateUpdateLodgeBody(
  input: unknown,
): ValidationResult<UpdateLodgeBody> {
  const body = asObject(input);
  if (!body) return fail("Ogiltig begäran");

  const out: UpdateLodgeBody = {};
  const fields: Record<string, string> = {};

  if (Object.prototype.hasOwnProperty.call(body, "name")) {
    const name = toNonEmptyString(body.name);
    if (!name) fields.name = "Namn är obligatoriskt";
    else out.name = name;
  }

  if (Object.prototype.hasOwnProperty.call(body, "city")) {
    const city = toNonEmptyString(body.city);
    if (!city) fields.city = "Stad är obligatorisk";
    else out.city = city;
  }

  if (Object.prototype.hasOwnProperty.call(body, "description")) {
    const description = toNullableString(body.description);
    if (typeof description === "undefined") {
      fields.description = "Ogiltigt värde";
    } else {
      out.description = description;
    }
  }

  if (Object.prototype.hasOwnProperty.call(body, "email")) {
    const email = toNullableString(body.email);
    if (typeof email === "undefined") {
      fields.email = "Ogiltigt värde";
    } else if (email && !EMAIL_PATTERN.test(email)) {
      fields.email = "Ogiltig e-postadress";
    } else {
      out.email = email;
    }
  }

  if (Object.prototype.hasOwnProperty.call(body, "picture")) {
    const picture = toNullableString(body.picture);
    if (typeof picture === "undefined") {
      fields.picture = "Ogiltigt värde";
    } else {
      out.picture = picture;
    }
  }

  if (Object.keys(fields).length > 0) return failFields(fields);
  return ok(out);
}
