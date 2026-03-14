import {
  ValidationResult,
  asObject,
  fail,
  failFields,
  ok,
  parseNumericIds,
  toNonEmptyString,
} from "./shared";

export type ValidCreatePostBody = {
  title: string;
  description: string;
  lodgeIds: number[];
  publicum: boolean;
};

const TRUE_VALUES = new Set(["1", "true", "on"]);
const FALSE_VALUES = new Set(["0", "false", "off", ""]);

export function parsePublicumBoolean(
  value: unknown,
): ValidationResult<boolean> {
  if (typeof value === "boolean") return ok(value);
  if (typeof value === "number") {
    if (value === 1) return ok(true);
    if (value === 0) return ok(false);
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (TRUE_VALUES.has(normalized)) return ok(true);
    if (FALSE_VALUES.has(normalized)) return ok(false);
  }
  return failFields({ publicum: "Ogiltigt värde för Publicum" });
}

export function validateCreatePostBody(
  input: unknown,
): ValidationResult<ValidCreatePostBody> {
  const body = asObject(input);
  if (!body) return fail("Ogiltig begäran");

  const title = toNonEmptyString(body.title);
  const description = toNonEmptyString(body.description);
  if (!title || !description) {
    return failFields({
      ...(title ? {} : { title: "Titel är obligatorisk" }),
      ...(description ? {} : { description: "Beskrivning är obligatorisk" }),
    });
  }

  const lodgeIds = parseNumericIds(body.lodgeIds);
  const rawPublicum = Object.prototype.hasOwnProperty.call(body, "publicum")
    ? body.publicum
    : undefined;
  let publicum = false;
  if (typeof rawPublicum !== "undefined") {
    const parsedPublicum = parsePublicumBoolean(rawPublicum);
    if (!parsedPublicum.ok) return parsedPublicum;
    publicum = parsedPublicum.data;
  }

  return ok({ title, description, lodgeIds, publicum });
}
