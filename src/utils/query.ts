import pool from "../config/db";
import logger from "./logger";
import slowQueryLogger from "./slowQueryLogger";

export async function query<T = unknown>(
  sql: string,
  params?: unknown[]
): Promise<T[]> {
  const start = Date.now();
  const [rows] = await pool.execute(sql, params ?? []);
  const dur = Date.now() - start;
  const threshold = Number(process.env.SLOW_QUERY_THRESHOLD_MS ?? 200);
  if (dur > threshold) {
    const shortSql = sql.length > 200 ? sql.slice(0, 200) + "..." : sql;
    logger.warn({ msg: "slow_query", sql: shortSql, duration: dur });
    try {
      slowQueryLogger.info({
        type: "slow_query",
        timestamp: new Date().toISOString(),
        duration: dur,
        threshold,
        sql: shortSql,
        paramsCount: Array.isArray(params) ? params.length : 0,
      });
    } catch (e) {
      // don't let logging failures break app flow
      logger.error({ msg: "slow_query_log_failed", err: String(e) });
    }
  }
  return rows as T[];
}
