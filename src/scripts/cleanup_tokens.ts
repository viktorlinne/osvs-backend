import dotenv from "dotenv";
import logger from "../utils/logger";
import pool from "../config/db";
import {
  cleanupExpiredRevocations,
  cleanupExpiredRefreshTokens,
} from "../services";

dotenv.config();

async function run() {
  try {
    logger.info("Starting Token Cleanup...");
    await cleanupExpiredRevocations();
    await cleanupExpiredRefreshTokens();
    logger.info("Cleanup Finished");
    // close DB pool and exit successfully
    try {
      await pool.end();
    } catch (e) {
      logger.warn("Failed to close DB pool cleanly:", e);
    }
    process.exit(0);
  } catch (err) {
    logger.error("Cleanup Failed:", err);
    try {
      await pool.end();
    } catch (e) {
      logger.warn("Failed to close DB pool after error:", e);
    }
    process.exit(1);
  }
}

run();
