import dotenv from "dotenv";
import logger from "../utils/logger";
import pool from "../config/db";
import {
  cleanupExpiredRevocations,
  cleanupExpiredRefreshTokens,
} from "../services";
import { cleanupExpiredPasswordActionTokens } from "../repositories/token.repo";

dotenv.config();

async function run() {
  try {
    logger.info("Starting Token Cleanup...");
    await cleanupExpiredRevocations();
    await cleanupExpiredRefreshTokens();
    await cleanupExpiredPasswordActionTokens();
    logger.info("Cleanup Finished");
    // close DB pool and exit successfully
    try {
      await pool.end();
    } catch (e) {
      logger.warn({ err: e }, "Failed to close DB pool cleanly");
    }
    process.exit(0);
  } catch (err) {
    logger.error({ err }, "Cleanup Failed");
    try {
      await pool.end();
    } catch (e) {
      logger.warn({ err: e }, "Failed to close DB pool after error");
    }
    process.exit(1);
  }
}

run();
