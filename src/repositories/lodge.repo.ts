import pool from "../config/db";
import type { ResultSetHeader, RowDataPacket } from "mysql2";
import type { PoolConnection } from "mysql2/promise";
import type { Lodge } from "../types";

function toLodge(row: RowDataPacket): Lodge | null {
  const id = Number(row.id);
  if (!Number.isFinite(id)) return null;

  return {
    id,
    name: String(row.name ?? ""),
    city: String(row.city ?? ""),
    description: String(row.description ?? ""),
    email: row.email == null ? null : String(row.email),
    picture: row.picture == null ? null : String(row.picture),
  };
}

export async function listLodges(): Promise<Lodge[]> {
  const sql =
    "SELECT id, name, city, description, email, picture FROM lodges ORDER BY id ASC";

  const [rows] = await pool.execute<RowDataPacket[]>(sql);
  const arr = rows as RowDataPacket[];
  if (!Array.isArray(arr)) return [];

  const result: Lodge[] = [];
  for (const row of arr) {
    const lodge = toLodge(row);
    if (lodge) result.push(lodge);
  }
  return result;
}

export async function findLodgeById(id: number): Promise<Lodge | null> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    "SELECT id, name, city, description, email, picture FROM lodges WHERE id = ? LIMIT 1",
    [id],
  );
  const arr = rows as RowDataPacket[];
  if (!Array.isArray(arr) || arr.length === 0) return null;
  return toLodge(arr[0]);
}

export async function createLodge(
  name: string,
  city: string,
  description?: string | null,
  email?: string | null,
  picture?: string | null,
) {
  const sql =
    "INSERT INTO lodges (name, city, description, email, picture) VALUES (?, ?, ?, ?, ?)";
  const params = [name, city, description, email, picture];
  const [result] = (await pool.execute<ResultSetHeader>(
    sql,
    params,
  )) as unknown as [ResultSetHeader, unknown];
  return result && typeof result.insertId === "number" ? result.insertId : 0;
}

export async function updateLodge(
  id: number,
  name?: string,
  city?: string,
  description?: string | null,
  email?: string | null,
  picture?: string | null,
) {
  const sql =
    "UPDATE lodges SET name = COALESCE(?, name), city = COALESCE(?, city), description = COALESCE(?, description), email = COALESCE(?, email), picture = COALESCE(?, picture) WHERE id = ?";
  await pool.execute(sql, [
    name ?? null,
    city ?? null,
    description ?? null,
    email ?? null,
    picture ?? null,
    id,
  ]);
}

export async function getUserLodge(userId: number): Promise<Lodge | null> {
  const sql = `
    SELECT l.id, l.name, l.city, l.description, l.email, l.picture
    FROM lodges l
    JOIN users_lodges ul ON ul.lid = l.id
    WHERE ul.uid = ?
    LIMIT 1
  `;
  const [rows] = await pool.execute<RowDataPacket[]>(sql, [userId]);
  const arr = rows as RowDataPacket[];
  if (!Array.isArray(arr) || arr.length === 0) return null;
  return toLodge(arr[0]);
}

export async function deleteUserLodges(userId: number, conn?: PoolConnection) {
  const executor = conn ? conn.query.bind(conn) : pool.query.bind(pool);
  await executor("DELETE FROM users_lodges WHERE uid = ?", [userId]);
}

export async function insertUserLodge(
  userId: number,
  lodgeId: number,
  conn?: PoolConnection,
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
  createLodge,
  updateLodge,
  getUserLodge,
  deleteUserLodges,
  insertUserLodge,
};

export const insertLodge = createLodge;
export const updateLodgeRecord = updateLodge;
