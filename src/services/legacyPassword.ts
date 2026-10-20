import crypto from "crypto";

/**
 * Value written to `users.passwordHash` (NOT NULL) for members migrated from the
 * old site. It is not a valid Argon2 encoding, so it can never verify as a
 * password; login rejects it explicitly before Argon2 is consulted.
 * The migration loader must write exactly this value.
 */
export const LEGACY_PASSWORD_PLACEHOLDER = "!legacy-migrated";

const LEGACY_HASH_PATTERN = /^[0-9a-f]{64}$/;

export function isLegacyPasswordPlaceholder(hash: unknown): boolean {
  return hash === LEGACY_PASSWORD_PLACEHOLDER;
}

/**
 * Reproduces the old site's scheme (see scripts/migration/LEGACY-PASSWORDS.md):
 * lowercase hex SHA-256 over `password + salt`, where every UTF-16 code unit
 * contributes exactly one byte (its low byte, VBScript `AscB`). Not UTF-8.
 */
export function computeLegacyPasswordHash(
  password: string,
  salt: string,
  doubleApostrophes: boolean,
): string {
  const pw = doubleApostrophes ? password.replace(/'/g, "''") : password;
  const s = pw + salt;
  const bytes = Buffer.alloc(s.length);
  for (let i = 0; i < s.length; i += 1) {
    bytes[i] = s.charCodeAt(i) & 0xff;
  }
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function hexEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "hex");
  const bufB = Buffer.from(b, "hex");
  if (bufA.length !== bufB.length || bufA.length === 0) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Verifies a password against a stored legacy hash + salt. Accepts the variant
 * with doubled apostrophes (old login page) and the raw variant (old
 * password-change page). Both variants are always computed and compared with
 * a timing-safe comparison.
 */
export function verifyLegacyPassword(
  password: string,
  salt: string,
  storedHash: string,
): boolean {
  if (typeof password !== "string" || password.length === 0) return false;
  if (typeof salt !== "string" || salt.length === 0) return false;
  if (typeof storedHash !== "string") return false;

  const expected = storedHash.trim().toLowerCase();
  if (!LEGACY_HASH_PATTERN.test(expected)) return false;

  const doubled = hexEqual(
    computeLegacyPasswordHash(password, salt, true),
    expected,
  );
  const raw = hexEqual(
    computeLegacyPasswordHash(password, salt, false),
    expected,
  );
  return doubled || raw;
}

export default {
  LEGACY_PASSWORD_PLACEHOLDER,
  isLegacyPasswordPlaceholder,
  computeLegacyPasswordHash,
  verifyLegacyPassword,
};
