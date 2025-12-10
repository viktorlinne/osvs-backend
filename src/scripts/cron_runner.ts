import logger from "../utils/logger";
import {
  cleanupExpiredRevocations,
  cleanupExpiredRefreshTokens,
} from "../services/tokenService";
import { CRON_INTERVAL_MS } from "../config/constants";

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

// Schedule to run using configurable interval (defaults to 24 hours)
globalThis.setInterval(() => {
  runCleanup();
}, CRON_INTERVAL_MS);

// Keep process alive when run as a script
process.on("SIGINT", () => process.exit());
