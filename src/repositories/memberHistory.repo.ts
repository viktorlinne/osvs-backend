import pool from "../config/db";
import type { PoolConnection } from "mysql2/promise";
import type { ResultSetHeader } from "mysql2";

// Repository for editable member history (tjänster + utmärkelser) and the
// per-member change log (`user_change_log`). All SQL is parameterized.

export type ChangeLogEntityType = "official" | "achievement";
export type ChangeLogAction = "create" | "update" | "delete";

export type OfficialEntryRecord = {
  id: number;
  uid: number;
  officialId: number;
  title: string;
  /** "YYYY-MM-DD HH:MM:SS" */
  appointedAt: string;
  /** "YYYY-MM-DD HH:MM:SS" or null when pågående */
  unappointedAt: string | null;
};

export type AchievementEntryRecord = {
  id: number;
  uid: number;
  achievementId: number;
  title: string;
  /** "YYYY-MM-DD HH:MM:SS" */
  awardedAt: string;
};

export type ChangeLogInsert = {
  uid: number;
  entityType: ChangeLogEntityType;
  action: ChangeLogAction;
  entryId: number;
  itemId: number | null;
  oldValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
  note: string | null;
  editorId: number | null;
};

export type ChangeLogRecord = {
  id: number;
  uid: number;
  entityType: ChangeLogEntityType;
  action: ChangeLogAction;
  entryId: number;
  itemId: number | null;
  oldValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
  note: string | null;
  editorId: number | null;
  editorName: string | null;
  createdAt: string;
};

type Row = Record<string, unknown>;

async function exec(
  sql: string,
  params: unknown[] = [],
  conn?: PoolConnection,
): Promise<[unknown, unknown]> {
  if (conn) return conn.query(sql, params);
  return pool.query(sql, params);
}

function asRows(rows: unknown): Row[] {
  return Array.isArray(rows) ? (rows as Row[]) : [];
}

function toNullableString(value: unknown): string | null {
  if (value === null || typeof value === "undefined") return null;
  return String(value);
}

function toNullableNumber(value: unknown): number | null {
  if (value === null || typeof value === "undefined") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function parseJsonColumn(value: unknown): Record<string, unknown> | null {
  if (value === null || typeof value === "undefined") return null;
  // MySQL returns JSON columns parsed; MariaDB returns them as strings.
  if (typeof value === "string") {
    try {
      const parsed: unknown = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  }
  if (typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

const OFFICIAL_ENTRY_SELECT = `
  SELECT
    uo.id,
    uo.uid,
    uo.oid AS officialId,
    o.title,
    DATE_FORMAT(uo.appointedAt, '%Y-%m-%d %H:%i:%s') AS appointedAt,
    DATE_FORMAT(uo.unAppointedAt, '%Y-%m-%d %H:%i:%s') AS unappointedAt
  FROM users_officials uo
  JOIN officials o ON o.id = uo.oid
`;

function mapOfficialEntry(r: Row): OfficialEntryRecord {
  return {
    id: Number(r.id),
    uid: Number(r.uid),
    officialId: Number(r.officialId),
    title: String(r.title ?? ""),
    appointedAt: String(r.appointedAt ?? ""),
    unappointedAt: toNullableString(r.unappointedAt),
  };
}

const ACHIEVEMENT_ENTRY_SELECT = `
  SELECT
    ua.id,
    ua.uid,
    ua.aid AS achievementId,
    a.title,
    DATE_FORMAT(ua.awardedAt, '%Y-%m-%d %H:%i:%s') AS awardedAt
  FROM users_achievements ua
  JOIN achievements a ON a.id = ua.aid
`;

function mapAchievementEntry(r: Row): AchievementEntryRecord {
  return {
    id: Number(r.id),
    uid: Number(r.uid),
    achievementId: Number(r.achievementId),
    title: String(r.title ?? ""),
    awardedAt: String(r.awardedAt ?? ""),
  };
}

// ---------------------------------------------------------------------------
// Lookups
// ---------------------------------------------------------------------------

export async function memberExists(
  uid: number,
  conn?: PoolConnection,
): Promise<boolean> {
  const [rows] = await exec(
    "SELECT 1 AS ok FROM users WHERE matrikelnummer = ? LIMIT 1",
    [uid],
    conn,
  );
  return asRows(rows).length > 0;
}

export async function findOfficialTitle(
  officialId: number,
  conn?: PoolConnection,
): Promise<string | null> {
  const [rows] = await exec(
    "SELECT title FROM officials WHERE id = ? LIMIT 1",
    [officialId],
    conn,
  );
  const arr = asRows(rows);
  return arr.length > 0 ? String(arr[0].title ?? "") : null;
}

export async function findAchievementTitle(
  achievementId: number,
  conn?: PoolConnection,
): Promise<string | null> {
  const [rows] = await exec(
    "SELECT title FROM achievements WHERE id = ? LIMIT 1",
    [achievementId],
    conn,
  );
  const arr = asRows(rows);
  return arr.length > 0 ? String(arr[0].title ?? "") : null;
}

// ---------------------------------------------------------------------------
// Tjänster (users_officials)
// ---------------------------------------------------------------------------

export async function listOfficialEntries(
  uid: number,
): Promise<OfficialEntryRecord[]> {
  const [rows] = await exec(
    `${OFFICIAL_ENTRY_SELECT}
     WHERE uo.uid = ?
     ORDER BY (uo.unAppointedAt IS NULL) DESC, uo.appointedAt DESC, uo.id DESC`,
    [uid],
  );
  return asRows(rows)
    .map(mapOfficialEntry)
    .filter((e) => Number.isFinite(e.id));
}

/** Loads one entry for a member and locks it for the rest of the transaction. */
export async function findOfficialEntryForUpdate(
  uid: number,
  entryId: number,
  conn: PoolConnection,
): Promise<OfficialEntryRecord | null> {
  const [rows] = await exec(
    `${OFFICIAL_ENTRY_SELECT}
     WHERE uo.uid = ? AND uo.id = ?
     LIMIT 1
     FOR UPDATE`,
    [uid, entryId],
    conn,
  );
  const arr = asRows(rows);
  return arr.length > 0 ? mapOfficialEntry(arr[0]) : null;
}

export async function findOfficialEntry(
  uid: number,
  entryId: number,
  conn?: PoolConnection,
): Promise<OfficialEntryRecord | null> {
  const [rows] = await exec(
    `${OFFICIAL_ENTRY_SELECT}
     WHERE uo.uid = ? AND uo.id = ?
     LIMIT 1`,
    [uid, entryId],
    conn,
  );
  const arr = asRows(rows);
  return arr.length > 0 ? mapOfficialEntry(arr[0]) : null;
}

/** True when the member already has an ongoing entry for this official. */
export async function hasOngoingOfficial(
  uid: number,
  officialId: number,
  excludeEntryId: number | null,
  conn: PoolConnection,
): Promise<boolean> {
  const [rows] = await exec(
    `SELECT id FROM users_officials
     WHERE uid = ? AND oid = ? AND unAppointedAt IS NULL AND id <> ?
     LIMIT 1
     FOR UPDATE`,
    [uid, officialId, excludeEntryId ?? 0],
    conn,
  );
  return asRows(rows).length > 0;
}

export async function insertOfficialEntry(
  data: {
    uid: number;
    officialId: number;
    appointedAt: string;
    unappointedAt: string | null;
  },
  conn: PoolConnection,
): Promise<number> {
  const [result] = await exec(
    "INSERT INTO users_officials (uid, oid, appointedAt, unAppointedAt) VALUES (?, ?, ?, ?)",
    [data.uid, data.officialId, data.appointedAt, data.unappointedAt],
    conn,
  );
  const header = result as ResultSetHeader;
  return header && typeof header.insertId === "number" ? header.insertId : 0;
}

export async function updateOfficialEntry(
  entryId: number,
  data: {
    officialId: number;
    appointedAt: string;
    unappointedAt: string | null;
  },
  conn: PoolConnection,
): Promise<void> {
  await exec(
    "UPDATE users_officials SET oid = ?, appointedAt = ?, unAppointedAt = ? WHERE id = ?",
    [data.officialId, data.appointedAt, data.unappointedAt, entryId],
    conn,
  );
}

export async function deleteOfficialEntry(
  entryId: number,
  conn: PoolConnection,
): Promise<void> {
  await exec("DELETE FROM users_officials WHERE id = ?", [entryId], conn);
}

/** Active (ongoing) entries, locked; used by the legacy bulk PUT. */
export async function listOngoingOfficialEntriesForUpdate(
  uid: number,
  conn: PoolConnection,
): Promise<OfficialEntryRecord[]> {
  const [rows] = await exec(
    `${OFFICIAL_ENTRY_SELECT}
     WHERE uo.uid = ? AND uo.unAppointedAt IS NULL
     FOR UPDATE`,
    [uid],
    conn,
  );
  return asRows(rows)
    .map(mapOfficialEntry)
    .filter((e) => Number.isFinite(e.id));
}

// ---------------------------------------------------------------------------
// Utmärkelser (users_achievements)
// ---------------------------------------------------------------------------

export async function listAchievementEntries(
  uid: number,
): Promise<AchievementEntryRecord[]> {
  const [rows] = await exec(
    `${ACHIEVEMENT_ENTRY_SELECT}
     WHERE ua.uid = ?
     ORDER BY ua.awardedAt DESC, ua.id DESC`,
    [uid],
  );
  return asRows(rows)
    .map(mapAchievementEntry)
    .filter((e) => Number.isFinite(e.id));
}

export async function findAchievementEntryForUpdate(
  uid: number,
  entryId: number,
  conn: PoolConnection,
): Promise<AchievementEntryRecord | null> {
  const [rows] = await exec(
    `${ACHIEVEMENT_ENTRY_SELECT}
     WHERE ua.uid = ? AND ua.id = ?
     LIMIT 1
     FOR UPDATE`,
    [uid, entryId],
    conn,
  );
  const arr = asRows(rows);
  return arr.length > 0 ? mapAchievementEntry(arr[0]) : null;
}

export async function findAchievementEntry(
  uid: number,
  entryId: number,
  conn?: PoolConnection,
): Promise<AchievementEntryRecord | null> {
  const [rows] = await exec(
    `${ACHIEVEMENT_ENTRY_SELECT}
     WHERE ua.uid = ? AND ua.id = ?
     LIMIT 1`,
    [uid, entryId],
    conn,
  );
  const arr = asRows(rows);
  return arr.length > 0 ? mapAchievementEntry(arr[0]) : null;
}

export async function insertAchievementEntry(
  data: { uid: number; achievementId: number; awardedAt: string },
  conn: PoolConnection,
): Promise<number> {
  const [result] = await exec(
    "INSERT INTO users_achievements (uid, aid, awardedAt) VALUES (?, ?, ?)",
    [data.uid, data.achievementId, data.awardedAt],
    conn,
  );
  const header = result as ResultSetHeader;
  return header && typeof header.insertId === "number" ? header.insertId : 0;
}

export async function updateAchievementEntry(
  entryId: number,
  data: { achievementId: number; awardedAt: string },
  conn: PoolConnection,
): Promise<void> {
  await exec(
    "UPDATE users_achievements SET aid = ?, awardedAt = ? WHERE id = ?",
    [data.achievementId, data.awardedAt, entryId],
    conn,
  );
}

export async function deleteAchievementEntry(
  entryId: number,
  conn: PoolConnection,
): Promise<void> {
  await exec("DELETE FROM users_achievements WHERE id = ?", [entryId], conn);
}

// ---------------------------------------------------------------------------
// Change log
// ---------------------------------------------------------------------------

export async function insertChangeLog(
  entry: ChangeLogInsert,
  conn: PoolConnection,
): Promise<number> {
  const [result] = await exec(
    `INSERT INTO user_change_log
       (uid, entityType, action, entryId, itemId, oldValue, newValue, note, editorId)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      entry.uid,
      entry.entityType,
      entry.action,
      entry.entryId,
      entry.itemId,
      entry.oldValue === null ? null : JSON.stringify(entry.oldValue),
      entry.newValue === null ? null : JSON.stringify(entry.newValue),
      entry.note,
      entry.editorId,
    ],
    conn,
  );
  const header = result as ResultSetHeader;
  return header && typeof header.insertId === "number" ? header.insertId : 0;
}

export async function listChangeLog(uid: number): Promise<ChangeLogRecord[]> {
  const [rows] = await exec(
    `SELECT
       l.id,
       l.uid,
       l.entityType,
       l.action,
       l.entryId,
       l.itemId,
       l.oldValue,
       l.newValue,
       l.note,
       l.editorId,
       CONCAT_WS(' ', e.firstname, e.lastname) AS editorName,
       DATE_FORMAT(l.createdAt, '%Y-%m-%d %H:%i:%s') AS createdAt
     FROM user_change_log l
     LEFT JOIN users e ON e.matrikelnummer = l.editorId
     WHERE l.uid = ?
     ORDER BY l.createdAt DESC, l.id DESC`,
    [uid],
  );
  return asRows(rows)
    .map((r) => ({
      id: Number(r.id),
      uid: Number(r.uid),
      entityType: (r.entityType === "achievement"
        ? "achievement"
        : "official") as ChangeLogEntityType,
      action: (r.action === "create" || r.action === "delete"
        ? r.action
        : "update") as ChangeLogAction,
      entryId: Number(r.entryId),
      itemId: toNullableNumber(r.itemId),
      oldValue: parseJsonColumn(r.oldValue),
      newValue: parseJsonColumn(r.newValue),
      note: toNullableString(r.note),
      editorId: toNullableNumber(r.editorId),
      editorName:
        typeof r.editorName === "string" && r.editorName.trim().length > 0
          ? r.editorName.trim()
          : null,
      createdAt: String(r.createdAt ?? ""),
    }))
    .filter((r) => Number.isFinite(r.id));
}

export default {
  memberExists,
  findOfficialTitle,
  findAchievementTitle,
  listOfficialEntries,
  findOfficialEntry,
  findOfficialEntryForUpdate,
  hasOngoingOfficial,
  insertOfficialEntry,
  updateOfficialEntry,
  deleteOfficialEntry,
  listOngoingOfficialEntriesForUpdate,
  listAchievementEntries,
  findAchievementEntry,
  findAchievementEntryForUpdate,
  insertAchievementEntry,
  updateAchievementEntry,
  deleteAchievementEntry,
  insertChangeLog,
  listChangeLog,
};
