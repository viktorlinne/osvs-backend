import dotenv from "dotenv";
import logger from "../utils/logger";
import pool from "../config/db";
import {
  cleanupExpiredRevocations,
  cleanupExpiredRefreshTokens,
} from "../services/tokenService";

dotenv.config();

async function run() {
  try {
    logger.info("Starting cleanup: revoked JTIs and expired refresh tokens");
    await cleanupExpiredRevocations();
    await cleanupExpiredRefreshTokens();
    logger.info("Cleanup finished");
    // close DB pool and exit successfully
    try {
      await pool.end();
    } catch (e) {
      logger.warn("Failed to close DB pool cleanly:", e);
    }
    process.exit(0);
  } catch (err) {
    logger.error("Cleanup failed:", err);
    try {
      await pool.end();
    } catch (e) {
      logger.warn("Failed to close DB pool after error:", e);
    }
    process.exit(1);
  }
}

run();
