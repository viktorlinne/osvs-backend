import fs from "fs";
import path from "path";
import { splitSqlStatements } from "../../src/db/migrateUtils";

const sql = fs.readFileSync(
  path.resolve(__dirname, "../../src/db/migrations/014_event_payment_audit.sql"),
  "utf8",
);

describe("migration 014 event payment audit", () => {
  const statements = splitSqlStatements(sql);

  it("only adds nullable audit columns (no backfill, no data change)", () => {
    expect(statements).toHaveLength(2);
    const alter = statements[0];
    expect(alter).toMatch(/^ALTER TABLE `event_payments`/);
    expect(alter).toMatch(/`paidAt` datetime DEFAULT NULL/);
    expect(alter).toMatch(/`paidBy` int\(11\) DEFAULT NULL/);
    expect(alter).toMatch(/`method` enum\('manual', 'swish'\) DEFAULT NULL/);
    expect(alter).toMatch(/`note` varchar\(500\) DEFAULT NULL/);
    expect(alter).toMatch(/REFERENCES `users` \(`matrikelnummer`\) ON DELETE SET NULL/);
    for (const statement of statements) {
      expect(statement).not.toMatch(/^\s*(UPDATE|DELETE|INSERT|DROP)\b/i);
      expect(statement).not.toMatch(/\bDROP\s+(COLUMN|TABLE)\b/i);
    }
  });

  it("creates an append-only log that survives deleted events", () => {
    const create = statements[1];
    expect(create).toMatch(/^CREATE TABLE `event_payment_log`/);
    expect(create).toMatch(/`action` enum\('paid', 'unpaid'\) NOT NULL/);
    expect(create).toMatch(/`byUid` int\(11\) DEFAULT NULL/);
    // eid/uid are not foreign keys so history outlives the payment row.
    expect(create).not.toMatch(/REFERENCES `events`/);
  });
});
