import type { UserRecord, PublicUser, UserAdminFlags } from "../types";

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

/** Member-directory profile returned to any authenticated member. */
export function toPublicUser(user: UserRecord): PublicUser {
  return {
    matrikelnummer: user.matrikelnummer,
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
    lodgeId: (user as unknown as Record<string, unknown>).lodgeId != null
      ? Number((user as unknown as Record<string, unknown>).lodgeId)
      : null,
    lodgeName: (user as unknown as Record<string, unknown>).lodgeName != null
      ? String((user as unknown as Record<string, unknown>).lodgeName)
      : null,
  } as PublicUser;
}

/**
 * Admin/Editor-only per-user flags. Kept out of `toPublicUser` so they are not
 * exposed through the member directory to ordinary members.
 */
export function toUserAdminFlags(
  user: Pick<UserRecord, "feeExempt" | "standingList">,
): UserAdminFlags {
  return {
    feeExempt: Number(user.feeExempt ?? 0) === 1,
    standingList: Number(user.standingList ?? 0) === 1,
  };
}
