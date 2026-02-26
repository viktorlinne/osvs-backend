import {
  ValidationResult,
  asObject,
  fail,
  ok,
  parseNumericIds,
  toNonEmptyString,
} from "./shared";

export type ValidCreatePostBody = {
  title: string;
  description: string;
  lodgeIds: number[];
};

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
