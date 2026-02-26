import pool from "../config/db";
import type { PoolConnection } from "mysql2/promise";
import type { Allergy } from "../types";

type AllergyRow = {
  id?: unknown;
  title?: unknown;
};

async function exec(
  sql: string,
  params: unknown[] = [],
  conn?: PoolConnection,
): Promise<[unknown, unknown]> {
  if (conn) return conn.execute(sql, params);
  return pool.execute(sql, params);
}

export async function listAllergies(): Promise<Allergy[]> {
  const [rows] = await exec("SELECT id, title FROM allergies ORDER BY id ASC");
  const arr = Array.isArray(rows) ? (rows as AllergyRow[]) : [];
  return arr
    .map((row) => ({ id: Number(row.id), title: String(row.title ?? "") }))
    .filter((row) => Number.isFinite(row.id)) as Allergy[];
}

export default {
  listAllergies,
};
