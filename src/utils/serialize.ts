import type { UserRecord, PublicUser } from "@osvs/types";

/** Format a JS Date or string to a local YYYY-MM-DD date-only string. */
export function formatDateOnly(d: unknown): string | unknown {
  if (typeof d === "string") return d;
  if (d instanceof Date) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }
  return d;
}

// Convert a DB UserRecord into a PublicUser for API responses.
export function toPublicUser(user: UserRecord): PublicUser {
  const { passwordHash: _passwordHash, ...safe } = user;

  const normalized = {
    ...safe,
    dateOfBirth: formatDateOnly(safe.dateOfBirth),
    createdAt: formatDateOnly(safe.createdAt),
  };

  return normalized as PublicUser;
}
