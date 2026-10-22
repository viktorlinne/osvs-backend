jest.mock("../../src/config/db", () => ({
  __esModule: true,
  default: { query: jest.fn() },
}));

import pool from "../../src/config/db";
import { databaseStorageAdapter } from "../../src/infra/storage/database";

const mockedQuery = (pool as unknown as { query: jest.Mock }).query;

describe("database storage adapter URLs", () => {
  beforeEach(() => mockedQuery.mockReset());

  test("versions media URLs from the checksum without reading the blob", async () => {
    mockedQuery.mockResolvedValueOnce([[{ checksum_sha256: "abcdef0123456789ffff" }]]);

    const url = await databaseStorageAdapter.getUrl("media/42");

    expect(url).toBe("http://localhost:4000/api/media/42?v=abcdef0123456789");
    const [sql, params] = mockedQuery.mock.calls[0];
    expect(sql).toMatch(/SELECT checksum_sha256 FROM media_assets/);
    expect(sql).not.toMatch(/\bdata\b/);
    expect(params).toEqual([42]);
  });

  test("a missing asset still gets an unversioned URL", async () => {
    mockedQuery.mockResolvedValueOnce([[]]);
    await expect(databaseStorageAdapter.getUrl("media/7")).resolves.toBe(
      "http://localhost:4000/api/media/7",
    );
  });
});
