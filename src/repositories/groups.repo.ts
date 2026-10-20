import pool from "../config/db";
import type { ResultSetHeader } from "mysql2";
import type { PoolConnection } from "mysql2/promise";
import type { Group, GroupMember } from "../types";

type GroupListRow = {
  id?: unknown;
  name?: unknown;
  description?: unknown;
  uid?: unknown;
};

type UserIdRow = {
  uid?: unknown;
};

type IdRow = {
  id?: unknown;
};

type GroupMemberRow = {
  matrikelnummer?: unknown;
  firstname?: unknown;
  lastname?: unknown;
  email?: unknown;
  archive?: unknown;
};

function asRows<T>(rows: unknown): T[] {
  return Array.isArray(rows) ? (rows as T[]) : [];
}

function getExecutor(conn?: PoolConnection) {
  return conn ? conn.query.bind(conn) : pool.query.bind(pool);
}

function toUserIds(rows: unknown): number[] {
  return asRows<UserIdRow>(rows)
    .map((row) => Number(row.uid))
    .filter((id): id is number => Number.isFinite(id));
}

function groupRowsToGroups(rows: unknown): Group[] {
  const groupsById = new Map<number, Group>();
  for (const row of asRows<GroupListRow>(rows)) {
    const id = Number(row.id);
    if (!Number.isFinite(id)) continue;

    let group = groupsById.get(id);
    if (!group) {
      group = {
        id,
        name: String(row.name ?? ""),
        description: row.description == null ? null : String(row.description),
        userIds: [],
        memberCount: 0,
      };
      groupsById.set(id, group);
    }

    const uid = Number(row.uid);
    if (row.uid != null && Number.isFinite(uid) && !group.userIds.includes(uid)) {
      group.userIds.push(uid);
    }
  }

  const groups = Array.from(groupsById.values());
  for (const group of groups) group.memberCount = group.userIds.length;
  return groups;
}

export async function listGroups(): Promise<Group[]> {
  const [rows] = await pool.query(
    `
      SELECT g.id, g.name, g.description, ug.uid
      FROM \`groups\` g
      LEFT JOIN users_groups ug ON ug.gid = g.id
      ORDER BY g.name ASC, g.id ASC, ug.uid ASC
    `,
  );

  return groupRowsToGroups(rows);
}

export async function findGroupById(id: number): Promise<Group | null> {
  const [rows] = await pool.query(
    `
      SELECT g.id, g.name, g.description, ug.uid
      FROM \`groups\` g
      LEFT JOIN users_groups ug ON ug.gid = g.id
      WHERE g.id = ?
      ORDER BY ug.uid ASC
    `,
    [id],
  );

  return groupRowsToGroups(rows)[0] ?? null;
}

/**
 * Case-insensitive, whitespace-trimmed name lookup for the "unique-ish" name
 * check. There is intentionally no DB unique index on groups.name (imported
 * legacy mail lists may contain duplicates), so this check is advisory.
 */
export async function findGroupIdByName(
  name: string,
  excludeId?: number,
): Promise<number | null> {
  const params: unknown[] = [name.trim()];
  let sql = "SELECT id FROM `groups` WHERE LOWER(TRIM(name)) = LOWER(?)";
  if (typeof excludeId === "number") {
    sql += " AND id <> ?";
    params.push(excludeId);
  }
  sql += " LIMIT 1";

  const [rows] = await pool.query(sql, params);
  const first = asRows<IdRow>(rows)[0];
  if (!first) return null;
  const id = Number(first.id);
  return Number.isFinite(id) ? id : null;
}

export async function insertGroup(
  name: string,
  description: string | null,
): Promise<number> {
  const [result] = await pool.query<ResultSetHeader>(
    "INSERT INTO `groups` (name, description) VALUES (?, ?)",
    [name, description],
  );
  return result && typeof result.insertId === "number" ? result.insertId : 0;
}

export async function updateGroup(
  id: number,
  changes: { name?: string; description?: string | null },
): Promise<void> {
  const sets: string[] = [];
  const params: unknown[] = [];
  if (typeof changes.name === "string") {
    sets.push("name = ?");
    params.push(changes.name);
  }
  if (Object.prototype.hasOwnProperty.call(changes, "description")) {
    sets.push("description = ?");
    params.push(changes.description ?? null);
  }
  if (sets.length === 0) return;

  params.push(id);
  await pool.query(
    `UPDATE \`groups\` SET ${sets.join(", ")} WHERE id = ?`,
    params,
  );
}

/** Memberships (users_groups) and event links (groups_events) cascade via FK. */
export async function deleteGroup(id: number): Promise<number> {
  const [result] = await pool.query<ResultSetHeader>(
    "DELETE FROM `groups` WHERE id = ?",
    [id],
  );
  return result && typeof result.affectedRows === "number"
    ? result.affectedRows
    : 0;
}

export async function listGroupMembers(gid: number): Promise<GroupMember[]> {
  const [rows] = await pool.query(
    `
      SELECT u.matrikelnummer, u.firstname, u.lastname, u.email, u.archive
      FROM users_groups ug
      JOIN users u ON u.matrikelnummer = ug.uid
      WHERE ug.gid = ?
      ORDER BY u.lastname ASC, u.firstname ASC, u.matrikelnummer ASC
    `,
    [gid],
  );

  const members: GroupMember[] = [];
  for (const row of asRows<GroupMemberRow>(rows)) {
    const matrikelnummer = Number(row.matrikelnummer);
    if (!Number.isFinite(matrikelnummer)) continue;
    members.push({
      matrikelnummer,
      firstname: String(row.firstname ?? ""),
      lastname: String(row.lastname ?? ""),
      email: String(row.email ?? ""),
      archive: row.archive == null ? null : String(row.archive),
    });
  }
  return members;
}

export async function selectExistingUserIds(
  userIds: number[],
  conn?: PoolConnection,
): Promise<number[]> {
  if (userIds.length === 0) return [];
  const placeholders = userIds.map(() => "?").join(",");
  const executor = getExecutor(conn);
  const [rows] = await executor(
    `SELECT matrikelnummer AS uid FROM users WHERE matrikelnummer IN (${placeholders})`,
    userIds,
  );
  return toUserIds(rows);
}

export async function selectMemberIdsInGroup(
  gid: number,
  userIds: number[],
  conn?: PoolConnection,
): Promise<number[]> {
  if (userIds.length === 0) return [];
  const placeholders = userIds.map(() => "?").join(",");
  const executor = getExecutor(conn);
  const [rows] = await executor(
    `SELECT uid FROM users_groups WHERE gid = ? AND uid IN (${placeholders})`,
    [gid, ...userIds],
  );
  return toUserIds(rows);
}

export async function insertMemberships(
  gid: number,
  userIds: number[],
  conn?: PoolConnection,
): Promise<void> {
  if (userIds.length === 0) return;
  const placeholders = userIds.map(() => "(?, ?)").join(",");
  const params = userIds.flatMap((uid) => [uid, gid]);
  const executor = getExecutor(conn);
  // ON DUPLICATE KEY keeps concurrent adds idempotent without masking FK errors
  // (unlike INSERT IGNORE).
  await executor(
    `INSERT INTO users_groups (uid, gid) VALUES ${placeholders} ON DUPLICATE KEY UPDATE gid = gid`,
    params,
  );
}

export async function deleteMembership(gid: number, uid: number): Promise<number> {
  const [result] = await pool.query<ResultSetHeader>(
    "DELETE FROM users_groups WHERE gid = ? AND uid = ?",
    [gid, uid],
  );
  return result && typeof result.affectedRows === "number"
    ? result.affectedRows
    : 0;
}

export async function selectUserIdsForGroups(
  groupIds: number[],
  conn?: PoolConnection,
): Promise<number[]> {
  const normalizedGroupIds = Array.from(
    new Set(
      (Array.isArray(groupIds) ? groupIds : [])
        .map((id) => Number(id))
        .filter((id): id is number => Number.isFinite(id) && id > 0),
    ),
  );
  if (normalizedGroupIds.length === 0) return [];

  const placeholders = normalizedGroupIds.map(() => "?").join(",");
  const executor = getExecutor(conn);
  const [rows] = await executor(
    `
      SELECT DISTINCT uid
      FROM users_groups
      WHERE gid IN (${placeholders})
      ORDER BY uid ASC
    `,
    normalizedGroupIds,
  );

  return toUserIds(rows);
}

export default {
  listGroups,
  findGroupById,
  findGroupIdByName,
  insertGroup,
  updateGroup,
  deleteGroup,
  listGroupMembers,
  selectExistingUserIds,
  selectMemberIdsInGroup,
  insertMemberships,
  deleteMembership,
  selectUserIdsForGroups,
};
