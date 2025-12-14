import pool from "../config/db";
import type { ResultSetHeader } from "mysql2";

export interface LodgeRecord {
  id: number;
  name: string;
  description: string | null;
}

export async function listLodges(
  limit?: number,
  offset?: number
): Promise<LodgeRecord[]> {
  const params: Array<unknown> = [];
  let sql = "SELECT id, name, description FROM lodges ORDER BY id ASC";
  if (typeof limit === "number") {
    sql += " LIMIT ?";
    params.push(limit);
    if (typeof offset === "number") {
      sql += " OFFSET ?";
      params.push(offset);
    }
  }
  const [rows] = await pool.execute(sql, params);
  const arr = rows as unknown as Array<Record<string, unknown>>;
  if (!Array.isArray(arr)) return [];
  return arr
    .map((r) => ({
      id: Number(r.id),
      name: String(r.name ?? ""),
      description: r.description == null ? null : String(r.description),
    }))
    .filter((r) => Number.isFinite(r.id));
}

export async function findLodgeById(id: number): Promise<LodgeRecord | null> {
  const [rows] = await pool.execute(
    "SELECT id, name, description FROM lodges WHERE id = ? LIMIT 1",
    [id]
  );
  const arr = rows as unknown as Array<Record<string, unknown>>;
  if (!Array.isArray(arr) || arr.length === 0) return null;
  const r = arr[0];
  return {
    id: Number(r.id),
    name: String(r.name ?? ""),
    description: r.description == null ? null : String(r.description),
  };
}

export async function createLodge(
  name: string,
  description?: string | null
): Promise<number> {
  const sql = "INSERT INTO lodges (name, description) VALUES (?, ?)";
  const params = [name, description ?? null];
  const [result] = await pool.execute<ResultSetHeader>(sql, params);
  return result && typeof result.insertId === "number" ? result.insertId : 0;
}

export async function updateLodge(
  id: number,
  name?: string,
  description?: string | null
): Promise<void> {
  const sql =
    "UPDATE lodges SET name = COALESCE(?, name), description = ? WHERE id = ?";
  await pool.execute(sql, [name ?? null, description ?? null, id]);
}

export async function getUserLodge(
  userId: number
): Promise<LodgeRecord | null> {
  const sql = `
    SELECT l.id, l.name, l.description
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
    description: r.description == null ? null : String(r.description),
  };
}

export async function setUserLodge(
  userId: number,
  lodgeId: number | null
): Promise<void> {
  // Atomic replace: remove existing and insert new (if lodgeId provided)
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query("DELETE FROM users_lodges WHERE uid = ?", [userId]);
    if (lodgeId !== null) {
      await conn.query("INSERT INTO users_lodges (uid, lid) VALUES (?, ?)", [
        userId,
        lodgeId,
      ]);
    }
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

export default {
  listLodges,
  findLodgeById,
  createLodge,
  updateLodge,
  getUserLodge,
  setUserLodge,
};
