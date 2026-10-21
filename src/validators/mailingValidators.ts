import { ValidationResult, asObject, fail, failFields, ok } from "./shared";

export const MAILING_SUBJECT_MAX_LENGTH = 200;
export const MAILING_BODY_MAX_LENGTH = 20000;

export type ValidCreateMailingBody = {
  subject: string;
  body: string;
};

export function validateCreateMailingBody(
  input: unknown,
): ValidationResult<ValidCreateMailingBody> {
  const body = asObject(input);
  if (!body) return fail("Ogiltig begäran");

  const fields: Record<string, string> = {};

  const subject = typeof body.subject === "string" ? body.subject.trim() : "";
  if (typeof body.subject !== "undefined" && typeof body.subject !== "string") {
    fields.subject = "Ogiltigt ämne";
  } else if (subject.length === 0) {
    fields.subject = "Ämne är obligatoriskt";
  } else if (subject.length > MAILING_SUBJECT_MAX_LENGTH) {
    fields.subject = `Ämnet får vara högst ${MAILING_SUBJECT_MAX_LENGTH} tecken`;
  } else if (/[\r\n]/.test(subject)) {
    fields.subject = "Ämnet får inte innehålla radbrytningar";
  }

  const text =
    typeof body.body === "string" ? body.body.replace(/\r\n?/g, "\n").trim() : "";
  if (typeof body.body !== "undefined" && typeof body.body !== "string") {
    fields.body = "Ogiltigt meddelande";
  } else if (text.length === 0) {
    fields.body = "Meddelande är obligatoriskt";
  } else if (text.length > MAILING_BODY_MAX_LENGTH) {
    fields.body = `Meddelandet får vara högst ${MAILING_BODY_MAX_LENGTH} tecken`;
  }

  if (Object.keys(fields).length > 0) return failFields(fields);
  return ok({ subject, body: text });
}
