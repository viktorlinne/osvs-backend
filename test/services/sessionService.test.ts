jest.mock("../../src/services/userService", () => ({
  findByEmail: jest.fn(),
  findById: jest.fn(),
  revokeAllSessions: jest.fn(),
  upgradeLegacyPassword: jest.fn(),
}));

jest.mock("../../src/services/authService", () => ({
  verifyPassword: jest.fn(),
  hashPassword: jest.fn(),
}));

jest.mock("../../src/services/tokenService", () => ({
  createRefreshToken: jest.fn(),
  findRefreshToken: jest.fn(),
  revokeRefreshToken: jest.fn(),
  rotateRefreshToken: jest.fn(),
  revokeJti: jest.fn(),
}));

jest.mock("../../src/utils/authTokens", () => ({
  createAccessToken: jest.fn(() => "access-token"),
  generateRefreshToken: jest.fn(() => "refresh-token"),
  setAuthCookies: jest.fn(),
  clearAuthCookies: jest.fn(),
  getAccessTokenFromReq: jest.fn(),
}));

jest.mock("../../src/utils/logger", () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    fatal: jest.fn(),
    child() {
      return this;
    },
  },
}));

import type { Response } from "express";
import {
  findByEmail,
  upgradeLegacyPassword,
} from "../../src/services/userService";
import { hashPassword, verifyPassword } from "../../src/services/authService";
import { LEGACY_PASSWORD_PLACEHOLDER } from "../../src/services/legacyPassword";
import { createRefreshToken } from "../../src/services/tokenService";
import { setAuthCookies } from "../../src/utils/authTokens";
import { loginWithEmail } from "../../src/services/sessionService";

const mockedFindByEmail = findByEmail as jest.MockedFunction<typeof findByEmail>;
const mockedVerifyPassword = verifyPassword as jest.MockedFunction<typeof verifyPassword>;
const mockedHashPassword = hashPassword as jest.MockedFunction<typeof hashPassword>;
const mockedUpgradeLegacyPassword = upgradeLegacyPassword as jest.MockedFunction<
  typeof upgradeLegacyPassword
>;
const mockedCreateRefreshToken = createRefreshToken as jest.MockedFunction<
  typeof createRefreshToken
>;
const mockedSetAuthCookies = setAuthCookies as jest.MockedFunction<typeof setAuthCookies>;

function createResponseMock(): Response {
  return {
    cookie: jest.fn(),
    clearCookie: jest.fn(),
  } as unknown as Response;
}

describe("sessionService.loginWithEmail", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedFindByEmail.mockResolvedValue({
      matrikelnummer: 12,
      email: "member@example.com",
      passwordHash: "hash",
    } as never);
    mockedVerifyPassword.mockResolvedValue(true);
    mockedCreateRefreshToken.mockResolvedValue(undefined);
  });

  it("returns null for unknown email", async () => {
    mockedFindByEmail.mockResolvedValue(undefined);

    const result = await loginWithEmail(
      "missing@example.com",
      "secret",
      createResponseMock(),
    );

    expect(result).toBeNull();
    expect(mockedSetAuthCookies).not.toHaveBeenCalled();
  });

  it("returns null for invalid password", async () => {
    mockedVerifyPassword.mockResolvedValue(false);

    const result = await loginWithEmail(
      "member@example.com",
      "wrong",
      createResponseMock(),
    );

    expect(result).toBeNull();
    expect(mockedSetAuthCookies).not.toHaveBeenCalled();
  });

  it("creates session cookies on successful login", async () => {
    const res = createResponseMock();

    const result = await loginWithEmail("member@example.com", "secret", res);

    expect(result).not.toBeNull();
    expect(result?.session.inactivityTimeoutMs).toBeGreaterThan(0);
    expect(mockedCreateRefreshToken).toHaveBeenCalled();
    expect(mockedSetAuthCookies).toHaveBeenCalledWith(
      res,
      "access-token",
      "refresh-token",
      expect.any(Number),
    );
  });
});

describe("sessionService.loginWithEmail with legacy passwords", () => {
  // Reference vectors from scripts/migration/LEGACY-PASSWORDS.md
  const SWEDISH_PASSWORD = "lösenordåäx";
  const SWEDISH_SALT = "qwertyu7";
  const SWEDISH_HASH =
    "c6c44790b59d59ea232be0913ead8ed2bacf16bb5cca15c59d86662accb3c148";
  const APOS_PASSWORD = "it's-secret";
  const APOS_SALT = "abcdefg1";
  const APOS_DOUBLED_HASH =
    "63f7ab57f3cf19ffec67c166d3894ad847bbc9bf43196287195b2f7c078a6faf";
  const APOS_RAW_HASH =
    "7493dd51be86bbadafd1b2a1c01759d58976ffb80a0f14a7126131f7bf15c79e";

  function legacyUser(hash: string, salt: string) {
    return {
      matrikelnummer: 42,
      email: "legacy@example.com",
      passwordHash: LEGACY_PASSWORD_PLACEHOLDER,
      legacyPasswordHash: hash,
      legacyPasswordSalt: salt,
    };
  }

  beforeEach(() => {
    jest.clearAllMocks();
    mockedHashPassword.mockResolvedValue("$argon2id$new-hash");
    mockedUpgradeLegacyPassword.mockResolvedValue(true);
    mockedCreateRefreshToken.mockResolvedValue(undefined);
  });

  it("upgrades a correct legacy password to Argon2id and logs in", async () => {
    mockedFindByEmail.mockResolvedValue(
      legacyUser(SWEDISH_HASH, SWEDISH_SALT) as never,
    );
    const res = createResponseMock();

    const result = await loginWithEmail(
      "legacy@example.com",
      SWEDISH_PASSWORD,
      res,
    );

    expect(result).not.toBeNull();
    expect(mockedHashPassword).toHaveBeenCalledWith(SWEDISH_PASSWORD);
    expect(mockedUpgradeLegacyPassword).toHaveBeenCalledWith(
      42,
      "$argon2id$new-hash",
      SWEDISH_HASH,
    );
    expect(mockedVerifyPassword).not.toHaveBeenCalled();
    expect(mockedCreateRefreshToken).toHaveBeenCalled();
    expect(mockedSetAuthCookies).toHaveBeenCalled();
  });

  it("rejects a wrong legacy password without upgrading", async () => {
    mockedFindByEmail.mockResolvedValue(
      legacyUser(SWEDISH_HASH, SWEDISH_SALT) as never,
    );

    const result = await loginWithEmail(
      "legacy@example.com",
      "losenordaax",
      createResponseMock(),
    );

    expect(result).toBeNull();
    expect(mockedHashPassword).not.toHaveBeenCalled();
    expect(mockedUpgradeLegacyPassword).not.toHaveBeenCalled();
    expect(mockedVerifyPassword).not.toHaveBeenCalled();
    expect(mockedSetAuthCookies).not.toHaveBeenCalled();
  });

  it.each([
    ["doubled apostrophes (old login page)", APOS_DOUBLED_HASH],
    ["raw apostrophes (old password-change page)", APOS_RAW_HASH],
  ])("accepts a legacy hash stored with %s", async (_label, hash) => {
    mockedFindByEmail.mockResolvedValue(legacyUser(hash, APOS_SALT) as never);

    const result = await loginWithEmail(
      "legacy@example.com",
      APOS_PASSWORD,
      createResponseMock(),
    );

    expect(result).not.toBeNull();
    expect(mockedUpgradeLegacyPassword).toHaveBeenCalledWith(
      42,
      "$argon2id$new-hash",
      hash,
    );
  });

  it("rejects login when the upgrade no longer applies (concurrent reset)", async () => {
    mockedFindByEmail.mockResolvedValue(
      legacyUser(SWEDISH_HASH, SWEDISH_SALT) as never,
    );
    mockedUpgradeLegacyPassword.mockResolvedValue(false);

    const result = await loginWithEmail(
      "legacy@example.com",
      SWEDISH_PASSWORD,
      createResponseMock(),
    );

    expect(result).toBeNull();
    expect(mockedSetAuthCookies).not.toHaveBeenCalled();
  });

  it("rejects a placeholder user without a legacy hash", async () => {
    mockedFindByEmail.mockResolvedValue({
      matrikelnummer: 43,
      email: "nohash@example.com",
      passwordHash: LEGACY_PASSWORD_PLACEHOLDER,
      legacyPasswordHash: null,
      legacyPasswordSalt: "abcdefg1",
    } as never);

    const result = await loginWithEmail(
      "nohash@example.com",
      LEGACY_PASSWORD_PLACEHOLDER,
      createResponseMock(),
    );

    expect(result).toBeNull();
    expect(mockedVerifyPassword).not.toHaveBeenCalled();
    expect(mockedUpgradeLegacyPassword).not.toHaveBeenCalled();
    expect(mockedSetAuthCookies).not.toHaveBeenCalled();
  });

  it("keeps the Argon2 path for users without legacy columns", async () => {
    mockedFindByEmail.mockResolvedValue({
      matrikelnummer: 12,
      email: "member@example.com",
      passwordHash: "$argon2id$existing",
      legacyPasswordHash: null,
      legacyPasswordSalt: null,
    } as never);
    mockedVerifyPassword.mockResolvedValue(true);

    const result = await loginWithEmail(
      "member@example.com",
      "secret",
      createResponseMock(),
    );

    expect(result).not.toBeNull();
    expect(mockedVerifyPassword).toHaveBeenCalledWith(
      "secret",
      "$argon2id$existing",
    );
    expect(mockedUpgradeLegacyPassword).not.toHaveBeenCalled();
    expect(mockedHashPassword).not.toHaveBeenCalled();
  });
});
