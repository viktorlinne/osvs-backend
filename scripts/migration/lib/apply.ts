// --apply: writes a MigrationPlan into MySQL in FK-safe order, one
// transaction per table group. Only reached from run.ts after the safety
// gates; the dry run never imports this module's DB code paths.

import fs from "fs";
import path from "path";
import { createHash } from "crypto";
import type { Connection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import type { MigrationPlan } from "./transform";

type Log = (message: string) => void;

/** Same gates as src/db/migrate.ts. Throws when the target must not be written. */
export function assertApplySafetyGate(dbName: string, env: NodeJS.ProcessEnv = process.env): void {
  const nodeEnv = env.NODE_ENV ?? "development";
  if (nodeEnv === "production" && env.MIGRATE_ALLOW_PRODUCTION !== "true") {
    throw new Error(
      "Refusing to run the data migration in NODE_ENV=production. Set MIGRATE_ALLOW_PRODUCTION=true to override.",
    );
  }
  if (nodeEnv !== "production" && !/_dev$|_test$/i.test(dbName) && env.MIGRATE_ALLOW_ANY_DB !== "true") {
    throw new Error(
      `Refusing to run the data migration against DB_NAME=${dbName}. Only databases ending in _dev or _test are allowed. Set MIGRATE_ALLOW_ANY_DB=true to override.`,
    );
  }
}

/** Merges are irreversible: --apply needs --approve-merges=<hash of the reviewed merge report>. */
export function assertMergesApproved(plan: Pick<MigrationPlan, "merges" | "mergeHash">, approved: string | null): void {
  if (plan.merges.length === 0) return;
  if (!approved) {
    throw new Error(
      `${plan.merges.length} duplicate merges are planned. Review _reports/merge-report.md, then re-run with --approve-merges=${plan.mergeHash}.`,
    );
  }
  if (approved !== plan.mergeHash) {
    throw new Error(
      `--approve-merges=${approved} does not match the current merge plan (${plan.mergeHash}). The merge report changed; review it again.`,
    );
  }
}

/** The lookup-table INSERTs from src/db/seed/seed.sql (roles, achievements, officials, allergies, lodges). */
export function selectLookupSeedStatements(statements: string[]): string[] {
  return statements.filter((s) =>
    /^INSERT\s+(IGNORE\s+)?INTO\s+`(roles|achievements|officials|allergies|lodges)`/i.test(s.trim()),
  );
}

const CONTENT_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".gif": "image/gif", ".bmp": "image/bmp", ".webp": "image/webp",
};

function chunks<T>(rows: T[], size = 500): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < rows.length; i += size) out.push(rows.slice(i, i + size));
  return out;
}

async function bulkInsert(conn: Connection, sqlPrefix: string, rows: unknown[][]): Promise<void> {
  for (const part of chunks(rows)) {
    if (part.length) await conn.query(`${sqlPrefix} VALUES ?`, [part]);
  }
}

async function inTransaction(conn: Connection, name: string, log: Log, fn: () => Promise<void>): Promise<void> {
  log(`[${name}] begin`);
  await conn.beginTransaction();
  try {
    await fn();
    await conn.commit();
    log(`[${name}] committed`);
  } catch (err) {
    await conn.rollback();
    log(`[${name}] rolled back`);
    throw err;
  }
}

async function lookupMap(conn: Connection, table: string, column: string): Promise<Map<string, number>> {
  const [rows] = await conn.query<RowDataPacket[]>(`SELECT id, \`${column}\` AS v FROM \`${table}\``);
  return new Map(rows.map((r) => [String(r.v), Number(r.id)]));
}

function requireAll(map: Map<string, number>, wanted: Iterable<string>, label: string): void {
  const missing = [...new Set(wanted)].filter((w) => !map.has(w));
  if (missing.length) {
    throw new Error(`Missing ${label} rows in the target DB: ${missing.join(", ")}. Run with --seed-lookups or seed them first.`);
  }
}

export type ApplyOptions = {
  photosDir: string;
  lookupSeedStatements: string[] | null;
  log: Log;
};

export type ApplyResult = {
  groupIds: Record<number, number>;
  eventIds: Record<string, number>;
  postIds: Record<number, number>;
  mediaIds: Record<number, number>;
  standingListWritten: boolean;
};

export async function applyPlan(conn: Connection, plan: MigrationPlan, options: ApplyOptions): Promise<ApplyResult> {
  const { log } = options;

  if (options.lookupSeedStatements) {
    await inTransaction(conn, "lookups", log, async () => {
      for (const s of options.lookupSeedStatements ?? []) await conn.query(s);
    });
  }

  // --- preflight -------------------------------------------------------------
  const [[{ n: existingUsers }]] = await conn.query<RowDataPacket[]>("SELECT COUNT(*) AS n FROM users");
  if (Number(existingUsers) > 0) {
    throw new Error(
      `users already has ${existingUsers} rows. The loader keeps old member numbers as matrikelnummer and needs an empty users table (fresh DB: npm run migrate, then --seed-lookups).`,
    );
  }
  const [columns] = await conn.query<RowDataPacket[]>(
    "SELECT COLUMN_NAME AS name, COLUMN_TYPE AS type FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'users'",
  );
  const columnType = new Map(columns.map((c) => [String(c.name), String(c.type)]));
  for (const required of ["civicno", "legacyPasswordHash", "legacyPasswordSalt"]) {
    if (!columnType.has(required)) throw new Error(`users.${required} is missing; run npm run migrate (006–008) first.`);
  }
  if (!/Avförd/.test(columnType.get("archive") ?? "")) {
    throw new Error("users.archive does not allow 'Avförd'; run npm run migrate (007) first.");
  }
  const standingList = columnType.has("standingList");
  log(standingList ? "users.standingList exists: Ständiga listan is written" : "users.standingList missing (migration 009 not applied): Ständiga listan is NOT written");

  const roles = await lookupMap(conn, "roles", "role");
  const lodges = await lookupMap(conn, "lodges", "name");
  const achievements = await lookupMap(conn, "achievements", "title");
  const officials = await lookupMap(conn, "officials", "title");
  const allergies = await lookupMap(conn, "allergies", "title");
  requireAll(roles, plan.users.flatMap((u) => u.roles), "roles");
  requireAll(
    lodges,
    [
      ...plan.users.map((u) => u.lodge),
      ...plan.events.map((e) => e.lodge),
      ...plan.posts.flatMap((p) => p.lodges),
    ].filter((l): l is string => !!l),
    "lodges",
  );
  requireAll(achievements, plan.achievements.map((a) => a.title), "achievements");
  requireAll(officials, plan.officials.map((o) => o.title), "officials");
  requireAll(allergies, plan.users.flatMap((u) => u.allergies), "allergies");

  const result: ApplyResult = { groupIds: {}, eventIds: {}, postIds: {}, mediaIds: {}, standingListWritten: standingList };

  // --- users -----------------------------------------------------------------
  await inTransaction(conn, "users", log, async () => {
    const cols = [
      "matrikelnummer", "email", "passwordHash", "legacyPasswordHash", "legacyPasswordSalt", "archive",
      "firstname", "lastname", "dateOfBirth", "civicno", "mobile", "homeNumber", "city", "address",
      "zipcode", "notes", ...(standingList ? ["standingList"] : []),
    ];
    await bulkInsert(
      conn,
      `INSERT INTO users (${cols.map((c) => `\`${c}\``).join(", ")})`,
      plan.users.map((u) => [
        u.matrikelnummer, u.email, u.passwordHash, u.legacyPasswordHash, u.legacyPasswordSalt, u.archive,
        u.firstname, u.lastname, u.dateOfBirth, u.civicno, u.mobile, u.homeNumber, u.city, u.address,
        u.zipcode, u.notes, ...(standingList ? [u.standingList ? 1 : 0] : []),
      ]),
    );
    await bulkInsert(
      conn,
      "INSERT INTO users_roles (uid, rid)",
      plan.users.flatMap((u) => u.roles.map((r) => [u.matrikelnummer, roles.get(r)])),
    );
    await bulkInsert(
      conn,
      "INSERT INTO users_lodges (uid, lid)",
      plan.users.filter((u) => u.lodge).map((u) => [u.matrikelnummer, lodges.get(u.lodge as string)]),
    );
    await bulkInsert(
      conn,
      "INSERT INTO users_allergies (uid, alid)",
      plan.users.flatMap((u) => u.allergies.map((a) => [u.matrikelnummer, allergies.get(a)])),
    );
  });

  // --- profile photos -> media_assets + users.picture ------------------------
  await inTransaction(conn, "photos", log, async () => {
    for (const u of plan.users) {
      if (!u.photoFile) continue;
      const file = path.join(options.photosDir, u.photoFile);
      const data = fs.readFileSync(file);
      const contentType = CONTENT_TYPES[path.extname(file).toLowerCase()] ?? "application/octet-stream";
      const checksum = createHash("sha256").update(data).digest("hex");
      const [res] = await conn.query<ResultSetHeader>(
        "INSERT INTO media_assets (original_key, content_type, byte_size, checksum_sha256, data) VALUES (?, ?, ?, ?, ?)",
        [`profiles/migrated/${u.photoFile}`, contentType, data.length, checksum, data],
      );
      result.mediaIds[u.matrikelnummer] = res.insertId;
      // Same key format as src/infra/storage/database.ts mediaKeyFromId().
      await conn.query("UPDATE users SET picture = ? WHERE matrikelnummer = ?", [`media/${res.insertId}`, u.matrikelnummer]);
    }
  });

  // --- groups ------------------------------------------------------------------
  await inTransaction(conn, "groups", log, async () => {
    for (const g of plan.groups) {
      const [res] = await conn.query<ResultSetHeader>("INSERT INTO `groups` (name, description) VALUES (?, ?)", [g.name, g.description]);
      result.groupIds[g.sourceId] = res.insertId;
    }
    await bulkInsert(
      conn,
      "INSERT INTO users_groups (uid, gid)",
      plan.groupMembers.map((m) => [m.matrikelnummer, result.groupIds[m.groupSourceId]]),
    );
  });

  // --- events + lodges_events + attendances ---------------------------------
  await inTransaction(conn, "events", log, async () => {
    for (const e of plan.events) {
      const [res] = await conn.query<ResultSetHeader>(
        "INSERT INTO events (title, description, lodgeMeeting, food, price, startDate, endDate) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [e.title, e.description, e.lodgeMeeting ? 1 : 0, e.food ? 1 : 0, e.price, e.startDate, e.endDate],
      );
      result.eventIds[e.key] = res.insertId;
    }
    await bulkInsert(
      conn,
      "INSERT INTO lodges_events (lid, eid)",
      plan.events.filter((e) => e.lodge).map((e) => [lodges.get(e.lodge as string), result.eventIds[e.key]]),
    );
    await bulkInsert(
      conn,
      "INSERT INTO events_attendances (uid, eid, rsvp, bookFood, attended)",
      plan.attendances.map((a) => [a.matrikelnummer, result.eventIds[a.eventKey], a.rsvp, a.bookFood, a.attended]),
    );
  });

  // --- posts + lodges_posts ---------------------------------------------------
  await inTransaction(conn, "posts", log, async () => {
    for (const p of plan.posts) {
      const [res] = await conn.query<ResultSetHeader>(
        "INSERT INTO posts (title, description, publicum, createdAt) VALUES (?, ?, ?, ?)",
        [p.title, p.description, p.publicum ? 1 : 0, p.createdAt],
      );
      result.postIds[p.sourceId] = res.insertId;
    }
    await bulkInsert(
      conn,
      "INSERT INTO lodges_posts (lid, pid)",
      plan.posts.flatMap((p) => p.lodges.map((l) => [lodges.get(l), result.postIds[p.sourceId]])),
    );
  });

  // --- achievements + officials -----------------------------------------------
  await inTransaction(conn, "history", log, async () => {
    await bulkInsert(
      conn,
      "INSERT INTO users_achievements (uid, aid, awardedAt)",
      plan.achievements.map((a) => [a.matrikelnummer, achievements.get(a.title), a.awardedAt]),
    );
    await bulkInsert(
      conn,
      "INSERT INTO users_officials (uid, oid, appointedAt, unAppointedAt)",
      plan.officials.map((o) => [o.matrikelnummer, officials.get(o.title), o.appointedAt, o.unAppointedAt]),
    );
  });

  return result;
}
