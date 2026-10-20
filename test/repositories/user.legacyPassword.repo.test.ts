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
  updatePassword,
  upgradeLegacyPassword,
} from "../../src/repositories/user.repo";

const mockedPool = pool as unknown as {
  query: jest.Mock;
};

describe("user.repo legacy password columns", () => {
  beforeEach(() => {
    mockedPool.query.mockReset();
  });

  test("updatePassword (reset/set flow) clears legacy columns", async () => {
    mockedPool.query.mockResolvedValue([{ affectedRows: 1 }]);

    await updatePassword(7, "$argon2id$hash");

    const [sql, params] = mockedPool.query.mock.calls[0];
    expect(sql).toMatch(/SET passwordHash = \?/);
    expect(sql).toMatch(/legacyPasswordHash = NULL/);
    expect(sql).toMatch(/legacyPasswordSalt = NULL/);
    expect(params).toEqual(["$argon2id$hash", 7]);
  });

  test("upgradeLegacyPassword is a single conditional UPDATE", async () => {
    mockedPool.query.mockResolvedValue([{ affectedRows: 1 }]);

    const ok = await upgradeLegacyPassword(42, "$argon2id$new", "abc123");

    expect(ok).toBe(true);
    expect(mockedPool.query).toHaveBeenCalledTimes(1);
    const [sql, params] = mockedPool.query.mock.calls[0];
    expect(sql).toMatch(/^UPDATE users SET passwordHash = \?/);
    expect(sql).toMatch(/legacyPasswordHash = NULL/);
    expect(sql).toMatch(/legacyPasswordSalt = NULL/);
    expect(sql).toMatch(/WHERE matrikelnummer = \? AND legacyPasswordHash = \?$/);
    expect(params).toEqual(["$argon2id$new", 42, "abc123"]);
  });

  test("upgradeLegacyPassword reports when no row was changed", async () => {
    mockedPool.query.mockResolvedValue([{ affectedRows: 0 }]);

    await expect(
      upgradeLegacyPassword(42, "$argon2id$new", "abc123"),
    ).resolves.toBe(false);
  });
});
