import { assertProductionConfig, getMailingConfig } from "./config/env";
import app from "./app";
import logger from "./utils/logger";
import pool from "./config/db";
import { startMailWorker, stopMailWorker } from "./services/mailWorker";

// Refuse to start production with template/dev values (throws -> exit 1, the
// message is in the journal); log settings that are allowed but suspicious.
for (const warning of assertProductionConfig()) {
  logger.warn({ msg: "config_warning" }, warning);
}

// Fail fast on invalid MAIL_RATE_PER_HOUR / MAIL_DEV_ALLOWLIST.
getMailingConfig();

/** Max clock difference between Node and MySQL before we warn (seconds). */
const CLOCK_SKEW_WARN_SECONDS = 120;

/**
 * Checks DB connectivity and that Node and MySQL agree on local time. Token
 * expiry, the mail worker and "future events" compare JS dates (written in
 * Node's time zone) with MySQL NOW() (the server's time zone); they must match.
 */
async function verifyDbConnection() {
  try {
    const [rows] = await pool.query(
      "SELECT NOW() AS dbNow, @@session.time_zone AS sessionTz, @@system_time_zone AS systemTz",
    );
    const row = Array.isArray(rows) ? (rows[0] as Record<string, unknown>) : undefined;
    logger.info("DB connection OK.");
    const dbNow = row?.dbNow instanceof Date ? row.dbNow.getTime() : NaN;
    if (Number.isFinite(dbNow)) {
      const skewSeconds = Math.round((dbNow - Date.now()) / 1000);
      if (Math.abs(skewSeconds) > CLOCK_SKEW_WARN_SECONDS) {
        logger.warn(
          {
            skewSeconds,
            dbSessionTimeZone: row?.sessionTz,
            dbSystemTimeZone: row?.systemTz,
            nodeTimeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          },
          "Node and MySQL disagree about local time (different time zones?). Use one time zone for both (deploy/README.md).",
        );
      }
    }
  } catch (err) {
    logger.error({ err }, "DB connection failed at startup");
  }
}

void verifyDbConnection();

const PORT = process.env.PORT || 4000;
const server = app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
});

// Background jobs only in the real server (not during tests).
// Set CRON_RUNNER=false to disable in environments that shouldn't run them.
const runBackgroundJobs =
  process.env.NODE_ENV !== "test" && process.env.CRON_RUNNER !== "false";
let stopCron: (() => Promise<void>) | null = null;
let shuttingDown = false;

if (runBackgroundJobs) {
  // Token cleanup + yearly membership fees (src/scripts/cron_runner.ts).
  void import("./scripts/cron_runner").then((cron) => {
    if (shuttingDown) return;
    cron.startCron();
    stopCron = cron.stopCron;
  });
  // Group-mail queue worker (OSVS-24): sends queued mailings in a short
  // interval loop (one tick at a time) inside this long-running process.
  startMailWorker();
}

/**
 * Graceful shutdown on SIGTERM (systemctl stop/restart, deploy) and SIGINT.
 * Stops accepting connections and lets in-flight requests finish, lets the
 * mail worker finish the message it is sending (the rest of its batch goes
 * back to pending), waits for a running cron job, then closes the DB pool.
 * Must finish within systemd's TimeoutStopSec (deploy/systemd: 30 s).
 */
const SHUTDOWN_TIMEOUT_MS = 25_000;

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, "Shutting down");

  const forceExit = globalThis.setTimeout(() => {
    logger.error("Graceful shutdown timed out; exiting");
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);
  forceExit.unref();

  const serverClosed = new Promise<void>((resolve) => {
    server.close(() => resolve());
    // Idle keep-alive sockets would otherwise hold close() open.
    server.closeIdleConnections();
  });

  await Promise.allSettled([
    serverClosed,
    stopMailWorker(),
    stopCron ? stopCron() : Promise.resolve(),
  ]);

  try {
    await pool.end();
  } catch (err) {
    logger.warn({ err }, "DB pool did not close cleanly");
  }
  logger.info("Shutdown complete");
  process.exit(0);
}

process.once("SIGTERM", () => void shutdown("SIGTERM"));
process.once("SIGINT", () => void shutdown("SIGINT"));
