import pool from "../config/db";
import type { ResultSetHeader } from "mysql2";
import type { PoolConnection } from "mysql2/promise";
import type { Lodge as LodgeRecord } from "../types";

export async function listLodges(
  limit?: number,
  offset?: number
): Promise<LodgeRecord[]> {
  let sql = "SELECT id, name, description, email FROM lodges ORDER BY id ASC";
  if (typeof limit === "number" && Number.isFinite(limit)) {
    const safeLimit = Math.max(0, Math.floor(limit));
    sql += ` LIMIT ${safeLimit}`;
    if (typeof offset === "number" && Number.isFinite(offset)) {
      const safeOffset = Math.max(0, Math.floor(offset));
      sql += ` OFFSET ${safeOffset}`;
    }
  }
  const [rows] = await pool.execute(sql);
  const arr = rows as unknown as Array<Record<string, unknown>>;
  if (!Array.isArray(arr)) return [];
  return arr
    .map((r) => ({
      id: Number(r.id),
      name: String(r.name ?? ""),
      description: r.description == null ? undefined : String(r.description),
      email: r.email == null ? undefined : String(r.email),
    }))
    .filter((r) => Number.isFinite(r.id)) as LodgeRecord[];
}

export async function findLodgeById(id: number) {
  const [rows] = await pool.execute(
    "SELECT id, name, description, email FROM lodges WHERE id = ? LIMIT 1",
    [id]
  );
  const arr = rows as unknown as Array<Record<string, unknown>>;
  if (!Array.isArray(arr) || arr.length === 0) return null;
  const r = arr[0];
  return {
    id: Number(r.id),
    name: String(r.name ?? ""),
    description: r.description == null ? undefined : String(r.description),
    email: r.email == null ? undefined : String(r.email),
  };
}

export async function insertLodge(
  name: string,
  description?: string | null,
  email?: string | null
) {
  const sql = "INSERT INTO lodges (name, description, email) VALUES (?, ?, ?)";
  const params = [name, description ?? null, email ?? null];
  const [result] = (await pool.execute<ResultSetHeader>(
    sql,
    params
  )) as unknown as [ResultSetHeader, unknown];
  return result && typeof result.insertId === "number" ? result.insertId : 0;
}

export async function updateLodgeRecord(
  id: number,
  name?: string,
  description?: string | null,
  email?: string | null
) {
  const sql =
    "UPDATE lodges SET name = COALESCE(?, name), description = ?, email = ? WHERE id = ?";
  await pool.execute(sql, [
    name ?? null,
    description ?? null,
    email ?? null,
    id,
  ]);
}

export async function getUserLodge(userId: number) {
  const sql = `
    SELECT l.id, l.name, l.description, l.email
    FROM lodges l
    JOIN users_lodges ul ON ul.lid = l.id
    WHERE ul.uid = ?
    LIMIT 1
  `;
  const [rows] = await pool.execute(sql, [userId]);
  const arr = rows as unknown as Array<Record<string, unknown>>;
  if (!Array.isArray(arr) || arr.length === 0) return null;
  const r = arr[0];
  return {
    id: Number(r.id),
    name: String(r.name ?? ""),
    description: r.description == null ? undefined : String(r.description),
    email: r.email == null ? undefined : String(r.email),
  };
}

export async function deleteUserLodges(userId: number, conn?: PoolConnection) {
  const executor = conn ? conn.query.bind(conn) : pool.query.bind(pool);
  await executor("DELETE FROM users_lodges WHERE uid = ?", [userId]);
}

export async function insertUserLodge(
  userId: number,
  lodgeId: number,
  conn?: PoolConnection
) {
  const executor = conn ? conn.query.bind(conn) : pool.query.bind(pool);
  await executor("INSERT INTO users_lodges (uid, lid) VALUES (?, ?)", [
    userId,
    lodgeId,
  ]);
}

export default {
  listLodges,
  findLodgeById,
  insertLodge,
  updateLodgeRecord,
  getUserLodge,
  deleteUserLodges,
  insertUserLodge,
};
