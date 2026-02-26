import type { CreateUserInput, UserRecord } from "../../types";

// Type guard to ensure DB result is a valid UserRecord
export function isValidUserRecord(value: unknown): value is UserRecord {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.matrikelnummer === "number" &&
    typeof record.email === "string" &&
    (typeof record.passwordHash === "undefined" ||
      typeof record.passwordHash === "string") &&
    (typeof record.createdAt === "string" ||
      record.createdAt instanceof Date) &&
    (typeof record.revokedAt === "undefined" ||
      typeof record.revokedAt === "string" ||
      record.revokedAt instanceof Date ||
      record.revokedAt === null) &&
    (typeof record.picture === "undefined" ||
      typeof record.picture === "string" ||
      record.picture === null) &&
    (typeof record.archive === "undefined" ||
      record.archive === null ||
      record.archive === "Deceased" ||
      record.archive === "Retired" ||
      record.archive === "Removed") &&
    typeof record.firstname === "string" &&
    typeof record.lastname === "string" &&
    (typeof record.dateOfBirth === "string" ||
      record.dateOfBirth instanceof Date) &&
    (typeof record.work === "undefined" ||
      typeof record.work === "string" ||
      record.work === null) &&
    (typeof record.accommodationAvailable === "undefined" ||
      typeof record.accommodationAvailable === "number" ||
      typeof record.accommodationAvailable === "boolean" ||
      record.accommodationAvailable === null) &&
    typeof record.mobile === "string" &&
    (typeof record.homeNumber === "undefined" ||
      typeof record.homeNumber === "string" ||
      record.homeNumber === null) &&
    typeof record.city === "string" &&
    typeof record.address === "string" &&
    typeof record.zipcode === "string" &&
    (typeof record.notes === "undefined" ||
      typeof record.notes === "string" ||
      record.notes === null)
  );
}

// Helper to trim all string fields in input
export function trimUserInput(input: CreateUserInput): CreateUserInput {
  const trimIfString = (v: unknown) =>
    typeof v === "string" ? v.trim() : undefined;
  const trimRequired = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  return {
    ...input,
    email: trimRequired(input.email),
    firstname: trimRequired(input.firstname),
    lastname: trimRequired(input.lastname),
    dateOfBirth: trimRequired(input.dateOfBirth),
    work: trimRequired(input.work),
    homeNumber: trimIfString(input.homeNumber) as string | undefined,
    notes: trimIfString(input.notes) as string | undefined,
    mobile: trimRequired(input.mobile),
    city: trimRequired(input.city),
    address: trimRequired(input.address),
    zipcode: trimRequired(input.zipcode),
  } as CreateUserInput;
}
