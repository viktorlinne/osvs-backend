import pool from "../config/db";
import type { PoolConnection } from "mysql2/promise";
import type { Group } from "../types";

type GroupListRow = {
  id?: unknown;
  name?: unknown;
  description?: unknown;
  uid?: unknown;
};

type UserIdRow = {
  uid?: unknown;
};

function asRows<T>(rows: unknown): T[] {
  return Array.isArray(rows) ? (rows as T[]) : [];
}

function getExecutor(conn?: PoolConnection) {
  return conn ? conn.query.bind(conn) : pool.query.bind(pool);
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
      };
      groupsById.set(id, group);
    }

    const uid = Number(row.uid);
    if (Number.isFinite(uid) && !group.userIds.includes(uid)) {
      group.userIds.push(uid);
    }
  }

  return Array.from(groupsById.values());
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

  return asRows<UserIdRow>(rows)
    .map((row) => Number(row.uid))
    .filter((id): id is number => Number.isFinite(id));
}

export default {
  listGroups,
  selectUserIdsForGroups,
};
