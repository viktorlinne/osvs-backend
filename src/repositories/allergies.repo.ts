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
  if (conn) return conn.query(sql, params);
  return pool.query(sql, params);
}

export async function listAllergies(conn?: PoolConnection): Promise<Allergy[]> {
  const [rows] = await exec(
    "SELECT id, title FROM allergies ORDER BY id ASC",
    [],
    conn,
  );
  const arr = Array.isArray(rows) ? (rows as AllergyRow[]) : [];
  return arr
    .map((row) => ({ id: Number(row.id), title: String(row.title ?? "") }))
    .filter((row) => Number.isFinite(row.id)) as Allergy[];
}

export default {
  listAllergies,
};
