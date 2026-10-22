/**
 * Account status rules shared by login, session renewal and the auth
 * middleware.
 *
 * A member with an archive status (Avliden, Urgången, Avförd) is no longer an
 * active member and must not reach the member directory: login, refresh and
 * every authenticated request are rejected for them.
 */
export const ACCOUNT_INACTIVE_MESSAGE =
  "Inloggningen nekades eftersom ditt konto är arkiverat. Om det är fel, kontakta en administratör eller redaktör så kan de återaktivera kontot.";

/** `details.reason` on the 401 so the login page can show the message above. */
export const ACCOUNT_INACTIVE_REASON = "ACCOUNT_INACTIVE";

export function isArchivedMember(
  user: { archive?: unknown } | null | undefined,
): boolean {
  if (!user) return false;
  const archive = user.archive;
  if (archive === null || typeof archive === "undefined") return false;
  return !(typeof archive === "string" && archive.trim().length === 0);
}

export default { ACCOUNT_INACTIVE_MESSAGE, ACCOUNT_INACTIVE_REASON, isArchivedMember };
