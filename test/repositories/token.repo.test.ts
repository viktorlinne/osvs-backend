jest.mock("../../src/config/db", () => ({
  __esModule: true,
  default: {
    query: jest.fn(),
  },
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
import {
  insertRefreshToken,
  markRefreshTokenRevokedByHash,
} from "../../src/repositories/token.repo";

const mockedPool = pool as unknown as {
  query: jest.Mock;
};

describe("token.repo refresh token timestamps", () => {
  beforeEach(() => {
    mockedPool.query.mockReset();
    mockedPool.query.mockResolvedValue([{}]);
  });

  test("stores refresh token createdAt from the app instead of MySQL NOW()", async () => {
    const createdAt = new Date("2026-06-08T08:00:00.000Z");
    const expiresAt = new Date("2026-07-08T08:00:00.000Z");

    await insertRefreshToken("hash", 7, expiresAt, createdAt);

    expect(mockedPool.query).toHaveBeenCalledWith(
      "INSERT INTO refresh_tokens (token_hash, uid, expiresAt, createdAt, isRevoked) VALUES (?, ?, ?, ?, 0)",
      ["hash", 7, expiresAt, createdAt],
    );
  });

  test("stores refresh token lastUsed from the app instead of MySQL NOW()", async () => {
    const lastUsedAt = new Date("2026-06-08T08:15:00.000Z");

    await markRefreshTokenRevokedByHash("hash", lastUsedAt, "next-hash");

    expect(mockedPool.query).toHaveBeenCalledWith(
      "UPDATE refresh_tokens SET isRevoked = 1, replacedBy = ?, lastUsed = ? WHERE token_hash = ? AND isRevoked = 0",
      ["next-hash", lastUsedAt, "hash"],
    );
  });
});
