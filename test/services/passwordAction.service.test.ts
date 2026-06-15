jest.mock("../../src/config/db", () => ({
  __esModule: true,
  default: {
    getConnection: jest.fn(),
  },
}));

jest.mock("../../src/services/userService", () => ({
  findByEmail: jest.fn(),
}));

jest.mock("../../src/services/tokenService", () => ({
  createPasswordActionToken: jest.fn(),
  deletePasswordActionTokensForUserAndPurpose: jest.fn(),
  findPasswordActionToken: jest.fn(),
  findPasswordActionTokenForUpdate: jest.fn(),
  revokeAllRefreshTokensForUser: jest.fn(),
  consumePasswordActionTokensForUser: jest.fn(),
}));

jest.mock("../../src/services/mailService", () => ({
  sendPasswordActionMail: jest.fn(),
}));

jest.mock("../../src/repositories/user.repo", () => ({
  updatePassword: jest.fn(),
  setUserRevokedAt: jest.fn(),
}));

jest.mock("../../src/services/authService", () => ({
  generateOpaquePassword: jest.fn(),
  hashPassword: jest.fn(),
  validatePasswordInput: jest.fn(),
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

import pool from "../../src/config/db";
import { ValidationError } from "../../src/utils/errors";
import { findByEmail } from "../../src/services/userService";
import {
  consumePasswordActionTokensForUser,
  createPasswordActionToken,
  deletePasswordActionTokensForUserAndPurpose,
  findPasswordActionToken,
  findPasswordActionTokenForUpdate,
  revokeAllRefreshTokensForUser,
} from "../../src/services/tokenService";
import { sendPasswordActionMail } from "../../src/services/mailService";
import * as userRepo from "../../src/repositories/user.repo";
import {
  hashPassword,
  validatePasswordInput,
} from "../../src/services/authService";
import {
  completePasswordAction,
  requestPasswordReset,
  verifyPasswordAction,
} from "../../src/services/passwordActionService";

const mockedPool = pool as unknown as {
  getConnection: jest.Mock;
};

const mockedFindByEmail = findByEmail as jest.MockedFunction<typeof findByEmail>;
const mockedCreatePasswordActionToken =
  createPasswordActionToken as jest.MockedFunction<typeof createPasswordActionToken>;
const mockedDeletePasswordActionTokensForUserAndPurpose =
  deletePasswordActionTokensForUserAndPurpose as jest.MockedFunction<
    typeof deletePasswordActionTokensForUserAndPurpose
  >;
const mockedFindPasswordActionToken =
  findPasswordActionToken as jest.MockedFunction<typeof findPasswordActionToken>;
const mockedFindPasswordActionTokenForUpdate =
  findPasswordActionTokenForUpdate as jest.MockedFunction<
    typeof findPasswordActionTokenForUpdate
  >;
const mockedRevokeAllRefreshTokensForUser =
  revokeAllRefreshTokensForUser as jest.MockedFunction<
    typeof revokeAllRefreshTokensForUser
  >;
const mockedConsumePasswordActionTokensForUser =
  consumePasswordActionTokensForUser as jest.MockedFunction<
    typeof consumePasswordActionTokensForUser
  >;
const mockedSendPasswordActionMail =
  sendPasswordActionMail as jest.MockedFunction<typeof sendPasswordActionMail>;
const mockedUserRepo = userRepo as jest.Mocked<typeof userRepo>;
const mockedHashPassword =
  hashPassword as jest.MockedFunction<typeof hashPassword>;
const mockedValidatePasswordInput =
  validatePasswordInput as jest.MockedFunction<typeof validatePasswordInput>;

function createConnectionMock() {
  return {
    beginTransaction: jest.fn().mockResolvedValue(undefined),
    commit: jest.fn().mockResolvedValue(undefined),
    rollback: jest.fn().mockResolvedValue(undefined),
    release: jest.fn(),
  };
}

describe("passwordActionService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedValidatePasswordInput.mockReturnValue(null);
    mockedHashPassword.mockResolvedValue("hashed-password");
  });

  it("sends a reset email for an existing user", async () => {
    mockedFindByEmail.mockResolvedValue({
      matrikelnummer: 7,
      email: "member@example.com",
      createdAt: "2026-06-08T08:00:00.000Z",
      firstname: "Ny",
      lastname: "Medlem",
      dateOfBirth: "1990-01-01",
      mobile: "0700000000",
      city: "Karlskrona",
      address: "Gatan 1",
      zipcode: "37130",
    });

    await requestPasswordReset("member@example.com");

    expect(
      mockedDeletePasswordActionTokensForUserAndPurpose,
    ).toHaveBeenCalledWith(7, "RESET_PASSWORD");
    expect(mockedCreatePasswordActionToken).toHaveBeenCalledWith(
      expect.any(String),
      7,
      "RESET_PASSWORD",
      expect.any(Date),
      expect.any(Date),
    );

    const rawToken = mockedCreatePasswordActionToken.mock.calls[0][0];
    expect(mockedSendPasswordActionMail).toHaveBeenCalledWith(
      expect.objectContaining({
        purpose: "RESET_PASSWORD",
        toEmail: "member@example.com",
        token: rawToken,
      }),
    );
  });

  it("silently ignores password reset requests for unknown emails", async () => {
    mockedFindByEmail.mockResolvedValue(undefined);

    await requestPasswordReset("missing@example.com");

    expect(mockedCreatePasswordActionToken).not.toHaveBeenCalled();
    expect(mockedSendPasswordActionMail).not.toHaveBeenCalled();
  });

  it("rejects invalid or expired password action tokens during verification", async () => {
    mockedFindPasswordActionToken.mockResolvedValue(null);

    await expect(verifyPasswordAction("bad-token")).rejects.toHaveProperty(
      "status",
      400,
    );
  });

  it("updates the password and revokes sessions in one transaction", async () => {
    const conn = createConnectionMock();
    mockedPool.getConnection.mockResolvedValue(conn);
    mockedFindPasswordActionTokenForUpdate.mockResolvedValue({
      uid: 7,
      purpose: "RESET_PASSWORD",
      expiresAt: new Date(Date.now() + 60_000),
      createdAt: new Date(Date.now() - 60_000),
      consumedAt: null,
      email: "member@example.com",
      firstname: "Ny",
      lastname: "Medlem",
    });

    await completePasswordAction("good-token", "secret123");

    expect(conn.beginTransaction).toHaveBeenCalled();
    expect(mockedUserRepo.updatePassword).toHaveBeenCalledWith(
      7,
      "hashed-password",
      conn,
    );
    expect(mockedUserRepo.setUserRevokedAt).toHaveBeenCalledWith(
      7,
      expect.any(Date),
      conn,
    );
    expect(mockedRevokeAllRefreshTokensForUser).toHaveBeenCalledWith(7, conn);
    expect(mockedConsumePasswordActionTokensForUser).toHaveBeenCalledWith(
      7,
      expect.any(Date),
      conn,
    );
    expect(conn.commit).toHaveBeenCalled();
    expect(conn.rollback).not.toHaveBeenCalled();
    expect(conn.release).toHaveBeenCalled();
  });

  it("returns a field validation error for weak passwords", async () => {
    mockedValidatePasswordInput.mockReturnValue(
      "Lösenordet måste vara minst 6 tecken",
    );

    await expect(
      completePasswordAction("good-token", "123"),
    ).rejects.toBeInstanceOf(ValidationError);

    expect(mockedPool.getConnection).not.toHaveBeenCalled();
  });
});
