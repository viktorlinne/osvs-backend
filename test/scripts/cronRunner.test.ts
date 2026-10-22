jest.mock("../../src/config/db", () => ({
  __esModule: true,
  default: { query: jest.fn(), end: jest.fn() },
}));

jest.mock("../../src/services", () => ({
  cleanupExpiredRevocations: jest.fn(),
  cleanupExpiredRefreshTokens: jest.fn(),
  createMembershipPaymentsIfMissingBulk: jest.fn(),
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
import * as services from "../../src/services";
import { findAnniversaryUserIds } from "../../src/repositories/membership.repo";
import { cleanupExpiredPasswordActionTokens } from "../../src/repositories/token.repo";
import {
  anniversaryDaysByYear,
  createAnniversaryInvoices,
  resolveCronIntervalMs,
  runCleanup,
} from "../../src/scripts/cron_runner";

const mockedQuery = (pool as unknown as { query: jest.Mock }).query;
const mockedBulk = services.createMembershipPaymentsIfMissingBulk as jest.Mock;

describe("anniversaryDaysByYear", () => {
  test("covers the last 7 days including today", () => {
    const days = anniversaryDaysByYear(new Date(2027, 9, 22, 3, 15));
    expect([...days.keys()]).toEqual([2027]);
    expect(days.get(2027)).toEqual([
      { month: 10, day: 16 },
      { month: 10, day: 17 },
      { month: 10, day: 18 },
      { month: 10, day: 19 },
      { month: 10, day: 20 },
      { month: 10, day: 21 },
      { month: 10, day: 22 },
    ]);
  });

  test("bills a missed late-December anniversary for the year it fell in", () => {
    const days = anniversaryDaysByYear(new Date(2028, 0, 2), 4);
    expect(days.get(2027)).toEqual([
      { month: 12, day: 30 },
      { month: 12, day: 31 },
    ]);
    expect(days.get(2028)).toEqual([
      { month: 1, day: 1 },
      { month: 1, day: 2 },
    ]);
  });

  test("29 February members are billed on 28 February in non-leap years", () => {
    expect(anniversaryDaysByYear(new Date(2027, 1, 28), 1).get(2027)).toEqual([
      { month: 2, day: 28 },
      { month: 2, day: 29 },
    ]);
    expect(anniversaryDaysByYear(new Date(2028, 1, 28), 1).get(2028)).toEqual([
      { month: 2, day: 28 },
    ]);
  });
});

describe("findAnniversaryUserIds", () => {
  beforeEach(() => mockedQuery.mockReset());

  test("skips archived members and members created in the fee year", async () => {
    mockedQuery.mockResolvedValueOnce([[{ uid: 7 }, { uid: "9" }]]);
    const uids = await findAnniversaryUserIds(2027, [
      { month: 12, day: 31 },
      { month: 1, day: 1 },
    ]);
    expect(uids).toEqual([7, 9]);
    const [sql, params] = mockedQuery.mock.calls[0];
    expect(sql).toMatch(/archive IS NULL/);
    expect(sql).toMatch(/YEAR\(createdAt\) < \?/);
    expect(params).toEqual([2027, 12, 31, 1, 1]);
  });

  test("no days, no query", async () => {
    expect(await findAnniversaryUserIds(2027, [])).toEqual([]);
    expect(mockedQuery).not.toHaveBeenCalled();
  });
});

describe("createAnniversaryInvoices", () => {
  beforeEach(() => {
    mockedQuery.mockReset();
    mockedBulk.mockReset();
  });

  test("creates missing payments per fee year from the lookback window", async () => {
    // 2028-01-02 with a 7-day window spans 2027 and 2028.
    mockedQuery
      .mockResolvedValueOnce([[{ uid: 11 }]]) // 2027
      .mockResolvedValueOnce([[]]); // 2028
    mockedBulk.mockResolvedValue([{ id: 1 }]);

    await createAnniversaryInvoices(new Date(2028, 0, 2, 4, 0));

    expect(mockedQuery).toHaveBeenCalledTimes(2);
    expect(mockedQuery.mock.calls[0][1][0]).toBe(2027);
    expect(mockedQuery.mock.calls[1][1][0]).toBe(2028);
    expect(mockedBulk).toHaveBeenCalledTimes(1);
    expect(mockedBulk).toHaveBeenCalledWith([11], 2027);
  });

  test("a DB error is logged, not thrown", async () => {
    mockedQuery.mockRejectedValue(new Error("db down"));
    await expect(createAnniversaryInvoices(new Date(2027, 5, 1))).resolves.toBeUndefined();
    expect(mockedBulk).not.toHaveBeenCalled();
  });
});

describe("token cleanup", () => {
  beforeEach(() => mockedQuery.mockReset());

  test("removes password action tokens a grace period after expiry", async () => {
    mockedQuery.mockResolvedValueOnce([{ affectedRows: 3 }]);
    await expect(cleanupExpiredPasswordActionTokens()).resolves.toBe(3);
    expect(mockedQuery).toHaveBeenCalledWith(
      "DELETE FROM password_action_tokens WHERE expiresAt < NOW() - INTERVAL ? DAY",
      [7],
    );
  });

  test("runCleanup cleans all three token tables", async () => {
    mockedQuery.mockResolvedValue([{ affectedRows: 0 }]);
    await runCleanup();
    expect(services.cleanupExpiredRevocations).toHaveBeenCalled();
    expect(services.cleanupExpiredRefreshTokens).toHaveBeenCalled();
    expect(mockedQuery.mock.calls[0][0]).toMatch(/DELETE FROM password_action_tokens/);
  });
});

describe("resolveCronIntervalMs", () => {
  test("rejects invalid or tiny intervals", () => {
    expect(resolveCronIntervalMs(Number.NaN)).toBe(24 * 60 * 60 * 1000);
    expect(resolveCronIntervalMs(5)).toBe(24 * 60 * 60 * 1000);
    expect(resolveCronIntervalMs(60 * 60 * 1000)).toBe(60 * 60 * 1000);
  });
});
