jest.mock("../../src/services/userService", () => ({
  findByEmail: jest.fn(),
  findById: jest.fn(),
  revokeAllSessions: jest.fn(),
}));

jest.mock("../../src/services/authService", () => ({
  verifyPassword: jest.fn(),
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
import { findByEmail } from "../../src/services/userService";
import { verifyPassword } from "../../src/services/authService";
import { createRefreshToken } from "../../src/services/tokenService";
import { setAuthCookies } from "../../src/utils/authTokens";
import { loginWithEmail } from "../../src/services/sessionService";

const mockedFindByEmail = findByEmail as jest.MockedFunction<typeof findByEmail>;
const mockedVerifyPassword = verifyPassword as jest.MockedFunction<typeof verifyPassword>;
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
