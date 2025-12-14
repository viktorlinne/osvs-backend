import pool from "../config/db";
import type { ResultSetHeader } from "mysql2";

export type EstablishmentRecord = {
  id: number;
  name: string;
  description: string | null;
};

export async function listEstablishments(
  limit?: number,
  offset?: number
): Promise<EstablishmentRecord[]> {
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

export async function getEstablishmentById(
  id: number
): Promise<EstablishmentRecord | null> {
  const [rows] = await pool.execute(
    "SELECT id, name, description FROM establishments WHERE id = ? LIMIT 1",
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

export async function createEstablishment(payload: {
  name: string;
  description?: string | null;
}): Promise<number> {
  const sql = "INSERT INTO establishments (name, description) VALUES (?, ?)";
  const params = [payload.name, payload.description ?? null];
  const [result] = await pool.execute<ResultSetHeader>(sql, params);
  return result && typeof result.insertId === "number" ? result.insertId : 0;
}

export async function updateEstablishment(
  id: number,
  payload: Partial<{ name: string; description?: string | null }>
): Promise<void> {
  const sets: string[] = [];
  const params: Array<unknown> = [];
  if (payload.name !== undefined) {
    sets.push("name = ?");
    params.push(payload.name);
  }
  if (payload.description !== undefined) {
    sets.push("description = ?");
    params.push(payload.description ?? null);
  }
  if (sets.length === 0) return;
  params.push(id);
  const sql = `UPDATE establishments SET ${sets.join(", ")} WHERE id = ?`;
  await pool.execute(sql, params);
}

export async function deleteEstablishment(id: number): Promise<void> {
  await pool.execute("DELETE FROM establishments WHERE id = ?", [id]);
}

// Link / unlink lodges
export async function linkLodgeToEstablishment(
  estId: number,
  lodgeId: number
): Promise<void> {
  await pool.execute(
    "INSERT IGNORE INTO lodges_establishments (lid, esid) VALUES (?, ?)",
    [lodgeId, estId]
  );
}

export async function unlinkLodgeFromEstablishment(
  estId: number,
  lodgeId: number
): Promise<void> {
  await pool.execute(
    "DELETE FROM lodges_establishments WHERE lid = ? AND esid = ?",
    [lodgeId, estId]
  );
}

export default {
  listEstablishments,
  getEstablishmentById,
  createEstablishment,
  updateEstablishment,
  deleteEstablishment,
  linkLodgeToEstablishment,
  unlinkLodgeFromEstablishment,
};
