import {
  ValidationResult,
  asObject,
  fail,
  ok,
  toNonEmptyString,
} from "./shared";

export type ValidCreateMailBody = {
  lid: number;
  title: string;
  content: string;
};

export function validateCreateMailBody(
  input: unknown,
): ValidationResult<ValidCreateMailBody> {
  const body = asObject(input);
  if (!body) return fail("Body must be an object");

  const lid = Number(body.lid);
  const title = toNonEmptyString(body.title);
  const content = toNonEmptyString(body.content);

  const errors: string[] = [];
  if (!Number.isFinite(lid)) errors.push("lid must be a number");
  if (!title) errors.push("title: required");
  if (!content) errors.push("content: required");
  if (errors.length > 0) return fail(errors);

  return ok({ lid, title: title as string, content: content as string });
}

