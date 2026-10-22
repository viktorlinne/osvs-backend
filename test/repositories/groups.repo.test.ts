jest.mock("../../src/config/db", () => ({
  __esModule: true,
  default: {
    query: jest.fn(),
  },
}));

import pool from "../../src/config/db";
import {
  insertMemberships,
  listGroups,
  updateGroup,
} from "../../src/repositories/groups.repo";

const mockedPool = pool as unknown as { query: jest.Mock };

describe("groups.repo", () => {
  it("adds memberCount and does not report a phantom member for empty groups", async () => {
    mockedPool.query.mockResolvedValue([
      [
        { id: 1, name: "Tom", description: null, uid: null },
        { id: 2, name: "Två", description: "d", uid: 4 },
        { id: 2, name: "Två", description: "d", uid: 7 },
      ],
    ]);

    await expect(listGroups()).resolves.toEqual([
      { id: 1, name: "Tom", description: null, userIds: [], memberCount: 0 },
      { id: 2, name: "Två", description: "d", userIds: [4, 7], memberCount: 2 },
    ]);
  });

  it("only updates provided columns with parameterized SQL", async () => {
    mockedPool.query.mockResolvedValue([{}]);

    await updateGroup(3, { description: null });

    const [sql, params] = mockedPool.query.mock.calls[0];
    expect(sql).toBe(
      "UPDATE `groups` SET description = ? WHERE id = ? AND deletedAt IS NULL",
    );
    expect(params).toEqual([null, 3]);
  });

  it("inserts memberships idempotently", async () => {
    mockedPool.query.mockResolvedValue([{}]);

    await insertMemberships(5, [3, 4]);

    const [sql, params] = mockedPool.query.mock.calls[0];
    expect(sql).toContain("ON DUPLICATE KEY UPDATE");
    expect(params).toEqual([3, 5, 4, 5]);
  });
});
