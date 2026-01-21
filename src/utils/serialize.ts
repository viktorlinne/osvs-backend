import type { UserRecord, PublicUser } from "@osvs/schemas";

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

export function toPublicUser(user: UserRecord): PublicUser {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    createdAt: String(formatDateOnly(user.createdAt)),
    picture: user.picture ?? null,
    archive: (user.archive as PublicUser["archive"]) ?? undefined,
    firstname: user.firstname,
    lastname: user.lastname,
    dateOfBirth: String(formatDateOnly(user.dateOfBirth)),
    work: user.work ?? null,
    accommodationAvailable:
      user.accommodationAvailable === null
        ? null
        : Boolean(user.accommodationAvailable),
    revokedAt: user.revokedAt ?? null,
    mobile: user.mobile,
    homeNumber: user.homeNumber ?? null,
    city: user.city,
    address: user.address,
    zipcode: user.zipcode,
    notes: user.notes ?? null,
  } as PublicUser;
}
