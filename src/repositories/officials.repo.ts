import pool from "../config/db";
import type { PoolConnection } from "mysql2/promise";
import type { Official } from "../types";

type OfficialRow = {
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

export async function listOfficials(): Promise<Official[]> {
  const [rows] = await exec("SELECT id, title FROM officials ORDER BY id ASC");
  const arr = Array.isArray(rows) ? (rows as OfficialRow[]) : [];
  return arr
    .map((r) => ({ id: Number(r.id), title: String(r.title ?? "") }))
    .filter((r) => Number.isFinite(r.id)) as Official[];
}

export default {
  listOfficials,
};
