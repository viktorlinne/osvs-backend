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
      logger.info("Cron Job DB connection OK. ");
      return;
    } catch (err) {
      logger.warn({ err, attempt: i + 1 }, "DB connection failed, retrying...");
      await new Promise((r) => globalThis.setTimeout(r, ms));
    }
  }
  throw new Error("DB never became ready in time. Aborting...");
}

async function createAnniversaryInvoices() {
  try {
    const now = new Date();
    const month = now.getMonth() + 1; // JS months 0-11
    const day = now.getDate();
    logger.info(
      { month, day },
      "Cron Job Creating membership payments for users",
    );

    const rows = await query<{ matrikelnummer: number }>(
      "SELECT matrikelnummer FROM users WHERE MONTH(createdAt) = ? AND DAY(createdAt) = ?",
      [month, day],
    );
    const uids = rows
      .map((r) => Number(r.matrikelnummer))
      .filter((x) => Number.isFinite(x));
    if (uids.length > 0) {
      try {
        await paymentsService.createMembershipPaymentsIfMissingBulk(
          uids,
          now.getFullYear(),
        );
      } catch (err) {
        logger.warn({ err }, "Failed to bulk-create anniversary payments");
      }
    }
  } catch (err) {
    logger.error("Anniversary payment creation failed:", err);
  }
}

async function runCleanup() {
  try {
    logger.info("Cron Job starting expired token cleanup");
    await cleanupExpiredRevocations();
    await cleanupExpiredRefreshTokens();
    logger.info("Cron Job finished expired token cleanup");
  } catch (err) {
    logger.error("Cron Job expired token cleanup failed:", err);
  }
}

// Run immediately on start after DB is ready
(async function startCron() {
  try {
    await waitForDbReady();
    await runCleanup();
    await createAnniversaryInvoices();
  } catch (err) {
    logger.error(
      "Cron Job startup aborted because DB never became ready:",
      err,
    );
  }
})();

// Schedule to run using configurable interval (defaults to 24 hours)
globalThis.setInterval(() => {
  runCleanup();
  createAnniversaryInvoices();
}, CRON_INTERVAL_MS);

// Keep process alive when run as a script
process.on("SIGINT", () => process.exit());
