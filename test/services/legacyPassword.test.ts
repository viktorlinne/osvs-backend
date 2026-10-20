import {
  LEGACY_PASSWORD_PLACEHOLDER,
  computeLegacyPasswordHash,
  isLegacyPasswordPlaceholder,
  verifyLegacyPassword,
} from "../../src/services/legacyPassword";
import { hashPassword, verifyPassword } from "../../src/services/authService";

// Vectors computed with the reference implementation in
// scripts/migration/LEGACY-PASSWORDS.md (verified against the old sha256.asp).
const ABC_SHA256 =
  "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";
const SWEDISH_PASSWORD = "lösenordåäx"; // "lösenordåäx"
const SWEDISH_SALT = "qwertyu7";
const SWEDISH_HASH =
  "c6c44790b59d59ea232be0913ead8ed2bacf16bb5cca15c59d86662accb3c148";
const SWEDISH_UTF8_HASH =
  "59bc4872b85dd607e5a72b4196f94651c3fa2fcacac39027694ca9b2a4332b50";
const APOS_PASSWORD = "it's-secret";
const APOS_SALT = "abcdefg1";
const APOS_DOUBLED_HASH =
  "63f7ab57f3cf19ffec67c166d3894ad847bbc9bf43196287195b2f7c078a6faf";
const APOS_RAW_HASH =
  "7493dd51be86bbadafd1b2a1c01759d58976ffb80a0f14a7126131f7bf15c79e";

describe("legacyPassword.computeLegacyPasswordHash", () => {
  it("matches the standard SHA-256 vector for plain ASCII", () => {
    expect(computeLegacyPasswordHash("abc", "", true)).toBe(ABC_SHA256);
  });

  it("hashes åäö with the low-byte (Latin-1) rule, not UTF-8", () => {
    const hash = computeLegacyPasswordHash(SWEDISH_PASSWORD, SWEDISH_SALT, true);
    expect(hash).toBe(SWEDISH_HASH);
    expect(hash).not.toBe(SWEDISH_UTF8_HASH);
  });

  it("truncates characters above U+00FF to their low byte", () => {
    // € is U+20AC -> 0xAC
    expect(computeLegacyPasswordHash("€", "", true)).toBe(
      computeLegacyPasswordHash("¬", "", true),
    );
  });

  it("doubles apostrophes only in the doubled variant", () => {
    expect(computeLegacyPasswordHash(APOS_PASSWORD, APOS_SALT, true)).toBe(
      APOS_DOUBLED_HASH,
    );
    expect(computeLegacyPasswordHash(APOS_PASSWORD, APOS_SALT, false)).toBe(
      APOS_RAW_HASH,
    );
  });
});

describe("legacyPassword.verifyLegacyPassword", () => {
  it("accepts the correct non-ASCII password", () => {
    expect(
      verifyLegacyPassword(SWEDISH_PASSWORD, SWEDISH_SALT, SWEDISH_HASH),
    ).toBe(true);
  });

  it("accepts an uppercase stored hash", () => {
    expect(
      verifyLegacyPassword(
        SWEDISH_PASSWORD,
        SWEDISH_SALT,
        SWEDISH_HASH.toUpperCase(),
      ),
    ).toBe(true);
  });

  it("rejects a wrong password, wrong salt and UTF-8-style hashes", () => {
    expect(verifyLegacyPassword("losenordaax", SWEDISH_SALT, SWEDISH_HASH)).toBe(
      false,
    );
    expect(
      verifyLegacyPassword(SWEDISH_PASSWORD, "qwertyu8", SWEDISH_HASH),
    ).toBe(false);
    expect(
      verifyLegacyPassword(SWEDISH_PASSWORD, SWEDISH_SALT, SWEDISH_UTF8_HASH),
    ).toBe(false);
  });

  it("accepts both the doubled-apostrophe and raw variants", () => {
    expect(
      verifyLegacyPassword(APOS_PASSWORD, APOS_SALT, APOS_DOUBLED_HASH),
    ).toBe(true);
    expect(verifyLegacyPassword(APOS_PASSWORD, APOS_SALT, APOS_RAW_HASH)).toBe(
      true,
    );
    expect(verifyLegacyPassword("its-secret", APOS_SALT, APOS_RAW_HASH)).toBe(
      false,
    );
  });

  it("rejects malformed stored hashes and empty inputs", () => {
    expect(verifyLegacyPassword("abc", "", ABC_SHA256)).toBe(false);
    expect(verifyLegacyPassword("", SWEDISH_SALT, SWEDISH_HASH)).toBe(false);
    expect(verifyLegacyPassword(SWEDISH_PASSWORD, SWEDISH_SALT, "")).toBe(false);
    expect(
      verifyLegacyPassword(SWEDISH_PASSWORD, SWEDISH_SALT, "not-a-hash"),
    ).toBe(false);
    expect(
      verifyLegacyPassword(
        SWEDISH_PASSWORD,
        SWEDISH_SALT,
        SWEDISH_HASH.slice(0, 62),
      ),
    ).toBe(false);
  });
});

describe("LEGACY_PASSWORD_PLACEHOLDER", () => {
  it("has the agreed value", () => {
    expect(LEGACY_PASSWORD_PLACEHOLDER).toBe("!legacy-migrated");
    expect(isLegacyPasswordPlaceholder(LEGACY_PASSWORD_PLACEHOLDER)).toBe(true);
    expect(isLegacyPasswordPlaceholder("$argon2id$...")).toBe(false);
  });

  it("never verifies as a password and does not throw", async () => {
    await expect(
      verifyPassword(LEGACY_PASSWORD_PLACEHOLDER, LEGACY_PASSWORD_PLACEHOLDER),
    ).resolves.toBe(false);
    await expect(verifyPassword("", LEGACY_PASSWORD_PLACEHOLDER)).resolves.toBe(
      false,
    );
  });

  it("does not affect normal Argon2 verification", async () => {
    const hash = await hashPassword("correct horse");
    await expect(verifyPassword("correct horse", hash)).resolves.toBe(true);
    await expect(verifyPassword("wrong horse", hash)).resolves.toBe(false);
  });
});
