import pool from "../config/db";

export async function query<T = unknown>(
  sql: string,
  params?: unknown[]
): Promise<T[]> {
  const [rows] = await pool.execute(sql, params ?? []);
  return rows as T[];
}
