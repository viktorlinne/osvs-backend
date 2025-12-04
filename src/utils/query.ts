import pool from "../config/db";

export async function query<T = any>(
  sql: string,
  params: any[] = []
): Promise<T[]> {
  const [rows] = await pool.execute(sql, params);
  return rows as T[];
}
