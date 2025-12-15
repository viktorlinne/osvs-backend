import pool from "../config/db";
import type { ResultSetHeader } from "mysql2";

export type EstablishmentRecord = {
  id: number;
  name: string;
  description: string | null;
};

export async function listEstablishments(limit?: number, offset?: number) {
  const params: Array<unknown> = [];
  let sql =
    "SELECT id, name, description FROM establishments ORDER BY name ASC";
  if (typeof limit === "number") {
    sql += " LIMIT ?";
    params.push(limit);
    if (typeof offset === "number") {
      sql += " OFFSET ?";
      params.push(offset);
    }
  }
  const [rows] = await pool.execute(sql, params);
  return rows as unknown as Array<Record<string, unknown>>;
}

export async function findById(id: number) {
  const [rows] = await pool.execute(
    "SELECT id, name, description FROM establishments WHERE id = ? LIMIT 1",
    [id]
  );
  const arr = rows as unknown as Array<Record<string, unknown>>;
  return arr[0] ?? null;
}

export async function insertEstablishment(payload: {
  name: string;
  description?: string | null;
}) {
  const sql = "INSERT INTO establishments (name, description) VALUES (?, ?)";
  const params = [payload.name, payload.description ?? null];
  const [result] = (await pool.execute<ResultSetHeader>(
    sql,
    params
  )) as unknown as [ResultSetHeader, unknown];
  return result && typeof result.insertId === "number" ? result.insertId : 0;
}

export async function updateEstablishmentRecord(
  id: number,
  payload: Record<string, unknown>
) {
  const sets: string[] = [];
  const params: Array<unknown> = [];
  if (typeof payload.name !== "undefined") {
    sets.push("name = ?");
    params.push(payload.name);
  }
  if (typeof payload.description !== "undefined") {
    sets.push("description = ?");
    params.push(payload.description ?? null);
  }
  if (sets.length === 0) return;
  params.push(id);
  const sql = `UPDATE establishments SET ${sets.join(", ")} WHERE id = ?`;
  await pool.execute(sql, params);
}

export async function deleteEstablishment(id: number) {
  await pool.execute("DELETE FROM establishments WHERE id = ?", [id]);
}

export async function insertLodgeEstablishment(esId: number, lodgeId: number) {
  await pool.execute(
    "INSERT IGNORE INTO lodges_establishments (lid, esid) VALUES (?, ?)",
    [lodgeId, esId]
  );
}

export async function deleteLodgeEstablishment(esId: number, lodgeId: number) {
  await pool.execute(
    "DELETE FROM lodges_establishments WHERE lid = ? AND esid = ?",
    [lodgeId, esId]
  );
}

export default {
  listEstablishments,
  findById,
  insertEstablishment,
  updateEstablishmentRecord,
  deleteEstablishment,
  insertLodgeEstablishment,
  deleteLodgeEstablishment,
};
