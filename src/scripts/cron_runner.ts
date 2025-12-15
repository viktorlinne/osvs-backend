import logger from "../utils/logger";
import {
  cleanupExpiredRevocations,
  cleanupExpiredRefreshTokens,
} from "../services";
import { CRON_INTERVAL_MS } from "../config/constants";
import { query } from "../utils/query";
import * as paymentsService from "../services";

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

// Run immediately on start
runCleanup();
// Also run anniversary invoice creation immediately on start
createAnniversaryInvoices();

// Schedule to run using configurable interval (defaults to 24 hours)
globalThis.setInterval(() => {
  runCleanup();
  createAnniversaryInvoices();
}, CRON_INTERVAL_MS);

// Keep process alive when run as a script
process.on("SIGINT", () => process.exit());
