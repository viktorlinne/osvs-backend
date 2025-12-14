import fs from "fs";
import path from "path";
import pino from "pino";

const DEFAULT_PATH = "tmp/slow-queries.log";
const logPath = process.env.SLOW_QUERY_LOG_PATH || DEFAULT_PATH;
const logDir = path.dirname(logPath);

try {
  fs.mkdirSync(logDir, { recursive: true });
} catch {
  // ignore mkdir errors; pino will error later if path is invalid
}

const dest = pino.destination(logPath);

const slowQueryLogger = pino(
  { level: process.env.SLOW_QUERY_LOG_LEVEL || "info" },
  dest
);

export default slowQueryLogger;
