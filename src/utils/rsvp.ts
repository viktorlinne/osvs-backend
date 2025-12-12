export type RsvpStatus = "going" | "not-going";

export function toDbRsvp(status: RsvpStatus): number {
  return status === "going" ? 1 : 0;
}

export function fromDbRsvp(value: unknown): RsvpStatus | null {
  const n = Number(value);
  if (Number.isNaN(n)) return null;
  if (n === 1) return "going";
  if (n === 0) return "not-going";
  return null;
}

export default { toDbRsvp, fromDbRsvp };
