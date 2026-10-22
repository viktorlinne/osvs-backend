import fs from "fs";
import path from "path";
import pino from "pino";

/**
 * Optional extra file for slow queries (utils/query.ts). Slow queries are
 * always logged to the main logger (journald in production) as well.
 *
 * SLOW_QUERY_LOG_PATH unset: tmp/slow-queries.log in development, no file in
 * production (the file is never rotated and would grow without bound in the
 * app directory). Set it to a path to enable, or to "" to disable.
 */
const DEFAULT_PATH = process.env.NODE_ENV === "production" ? "" : "tmp/slow-queries.log";
const logPath = (process.env.SLOW_QUERY_LOG_PATH ?? DEFAULT_PATH).trim();

function createSlowQueryLogger(): pino.Logger {
  const level = process.env.SLOW_QUERY_LOG_LEVEL || "info";
  if (!logPath) {
    return pino({ level, enabled: false });
  }
  try {
    fs.mkdirSync(path.dirname(logPath), { recursive: true });
  } catch {
    // ignore mkdir errors; pino will error later if path is invalid
  }
  return pino({ level }, pino.destination(logPath));
}

const slowQueryLogger = createSlowQueryLogger();

export default slowQueryLogger;
