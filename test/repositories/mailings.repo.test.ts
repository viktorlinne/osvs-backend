jest.mock("../../src/config/db", () => ({
  __esModule: true,
  default: { query: jest.fn(), getConnection: jest.fn() },
}));

import fs from "fs";
import path from "path";
import pool from "../../src/config/db";
import {
  claimDueRows,
  countSentInLastHour,
  markFinishedMailingsDone,
  releaseStaleClaims,
} from "../../src/repositories/mailings.repo";

const mockedQuery = pool.query as unknown as jest.Mock;

function sqlOf(call: unknown[]): string {
  return String(call[0]).replace(/\s+/g, " ");
}

describe("mailings repo: worker queries", () => {
  it("counts sends in a rolling 60-minute window by sentAt on the DB clock", async () => {
    mockedQuery.mockResolvedValueOnce([[{ n: 7 }]]);
    await expect(countSentInLastHour()).resolves.toBe(7);
    expect(sqlOf(mockedQuery.mock.calls[0])).toContain(
      "FROM mail_outbox WHERE sentAt >= NOW() - INTERVAL 60 MINUTE",
    );
  });

  it("returns stale in-progress rows to pending", async () => {
    mockedQuery.mockResolvedValueOnce([{ affectedRows: 2 }]);
    await expect(releaseStaleClaims(10)).resolves.toBe(2);
    const sql = sqlOf(mockedQuery.mock.calls[0]);
    expect(sql).toContain("SET status = 'pending'");
    expect(sql).toContain("WHERE status = 'sending' AND claimedAt < NOW() - INTERVAL ? MINUTE");
    expect(mockedQuery.mock.calls[0][1]).toEqual([10]);
  });

  it("claims only due pending rows of active mailings, atomically", async () => {
    mockedQuery
      .mockResolvedValueOnce([[{ id: 3 }, { id: 4 }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([
        [
          {
            id: 3,
            mailingId: 17,
            toEmail: "a@example.com",
            attempts: 0,
            subject: "S",
            body: "B",
            groupName: "G",
            senderEmail: null,
          },
        ],
      ])
      .mockResolvedValueOnce([{ affectedRows: 1 }]);

    const rows = await claimDueRows(5);

    expect(rows).toHaveLength(1);
    expect(sqlOf(mockedQuery.mock.calls[0])).toContain(
      "(o.nextAttemptAt IS NULL OR o.nextAttemptAt <= NOW()) AND m.status IN ('queued', 'sending')",
    );
    expect(sqlOf(mockedQuery.mock.calls[1])).toContain(
      "WHERE status = 'pending' AND id IN (?,?)",
    );
    expect(sqlOf(mockedQuery.mock.calls[3])).toContain(
      "UPDATE mailings SET status = 'sending' WHERE status = 'queued'",
    );
  });

  it("does not query when the budget is zero", async () => {
    await expect(claimDueRows(0)).resolves.toEqual([]);
    expect(mockedQuery).not.toHaveBeenCalled();
  });

  it("marks mailings done only when nothing is pending or in progress", async () => {
    mockedQuery.mockResolvedValueOnce([{ affectedRows: 1 }]);
    await markFinishedMailingsDone();
    expect(sqlOf(mockedQuery.mock.calls[0])).toContain(
      "o.status IN ('pending', 'sending')",
    );
  });
});

describe("migration 013", () => {
  const sql = fs.readFileSync(
    path.resolve(__dirname, "../../src/db/migrations/013_group_mailings.sql"),
    "utf8",
  );

  it("keeps mailing history when the group or sender is deleted", () => {
    expect(sql).toMatch(/FOREIGN KEY \(`gid`\) REFERENCES `groups` \(`id`\) ON DELETE SET NULL/);
    expect(sql).toMatch(/FOREIGN KEY \(`senderId`\) REFERENCES `users` \(`matrikelnummer`\) ON DELETE SET NULL/);
    expect(sql).toMatch(/FOREIGN KEY \(`uid`\) REFERENCES `users` \(`matrikelnummer`\) ON DELETE SET NULL/);
  });

  it("deletes outbox rows with their mailing", () => {
    expect(sql).toMatch(/FOREIGN KEY \(`mailingId`\) REFERENCES `mailings` \(`id`\) ON DELETE CASCADE/);
  });

  it("defines the status enums", () => {
    expect(sql).toContain("enum('queued', 'sending', 'done', 'cancelled')");
    expect(sql).toContain("enum('pending', 'sending', 'sent', 'failed', 'skipped')");
  });
});
