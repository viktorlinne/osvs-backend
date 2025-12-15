import logger from "../utils/logger";
import {
  cleanupExpiredRevocations,
  cleanupExpiredRefreshTokens,
} from "../services";
import { CRON_INTERVAL_MS } from "../config/constants";
import { query } from "../utils/query";
import * as paymentsService from "../services";
import db from "../config/db";

/** Wait for DB to be reachable before running cron tasks. */
async function waitForDbReady(retries = 30, ms = 1000) {
  for (let i = 0; i < retries; i++) {
    try {
      // simple query to confirm connection
      await db.query("SELECT 1");
      logger.info("DB connection OK. Server time:", new Date().toISOString());
      return;
    } catch (err) {
      logger.warn({ err, attempt: i + 1 }, "DB not ready yet, retrying...");
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => setTimeout(r, ms));
    }
  }
  throw new Error("DB did not become ready in time");
}

async function createAnniversaryInvoices() {
  try {
    const now = new Date();
    const month = now.getMonth() + 1; // JS months 0-11
    const day = now.getDate();
    logger.info(
      { month, day },
      "Cron: creating anniversary invoices for users"
    );

    const rows = await query<{ id: number }>(
      "SELECT id FROM users WHERE MONTH(createdAt) = ? AND DAY(createdAt) = ?",
      [month, day]
    );
    const uids = rows
      .map((r) => Number(r.id))
      .filter((x) => Number.isFinite(x));
    if (uids.length > 0) {
      try {
        await paymentsService.createMembershipPaymentsIfMissingBulk(
          uids,
          now.getFullYear()
        );
      } catch (err) {
        logger.warn({ err }, "Failed to bulk-create anniversary invoices");
      }
    }
  } catch (err) {
    logger.error("Anniversary invoice creation failed:", err);
  }
}

async function runCleanup() {
  try {
    logger.info("Cron cleanup: starting expired token cleanup");
    await cleanupExpiredRevocations();
    await cleanupExpiredRefreshTokens();
    logger.info("Cron cleanup: finished");
  } catch (err) {
    logger.error("Cron cleanup failed:", err);
  }
}

// Run immediately on start after DB is ready
(async function startCron() {
  try {
    await waitForDbReady();
    await runCleanup();
    await createAnniversaryInvoices();
  } catch (err) {
    logger.error("Cron startup aborted because DB never became ready:", err);
  }
})();

// Schedule to run using configurable interval (defaults to 24 hours)
globalThis.setInterval(() => {
  runCleanup();
  createAnniversaryInvoices();
}, CRON_INTERVAL_MS);

// Keep process alive when run as a script
process.on("SIGINT", () => process.exit());
